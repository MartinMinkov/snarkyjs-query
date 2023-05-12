import { Int64, Experimental, Circuit, MerkleMapWitness, Field, method, Permissions, PrivateKey, PublicKey, Reducer, Signature, SmartContract, state, State, Struct, UInt32, UInt64, CircuitString, Poseidon, Account, AccountUpdate, Bool, VerificationKey } from "snarkyjs"
import { Membership } from "./Membership.js";

/**
 * event entity: record how many custom tokens a purchaser purchased 
 */
class PurchaseEvent extends Struct({ purchaser: PublicKey, purchasingAmount: UInt64 }) {
    static createEmptyEntity() {
        return new PurchaseEvent({ purchaser: PrivateKey.random().toPublicKey(), purchasingAmount: UInt64.zero });
    }
}

/**
 * action entity: recording who voted which
 */
class VoteNote extends Struct({ voter: PublicKey, voteOption: UInt64 }) {
    static createEmptyEntity() {
        return new VoteNote({ voter: PublicKey.empty(), voteOption: UInt64.zero });
    }
}

/**
 * an ICO contract offerring custom tokens
 */
export class XTokenContract extends SmartContract {
    // events
    events = {
        "purchase-tokens": PurchaseEvent,
        "set-delegate": PublicKey
    }
    // reducer
    reducer = Reducer({ actionType: VoteNote })

    @state(UInt64) SUPPLY = State<UInt64>();
    @state(UInt64) totalAmountInCirculation = State<UInt64>();

    @state(UInt64) maximumPurchasingAmount = State<UInt64>();
    @state(Field) actionHashVote = State<Field>();

    @state(UInt32) purchaseStartBlockHeight = State<UInt32>();
    @state(UInt32) purchaseEndBlockHeight = State<UInt32>();
    @state(PublicKey) memberShipContractAddress = State<PublicKey>();

    init() {
        super.init();
        // set account permissions
        const permissionToEdit = Permissions.proof();
        this.account.permissions.set({
            ...Permissions.default(),
            editState: permissionToEdit,
            send: permissionToEdit,
            receive: permissionToEdit,

            setZkappUri: permissionToEdit,
            setTokenSymbol: permissionToEdit,
            setDelegate: permissionToEdit,

            setTiming: Permissions.proofOrSignature(),
            setVotingFor: Permissions.proofOrSignature(),
            // incrementNonce: Permissions.proof(),
        });

        this.actionHashVote.set(Reducer.initialActionsHash);
    }

    /**
     * init or reset by admin
     * 
     * TODO could improve it by signature on all params&accountNonce
     */
    @method initOrReset(supply: UInt64, maximumPurchasingAmount: UInt64, memberShipContractAddress: PublicKey, purchaseStartBlockHeight: UInt32, purchaseEndBlockHeight: UInt32, adminPriKey: PrivateKey) {
        // check if admin
        this.address.assertEquals(adminPriKey.toPublicKey());

        // initialze or reset states
        this.account.zkappUri.set('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
        this.account.tokenSymbol.set('XTKN');
        this.SUPPLY.set(supply);
        this.totalAmountInCirculation.set(new UInt64(0));
        this.maximumPurchasingAmount.set(maximumPurchasingAmount);
        this.memberShipContractAddress.set(memberShipContractAddress);
        this.purchaseStartBlockHeight.set(purchaseStartBlockHeight);
        this.purchaseEndBlockHeight.set(purchaseEndBlockHeight);

        // when reset all, need to reduce to clear actions
        const actionHashVote0 = this.actionHashVote.get();
        this.actionHashVote.assertEquals(actionHashVote0);
        const pendingActions = this.reducer.getActions({ fromActionState: actionHashVote0 });
        Circuit.log('pendingActions: ', pendingActions);
        let { state: checkRs, actionsHash: newActionHash } = this.reducer.reduce(pendingActions, Bool, (state: Bool, action: VoteNote) => {
            return state;
        }, { state: Bool(false), actionsHash: actionHashVote0 });
        // reset to the newest one
        this.actionHashVote.set(newActionHash);
        Circuit.log('newActionHash: ', newActionHash);
    }

    /**
     * need proof to transfer Mina. Tx fails if voilate time-locked Mina
     */
    @method transferMina(to: PublicKey, amount: UInt64, adminPriKey: PrivateKey) {
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);

        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);

        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const blockchainLength0 = this.network.blockchainLength.get();
        Circuit.log('blockchainLength0: ', blockchainLength0);
        this.network.blockchainLength.assertBetween(blockchainLength0, UInt32.MAXINT());

        // check precondition_network.blockHeight
        blockchainLength0.assertGreaterThan(purchaseEndBlockHeight0);

        // check if admin
        this.address.assertEquals(adminPriKey.toPublicKey());

        // SUPPLY.assertEquals(totalAmountInCirculation) means some Mina has been timingLocked 
        SUPPLY0.assertEquals(totalAmountInCirculation0);

        // send mina, underlyingly check if current amount is beyond the timing-locking amount.
        this.send({ to, amount });
    }

    /**
     * user purchases token, will fail if an exsiting user;
     * 
     * timing-lock Mina balance if totalAmountInCirculation == SUPPLY
     * @param purchaser 
     * @param purchasingAmount 
     * @param witness 
     */
    @method purchaseToken(purchaser: PublicKey, purchasingAmount: UInt64, witness: MerkleMapWitness) {
        purchasingAmount.assertGreaterThan(UInt64.from(0));

        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);

        const memberShipContractAddress0 = this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        const purchaseStartBlockHeight0 = this.purchaseStartBlockHeight.get();
        this.purchaseStartBlockHeight.assertEquals(purchaseStartBlockHeight0);
        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const blockchainLength0 = this.network.blockchainLength.get();
        Circuit.log('blockchainLength0: ', blockchainLength0);
        this.network.blockchainLength.assertBetween(blockchainLength0, UInt32.MAXINT());
        blockchainLength0.assertGreaterThanOrEqual(purchaseStartBlockHeight0);
        blockchainLength0.assertLessThanOrEqual(purchaseEndBlockHeight0);

        const maximumPurchasingAmount0 = this.maximumPurchasingAmount.get();
        this.maximumPurchasingAmount.assertEquals(maximumPurchasingAmount0);

        // no need to check account.balance
        let balance0 = this.account.balance.get();
        this.account.balance.assertBetween(balance0, UInt64.MAXINT());

        // check enough
        SUPPLY0.sub(totalAmountInCirculation0).assertGreaterThanOrEqual(purchasingAmount, 'restAmount is enough for purchasingAmount');

        // check maximum purchasing amount
        maximumPurchasingAmount0.assertGreaterThanOrEqual(purchasingAmount, 'purchasingAmount is not beyond MaximumPurchasingAmount');

        // check if members are of non-existence and add a member if non-existent
        const membershipContract = new Membership(memberShipContractAddress0);
        membershipContract.addNewMember(purchaser, witness);
        
        // cal how many Mina will be, and sub purchase's balance
        let minaCost = purchasingAmount.mul(0.5e9);
        let purchaserAccountUpdate = AccountUpdate.createSigned(purchaser);
        purchaserAccountUpdate.balance.subInPlace(minaCost);

        this.balance.addInPlace(minaCost);
        const acctBalance1 = balance0.add(minaCost);
        Circuit.log('acctBalance1: ', acctBalance1);

        Circuit.log('to mint...');
        // mint tokens
        this.token.mint({
            address: purchaser,
            amount: purchasingAmount
        });
        this.emitEvent("purchase-tokens", new PurchaseEvent({ purchaser, purchasingAmount }));

        // update totalAmountInCirculation
        const totalAmountInCirculation1 = totalAmountInCirculation0.add(purchasingAmount);
        this.totalAmountInCirculation.set(totalAmountInCirculation1);

        // timing-lock Mina balance if totalAmountInCirculation == SUPPLY
        const initialMinimumBalance0 = Circuit.if(totalAmountInCirculation1.equals(SUPPLY0), acctBalance1.div(3).mul(2), UInt64.from(0));
        Circuit.log('initialMinimumBalance0:', initialMinimumBalance0);

        let globalSLot0 = this.network.globalSlotSinceGenesis.get();
        this.network.globalSlotSinceGenesis.assertBetween(globalSLot0, UInt32.MAXINT());
        Circuit.log('globalSLot0: ', globalSLot0);

        const cliffTime0 = globalSLot0.add(4);// set +4 for Unit Test
        const cliffAmount0 = UInt64.from(initialMinimumBalance0.div(10));
        const vestingPeriod0 = UInt32.from('1');// default == 1
        const vestingIncrement0 = UInt64.from(initialMinimumBalance0.div(10));
        this.timingLockToken(initialMinimumBalance0, cliffTime0, cliffAmount0, vestingPeriod0, vestingIncrement0);
    }

    /**
     * purchaser could vote if burn the rest tokens or keep it. this method could avoid duplicate votes.
     * @param voter 
     * @param voteOption 
     * @param witness 
     */
    @method voteToProcessRestTokens(voter: PrivateKey, voteOption: UInt64, witness: MerkleMapWitness) {
        const actionHashVote0 = this.actionHashVote.get();
        this.actionHashVote.assertEquals(actionHashVote0);
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);
        const memberShipContractAddress0 = this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        // check if SUPPLY > totalAmountInCirculation
        SUPPLY0.assertGreaterThan(totalAmountInCirculation0);

        // check if the member is of token-keeper.
        const voterPk = voter.toPublicKey();
        const membershipContract = new Membership(memberShipContractAddress0);
        membershipContract.checkMemberShip(voterPk, witness).assertEquals(true);

        // check voteOption is valid: in [1, 2]
        voteOption.assertGreaterThanOrEqual(UInt64.from(1));
        voteOption.assertLessThanOrEqual(UInt64.from(2));
        // record <voter, voteNote> as Action, so need to check if the voter has voted before.
        const pendingActions0 = this.reducer.getActions({ fromActionState: this.actionHashVote.get() });
        Circuit.log('pendingActions0: ', pendingActions0);

        let { state: checkRs, actionsHash: newActionHash } = this.reducer.reduce(pendingActions0, Bool, (state: Bool, action: VoteNote) => {
            return state.or(action.voter.equals(voterPk));
        }, { state: Bool(false), actionsHash: actionHashVote0 });

        // check if vote again
        checkRs.assertEquals(Bool(false));

        this.reducer.dispatch(new VoteNote({ voter: voterPk, voteOption }));
    }

    /**
     * reduce all Actions of <voter, voteNote>, to decide if burn the rest tokens or keep it. 
     */
    @method rollupVoteNote() {
        const actionHashVote0 = this.actionHashVote.get();
        this.actionHashVote.assertEquals(actionHashVote0);
        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);

        const memberShipContractAddress0 = this.memberShipContractAddress.get();
        this.memberShipContractAddress.assertEquals(memberShipContractAddress0);

        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        const blockchainLength0 = this.network.blockchainLength.get();
        this.network.blockchainLength.assertBetween(blockchainLength0, UInt32.MAXINT());

        // check precondition_network.blockHeight is greaterorequal purchaseEndBlockHeight
        blockchainLength0.assertGreaterThan(purchaseEndBlockHeight0);

        const pendingActions = this.reducer.getActions({ fromActionState: this.actionHashVote.get() });
        Circuit.log('pendingActions: ', pendingActions);

        let actionsYCount = UInt32.from(0);
        let actionsFCount = UInt32.from(0);
        let { state: result, actionsHash: newActionHash } = this.reducer.reduce(pendingActions, VoteNote, (state: VoteNote, action: VoteNote) => {
            actionsYCount = actionsYCount.add(Circuit.if(action.voteOption.equals(UInt64.from(1)), UInt32.from(1), UInt32.from(0)));
            actionsFCount = actionsFCount.add(Circuit.if(action.voteOption.equals(UInt64.from(2)), UInt32.from(1), UInt32.from(0)));
            return state;
        }, { state: VoteNote.createEmptyEntity(), actionsHash: actionHashVote0 });

        // check voters's number 
        Circuit.log('after reducing Actions, actionsYCount: ', actionsYCount, ', actionsFCount: ', actionsFCount);
        const membershipContract = new Membership(memberShipContractAddress0);
        membershipContract.assertEqualsMemberCount(actionsYCount.add(actionsFCount));

        // process 
        // if Y > F, 则burn the rest token, else do nothing.
        const newSupply = Circuit.if(actionsYCount.greaterThan(actionsFCount), totalAmountInCirculation0, SUPPLY0);
        this.SUPPLY.set(newSupply);

        // update actionHash
        this.actionHashVote.set(newActionHash);
        Circuit.log('newActionHash: ', newActionHash);

        let globalSLot0 = this.network.globalSlotSinceGenesis.get();
        this.network.globalSlotSinceGenesis.assertBetween(globalSLot0, UInt32.MAXINT());
        Circuit.log('globalSLot0: ', globalSLot0);

        // meanwhile, timing-lock Mina balance
        let balance0 = this.account.balance.get();
        this.account.balance.assertBetween(balance0, UInt64.MAXINT());
        const initialMinimumBalance0 = balance0.div(3).mul(2);
        const cliffTime0 = globalSLot0.add(4);// set 3 for Unit Test
        const cliffAmount0 = UInt64.from(initialMinimumBalance0.div(10));
        const vestingPeriod0 = UInt32.from('1');
        const vestingIncrement0 = UInt64.from(initialMinimumBalance0.div(10));
        this.timingLockToken(initialMinimumBalance0, cliffTime0, cliffAmount0, vestingPeriod0, vestingIncrement0);
    }

    timingLockToken(initialMinimumBalanceX: UInt64, cliffTimeX: UInt32, cliffAmountX: UInt64, vestingPeriodX: UInt32, vestingIncrementX: UInt64) {
        // timing-lock Mina balance
        this.account.timing.set({ initialMinimumBalance: initialMinimumBalanceX, cliffTime: cliffTimeX, cliffAmount: cliffAmountX, vestingPeriod: vestingPeriodX, vestingIncrement: vestingIncrementX });
    }

    /**
     * called by `VoteDelegateContract`, to set new `delegate` by admin. 
     * 
     * TODO could improve it by signature on all params&accountNonce
     * @param target new delegate address
     * @param adminPriKey 
     */
    @method delegateTo(target: PublicKey, adminPriKey: PrivateKey) {
        const blockchainLength0 = this.network.blockchainLength.get();
        this.network.blockchainLength.assertBetween(blockchainLength0, UInt32.MAXINT());
        const purchaseEndBlockHeight0 = this.purchaseEndBlockHeight.get();
        this.purchaseEndBlockHeight.assertEquals(purchaseEndBlockHeight0);

        // check precondition_network.blockHeight
        blockchainLength0.assertGreaterThan(purchaseEndBlockHeight0);

        // check if admin
        this.address.assertEquals(adminPriKey.toPublicKey());

        // set delegate target
        this.account.delegate.assertEquals(this.account.delegate.get());
        this.account.delegate.set(target);

        this.emitEvent("set-delegate", target);
    }

    /**
     * approve transfer custom token by proof auth
     * @param senderAddress 
     * @param receiverAddress 
     * @param amount 
     * @param callback 
     */
    @method approveTransferCallback(
        senderAddress: PublicKey,
        receiverAddress: PublicKey,
        amount: UInt64,
        callback: Experimental.Callback<any>
    ) {
        let layout = AccountUpdate.Layout.NoChildren; // Allow only 1 accountUpdate with no children
        let senderAccountUpdate = this.approve(callback, layout);
        let negativeAmount = Int64.fromObject(
            senderAccountUpdate.body.balanceChange
        );
        negativeAmount.assertEquals(Int64.from(amount).neg());
        let tokenId = this.token.id;
        senderAccountUpdate.body.tokenId.assertEquals(tokenId);
        senderAccountUpdate.body.publicKey.assertEquals(senderAddress);
        let receiverAccountUpdate = Experimental.createChildAccountUpdate(
            this.self,
            receiverAddress,
            tokenId
        );
        receiverAccountUpdate.balance.addInPlace(amount);
    }

    /**
     * deploy a new token account, for transfer by proof auth
     * @param address 
     * @param verificationKey 
     */
    @method deployZkapp(address: PublicKey, verificationKey: VerificationKey) {
        let tokenId = this.token.id;
        let zkapp = AccountUpdate.defaultAccountUpdate(address, tokenId);
        this.approve(zkapp);
        zkapp.account.permissions.set(Permissions.default());
        zkapp.account.verificationKey.set(verificationKey);
        zkapp.requireSignature();
    }

    /**
     * send custom token by holder's Signature
     * @param senderAddress 
     * @param receiverAddress 
     * @param amount 
     */
    @method sendTokens(
        senderAddress: PublicKey,
        receiverAddress: PublicKey,
        amount: UInt64
    ) {
        this.token.send({
            to: receiverAddress,
            from: senderAddress,
            amount,
        });
    }

    /**
     * burn holder's token by holder's Signature,
     * 
     * will decrease SUPPLY and total Amount In Circulation, so need ‘this.SUPPLY.assertEquals(this.totalAmountInCirculation)’
     * 
     * @param targetAddress 
     * @param amount 
     */
    @method burnTokens(
        targetAddress: PublicKey,
        amount: UInt64
    ) {
        const SUPPLY0 = this.SUPPLY.get();
        this.SUPPLY.assertEquals(SUPPLY0);

        const totalAmountInCirculation0 = this.totalAmountInCirculation.get();
        this.totalAmountInCirculation.assertEquals(totalAmountInCirculation0);

        SUPPLY0.assertEquals(totalAmountInCirculation0);

        this.token.burn({
            address: targetAddress,
            amount
        });

        this.SUPPLY.set(SUPPLY0.sub(amount));
        this.totalAmountInCirculation.set(totalAmountInCirculation0.sub(amount));
    }
}

export class NormalTokenUser extends SmartContract {
    @method approveTokenTransfer(amount: UInt64) {
        this.balance.subInPlace(amount);
    }
}
