/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import {
  Token,
  shareSnarkyMetadata,
} from '@stove-labs/mip-token-standard/packages/token';
import {
  Key,
  OffchainState,
  offchainState,
  OffchainStateContract,
  OffchainStateMapRoot,
  withOffchainState,
} from '@zkfs/contract-api';
import { safeUint64Div, safeUint64Sub } from '@zkfs/safe-math';
import {
  Field,
  method,
  Reducer,
  State,
  state,
  Struct,
  UInt64,
  Permissions,
  PublicKey,
  Circuit,
  AccountUpdate,
  UInt32,
  Bool,
  PrivateKey,
  isReady,
} from 'snarkyjs';

import { Action } from './actions/actions.js';
import deactivateEvents from './zkfsConfig.js';
import { ProgramProof } from './zkProgram.js';

class DelegatorRecord extends Struct({
  accumulatedRewardPerShareStart: UInt64,
  balance: UInt64,
}) {}

class FarmData extends Struct({
  accumulatedRewardsPerShare: UInt64,
  totalStakedBalance: UInt64,
}) {}

class CustomToken extends Token {
  public deploy(): void {
    super.deploy();
    this.account.permissions.set({
      ...Permissions.default(),
      access: Permissions.proof(),
      send: Permissions.proofOrSignature(),
    });
    this.account.tokenSymbol.set('TEST');
  }
}
shareSnarkyMetadata(CustomToken, Token);

export { CustomToken };

await isReady;

export class Farm extends OffchainStateContract {
  public static tokenSmartContractAddress: PublicKey =
    PrivateKey.random().toPublicKey();

  /**
   * Deactivates events emitted by offchain storage package ZKFS,
   * until event limits are increased above 16.
   */
  override rollingStateOptions = deactivateEvents;

  events = {
    totalStakedBalance: UInt64,
    userReward: UInt64,
    accumulatedRewardsPerShare: UInt64,
  };

  public fixedPointAccuracy = UInt64.from(1_000_000);

  public defaultAdmin = PublicKey.from({ x: Field(0), isOdd: Bool(false) });

  public static addressToKey = (address: PublicKey): Key<PublicKey> =>
    Key.fromType<PublicKey>(PublicKey, address);

  // until snarkyjs fixes bug with state indexes in extended classes
  @state(Field) public placeholder = State<Field>();

  @state(Field) public actionsHash = State<Field>();

  @state(UInt64) public rewardPerBlock = State<UInt64>();

  @state(UInt32) public lastUpdate = State<UInt32>();

  @state(PublicKey) public admin = State<PublicKey>();

  public reducer = Reducer({ actionType: Action });

  @offchainState() public delegators = OffchainState.fromMap();

  @offchainState() public farmData = OffchainState.fromRoot<FarmData>(FarmData);

  @withOffchainState
  public init() {
    super.init();

    this.root.setRootHash(OffchainStateMapRoot.initialRootHash);
    this.actionsHash.set(Reducer.initialActionsHash);
    this.admin.set(this.defaultAdmin);

    this.lastUpdate.set(UInt32.from(0));
    // off-chain state
    this.rewardPerBlock.set(UInt64.from(5));
    this.delegators.setRootHash(OffchainStateMapRoot.initialRootHash);
    this.farmData.set(
      new FarmData({
        accumulatedRewardsPerShare: UInt64.from(0),
        totalStakedBalance: UInt64.from(0),
      })
    );

    this.account.permissions.set({
      ...Permissions.default(),
      editActionState: Permissions.proofOrSignature(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.signature(),
    });
  }

  public get tokenContract() {
    if (!Farm.tokenSmartContractAddress) {
      throw new Error('Token smart contract address unknown!');
    }
    return new CustomToken(Farm.tokenSmartContractAddress);
  }

  /*
   *  Sets the admin of the contract.
   *  This method can only be called once in the life cycle of the farm.
   */
  @method
  public setAdmin(newAdmin: PublicKey) {
    // set admin
    const admin = this.admin.get();
    this.admin.assertEquals(admin);
    // ensure that startFarm can only be called once
    admin.assertEquals(this.defaultAdmin);

    const blockHeight = this.network.blockchainLength.get();
    this.network.blockchainLength.assertEquals(blockHeight);

    this.admin.set(newAdmin);
  }

  @method
  /**
   * This method updates the rewards per block for the farm.
   *
   * It takes in a `ProgramProof` and a `UInt64` value for the new reward per block.
   * The method first verifies the proof, then checks that the current block height
   * is less than the permission until block height specified in the proof.
   * It also checks that the public key in the proof matches the admin key for
   * the farm. Finally, it sets the new reward per block value in the farm's state.
   *
   */
  public updateRewardsPerBlock(proof: ProgramProof, newRewardPerBlock: UInt64) {
    proof.verify();

    const { permissionUntilBlockHeight } = proof.publicInput;
    const blockHeight = this.network.blockchainLength.get();
    this.network.blockchainLength.assertEquals(blockHeight);
    blockHeight.assertLessThan(permissionUntilBlockHeight);

    const rewardPerBlock = this.rewardPerBlock.get();
    const { publicKey } = proof.publicInput;
    const admin = this.admin.get();
    this.admin.assertEquals(admin);
    publicKey.assertEquals(admin);

    this.rewardPerBlock.assertEquals(rewardPerBlock);
    this.rewardPerBlock.set(newRewardPerBlock);
  }

  public getDelegatorRecord(address: PublicKey): DelegatorRecord {
    const state = OffchainState.fromParent(
      this.root,
      DelegatorRecord,
      Farm.addressToKey(address)
    );
    state.contract = this;
    const defaultDelegatorRecord = new DelegatorRecord({
      accumulatedRewardPerShareStart: UInt64.from(0),
      balance: UInt64.from(0),
    });
    return state.getOrDefault(defaultDelegatorRecord);
  }

  public setDelegatorRecord(
    address: PublicKey,
    delegatorRecord: DelegatorRecord
  ) {
    const state = OffchainState.fromParent(
      this.root,
      DelegatorRecord,
      Farm.addressToKey(address)
    );
    state.contract = this;
    state.set(delegatorRecord);
  }

  @method
  @withOffchainState
  public deposit(address: PublicKey, amount: UInt64) {
    AccountUpdate.create(address).requireSignature();
    this.tokenContract.transfer(address, this.address, amount);

    this.reducer.dispatch(Action.deposit(address, amount));
  }

  @method
  @withOffchainState
  public claim(address: PublicKey) {
    AccountUpdate.create(address).requireSignature();

    this.reducer.dispatch(Action.claim(address));
  }

  @method
  @withOffchainState
  public withdraw(address: PublicKey) {
    AccountUpdate.create(address).requireSignature();

    this.reducer.dispatch(Action.withdraw(address));
  }

  public createDelegatorRecord(accStart: UInt64, amount: UInt64) {
    return new DelegatorRecord({
      accumulatedRewardPerShareStart: accStart,
      balance: amount,
    });
  }

  public updatePoolWithRewards() {
    const lastUpdate = this.lastUpdate.get();
    this.lastUpdate.assertEquals(lastUpdate);

    const blockHeight = this.network.blockchainLength.get();
    this.network.blockchainLength.assertEquals(blockHeight);
    const multiplier = blockHeight.sub(lastUpdate);

    const rewardPerBlock = this.rewardPerBlock.get();
    this.rewardPerBlock.assertEquals(rewardPerBlock);
    const reward = multiplier.toUInt64().mul(rewardPerBlock);

    const farmData = this.farmData.get();

    const newAccPerShare = farmData.accumulatedRewardsPerShare.add(
      safeUint64Div(
        reward.mul(this.fixedPointAccuracy),
        farmData.totalStakedBalance
      )
    );

    const newFarmData = new FarmData({
      accumulatedRewardsPerShare: newAccPerShare,
      totalStakedBalance: farmData.totalStakedBalance,
    });
    this.farmData.set(newFarmData);
    this.lastUpdate.set(blockHeight);
  }

  public calculateReward(
    farmData: FarmData,
    delegatorRecord: DelegatorRecord
  ): UInt64 {
    const accForUser = farmData.accumulatedRewardsPerShare.sub(
      delegatorRecord.accumulatedRewardPerShareStart
    );
    const delegatorRewardWithAccuracy = accForUser.mul(delegatorRecord.balance);
    const delegatorReward = delegatorRewardWithAccuracy.div(
      this.fixedPointAccuracy
    );
    return delegatorReward;
  }

  public applyAction(action: Action) {
    const { address, amount } = action.payload;

    // to be called for any action type
    const farmData = this.farmData.get();
    const delegatorRecord = this.getDelegatorRecord(address);
    const userReward = this.calculateReward(farmData, delegatorRecord);

    // not done here: send reward to user
    this.emitEvent('userReward', userReward);

    const newBalanceAfterDeposit = delegatorRecord.balance.add(amount);

    const newBalanceAfterWithdraw = Circuit.if(
      action.type.equals(Action.types.withdraw),
      UInt64.from(0),
      newBalanceAfterDeposit
    );

    // accumulatedRewardPerShare is the same as farm because of claim() (!)
    const newDelegatorRecord = this.createDelegatorRecord(
      farmData.accumulatedRewardsPerShare,
      newBalanceAfterWithdraw
    );
    this.setDelegatorRecord(address, newDelegatorRecord);

    // not done here: send staked balance to user for withdraw

    // case deposit
    const totalStakedBalanceAfterDeposit = Circuit.if(
      action.type.equals(Action.types.deposit),
      farmData.totalStakedBalance.add(amount),
      farmData.totalStakedBalance
    );

    // case withdraw
    const newTotalStakedBalance = Circuit.if(
      action.type.equals(Action.types.withdraw),
      safeUint64Sub(totalStakedBalanceAfterDeposit, newBalanceAfterDeposit),
      totalStakedBalanceAfterDeposit
    );

    const newFarmData = new FarmData({
      accumulatedRewardsPerShare: farmData.accumulatedRewardsPerShare,
      totalStakedBalance: newTotalStakedBalance,
    });
    this.farmData.set(newFarmData);

    this.emitEvent('totalStakedBalance', newFarmData.totalStakedBalance);
    this.emitEvent(
      'accumulatedRewardsPerShare',
      newFarmData.accumulatedRewardsPerShare
    );
  }

  public reduce(rootHash: Field, action: Action): Field {
    this.updatePoolWithRewards();
    this.applyAction(action);
    return this.root.getRootHash();
  }

  @method
  @withOffchainState
  public rollup() {
    const actionsHash = this.actionsHash.get();
    this.actionsHash.assertEquals(actionsHash);

    let pendingActions = this.reducer.getActions({
      fromActionState: actionsHash,
    });

    // this is a temporary workaround for https://github.com/o1-labs/snarkyjs/issues/852
    // start
    Circuit.asProver(() => {
      // eslint-disable-next-line snarkyjs/no-if-in-circuit
      if (!actionsHash.equals(Reducer.initialActionsHash).toBoolean()) {
        pendingActions = pendingActions.slice(1);
      }
    });
    // end
    // comment this out for local blockchain testing!

    const currentRootHash = this.root.getRootHash();
    /**
     * Fail silently, until the following issue is resolved:
     * https://discord.com/channels/484437221055922177/1081186784622424154
     */
    // eslint-disable-next-line snarkyjs/no-if-in-circuit
    if (!this.virtualStorage?.data) {
      console.log('Skipping execution, because no virtual storage was found');
      return;
    }

    const { actionsHash: newActionsHash, state: newRootHash } =
      this.withRollingState(() =>
        this.reducer.reduce(
          pendingActions,
          Field,
          this.reduce.bind(this),
          {
            state: currentRootHash,
            actionsHash,
          },
          { maxTransactionsWithActions: 1 }
        )
      );

    this.actionsHash.set(newActionsHash);
    this.root.setRootHash(newRootHash);
  }
}
