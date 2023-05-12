/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable new-cap */
import { Token } from '@stove-labs/mip-token-standard/packages/token';
import {
  Key,
  OffchainState,
  offchainState,
  OffchainStateContract,
  OffchainStateMap,
  OffchainStateMapRoot,
  withOffchainState,
} from '@zkfs/contract-api';
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
  SmartContract,
  DeployArgs,
} from 'snarkyjs';
import { WhitelistProgramProof } from './WhitelistProgram';

class DepositAction extends Struct({
  address: PublicKey,
  amount: UInt64,
}) {}

class FundPool extends OffchainStateContract {
  public static tokenSmartContractAddress: PublicKey;
  public static startFromBlockchainLength: UInt32;
  public static endAtBlockchainLength: UInt32;

  @offchainState() public deposits = OffchainState.fromMap();

  @state(Field) public placeholder = State<Field>();
  @state(Field) public whitelistRoot = State<Field>();
  @state(Field) public actionsHash = State<Field>();
  public reducer = Reducer({ actionType: DepositAction });

  public get tokenContract() {
    return new Token(FundPool.tokenSmartContractAddress);
  }

  public override deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method
  public setWhitelistRoot(whitelistRoot: Field) {
    this.account.provedState.assertEquals(Bool(false));
    this.whitelistRoot.set(whitelistRoot);
  }

  public setWhitelistRootSigned(whitelistRoot: Field) {
    this.whitelistRoot.set(whitelistRoot);
  }

  @withOffchainState
  public init() {
    super.init();
    this.actionsHash.set(Reducer.initialActionsHash);
    this.deposits.setRootHash(OffchainStateMap.initialRootHash());
  }

  @method
  public deposit(isWhitelisted: WhitelistProgramProof, amount: UInt64) {
    const whitelistRoot = this.whitelistRoot.get();
    this.whitelistRoot.assertEquals(whitelistRoot);

    this.network.blockchainLength.assertBetween(
      FundPool.startFromBlockchainLength,
      FundPool.endAtBlockchainLength
    );

    isWhitelisted.verify();
    isWhitelisted.publicInput.whitelistRoot.assertEquals(
      whitelistRoot,
      'Whitelist root does not match'
    );

    this.tokenContract.transfer(this.sender, this.address, amount);
    this.reducer.dispatch(
      new DepositAction({
        address: this.sender,
        amount,
      })
    );
  }

  @method
  @withOffchainState
  public rollup() {
    const actionsHash = this.actionsHash.get();
    this.actionsHash.assertEquals(actionsHash);

    const pendingActions = this.reducer.getActions({
      fromActionState: actionsHash,
    });

    const currentRootHash = this.root.getRootHash();

    const { actionsHash: newActionsHash, state: newRootHash } =
      this.withRollingState(() =>
        this.reducer.reduce(
          pendingActions,
          Field,
          (state: Field, action: DepositAction) => {
            const key = Key.fromType<PublicKey>(PublicKey, action.address);
            const [currentDeposit] = this.deposits.getOrDefault(
              UInt64,
              key,
              UInt64.from(0)
            );
            this.deposits.set(UInt64, key, currentDeposit.add(action.amount));
            return this.root.getRootHash();
          },
          {
            state: currentRootHash,
            actionsHash,
          },
          { maxTransactionsWithActions: 1 }
        )
      );

    Circuit.log('rollup done');
    this.actionsHash.set(newActionsHash);
    this.root.setRootHash(newRootHash);
  }
}

export default FundPool;
