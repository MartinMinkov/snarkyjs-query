import { AccountUpdate, Bool, Experimental, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, Reducer, shutdown, Signature, SmartContract, Types, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract, NormalTokenUser } from './XTokenContract.js';
import { Membership } from './Membership.js';
import { loopUntilAccountExists, makeAndSendTransaction, syncNetworkStatus, syncAcctInfo, syncActions, waitBlockHeightToExceed } from './utils.js';

describe('test fuctions inside XTokenContract', () => {
    let isLocalBlockChain = !(process.env.TEST_ON_BERKELEY! == 'true');

    let Blockchain: any;
    let transactionFee = 1000_000_000;
    let icoBlocksRangeWindow = 18;

    let
        senderAccount: PublicKey,
        senderKey: PrivateKey,
        zkAppVerificationKey: any,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkApp: XTokenContract,
        tokenMembersMerkleMap: MerkleMap;

    let membershipZkAppPrivateKey: PrivateKey;
    let membershipZkAppAddress: PublicKey;
    let membershipZkApp: Membership;
    let membershipVerificationKey: any;

    let normalTokenUserVerificationKey: any;

    let purchaseStartBlockHeight: UInt32;
    let purchaseEndBlockHeight: UInt32;
    let tokenSupply: UInt64;
    let maximumPurchasingAmount: UInt64;

    let senderAcctInfo: Types.Account | undefined;
    let membershipAcctInfo: Types.Account | undefined;
    let zkAppAcctInfo: Types.Account | undefined;

    async function syncAllAccountInfo(isLocalBlockChain?: boolean) {
        senderAcctInfo = await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain);
        zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
        membershipAcctInfo = await syncAcctInfo(membershipZkAppAddress, Field(1), isLocalBlockChain);
        console.log('current senderAcctInfo: ', JSON.stringify(senderAcctInfo));
        console.log('current membershipAcctInfo: ', JSON.stringify(membershipAcctInfo));
        console.log('current zkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
    }

    const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
        await syncAllAccountInfo(isLocalBlockChain);

        let userPubKey = userPriKey.toPublicKey();

        // get merkle witness
        let indx = Poseidon.hash(userPubKey.toFields());
        let userValue = tokenMembersMerkleMap.get(indx);
        console.log(`user.Value inside merkle map: ${userValue.toString()}`);
        let userMerkleMapWitness = tokenMembersMerkleMap.getWitness(indx);

        // construct a tx and send
        console.log(`user purchase Tokens...`);

        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                prePurchaseCallback(senderAccount, userPriKey);
                zkApp.purchaseToken(userPubKey, purchaseAmount0, userMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey, userPriKey]);
            },
            getState() {
                return zkApp.totalAmountInCirculation.get();
            },
            statesEqual(state1, state2) {
                return state2.equals(state1).toBoolean();
            },
            isLocalBlockChain
        });
        // store the user
        tokenMembersMerkleMap.set(indx, Field(1));

        await syncAllAccountInfo(isLocalBlockChain);
    }

    beforeAll(async () => {
        console.time('All test suites begin...');
        await isReady;

        Blockchain = !isLocalBlockChain ? Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive-node-api.p42.xyz/',// archive: 'https://archive.berkeley.minaexplorer.com/',
        }) : Mina.LocalBlockchain({ proofsEnabled: true });
        Mina.setActiveInstance(Blockchain);

        membershipVerificationKey = (await Membership.compile()).verificationKey;
        console.log(`Membership.compile done!`);

        normalTokenUserVerificationKey = NormalTokenUser.compile();
        console.log(`NormalTokenUser.compile done!`);

        zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
        console.log(`XTokenContract.compile done!`);
    });

    afterAll(() => {
        console.timeEnd('All test suites begin...');

        setInterval(shutdown, 1600);
    });

    beforeEach(async () => {
        await syncNetworkStatus(isLocalBlockChain);

        if (!isLocalBlockChain) {// Berkeley
            senderKey = PrivateKey.random();
            senderAccount = senderKey.toPublicKey();

            console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
            await Mina.faucet(senderAccount);
            await loopUntilAccountExists({
                address: senderAccount,
                tokenId: Field(1),// MINA
                eachTimeNotExist: () => { console.log('[await loopUntilAccountExists] senderAccount is still not exiting, loop&wait...'); },
                isZkAppAccount: false,
                isLocalBlockChain
            });
            console.log('senderAccount is funded!');

        } else {// Local
            ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[0]);
        }

        console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
        senderAcctInfo = await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain);
        let { nonce, balance } = senderAcctInfo;
        console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);

        membershipZkAppPrivateKey = PrivateKey.random();
        membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
        membershipZkApp = new Membership(membershipZkAppAddress);
        console.log('membershipZkApp\'s PrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkApp\'s Address: ', membershipZkAppAddress.toBase58());

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new XTokenContract(zkAppAddress);
        console.log('xTokenContractZkApp\'s PrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkApp\'s Address: ', zkAppAddress.toBase58());

        // init appStatus values
        purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
        purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(icoBlocksRangeWindow);// TODO
        tokenSupply = UInt64.from(6);
        maximumPurchasingAmount = UInt64.from(2);

        console.log(`Membership Contract: deploying...`);
        let tx_deployMembership = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount);
            membershipZkApp.deploy({ zkappKey: membershipZkAppPrivateKey, verificationKey: membershipVerificationKey });
        });
        let txId_deployMembership = await tx_deployMembership.sign([senderKey]).send();
        console.log(`Membership Contract: deployment tx[${txId_deployMembership.hash()!}] sent...`);
        await txId_deployMembership.wait({ maxAttempts: 1000 });
        console.log(`Membership Contract: txId.isSuccess:`, txId_deployMembership.isSuccess);

        // loop to wait for membership contract to deploy done!
        await loopUntilAccountExists({
            address: membershipZkAppAddress,
            tokenId: Field(1),// MINA
            eachTimeNotExist() {
                console.log('loop&wait for membership contract to deploy...');
            },
            isZkAppAccount: true,
            isLocalBlockChain
        });
        console.log(`Membership Contract: deployment done!`);

        senderAcctInfo = await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain);
        console.log('sync senderAcctInfo：', JSON.stringify(senderAcctInfo));

        console.log(`XTokenContract: deploying...`);
        // deploy zkApp
        let tx_deployXTokenContract = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount);
            zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
        });
        let txId_deployXTokenContract = await tx_deployXTokenContract.sign([senderKey]).send();
        console.log(`XTokenContract: deployment tx[${txId_deployXTokenContract.hash()!}] sent...`);
        await txId_deployXTokenContract.wait({ maxAttempts: 1000 });
        console.log(`xTokenContract: txId.isSuccess:`, txId_deployXTokenContract.isSuccess);

        // loop to wait for XTokenContract contract to deploy done!
        await loopUntilAccountExists({
            address: zkAppAddress,
            tokenId: Field(1),// MINA
            eachTimeNotExist() {
                console.log('loop&wait for XTokenContract to deploy...');
            },
            isZkAppAccount: true,
            isLocalBlockChain
        });
        console.log(`xTokenContract: deployment done!`);

        await syncAllAccountInfo(isLocalBlockChain);

        tokenMembersMerkleMap = new MerkleMap();
        const merkleRoot0 = tokenMembersMerkleMap.getRoot();
        console.log(`tokenMembersMerkleMap's initial root: ${merkleRoot0.toString()}`);

        await syncNetworkStatus(isLocalBlockChain);

        // initialize or reset XTokenContract & MembershipZkApp
        console.log(`trigger all contracts to initialize...`);
        console.log(`
            tokenSupply: ${tokenSupply.toString()},\n
            maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
            purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()}\n
        `);

        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                zkApp.initOrReset(
                    tokenSupply,
                    maximumPurchasingAmount,
                    membershipZkAppAddress,
                    purchaseStartBlockHeight,
                    purchaseEndBlockHeight,
                    zkAppPrivateKey
                );
                membershipZkApp.initOrReset(new MerkleMap().getRoot(), UInt32.from(0), membershipZkAppPrivateKey);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey]);
            },
            getState() {
                return (Blockchain.getAccount(zkAppAddress).tokenSymbol) as string;
            },
            statesEqual(state1, state2) {
                console.log('state1: ', state1, '  state2: ', state2);
                return state2 == state1;
            },
            isLocalBlockChain
        });

        await syncAllAccountInfo(isLocalBlockChain);

        const tokenSymbol = Blockchain.getAccount(zkAppAddress).tokenSymbol;
        expect(tokenSymbol).toEqual('XTKN');

        const zkAppUri = Blockchain.getAccount(zkAppAddress).zkapp?.zkappUri;
        expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
    });


    it(`CHECK tx should succeed when purchase tokens by an non-existing user, but should fail when purchase by an existing user`, async () => {
        console.log('===================[CHECK tx should succeed purchase tokens by an non-existing user] ===================')
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = tokenMembersMerkleMap.getRoot();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());

        let userPriKey = PrivateKey.random();
        console.log(`create one user with PrivateKey: ${userPriKey.toBase58()},  PublicKey: ${userPriKey.toPublicKey().toBase58()}`);
        await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        expect(membershipZkApp.memberTreeRoot.get()).not.toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(tokenMembersMerkleMap.getRoot());
        expect(membershipZkApp.memberCount.get()).toEqual(UInt32.from(1));
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0.add(2));
        console.log('===================[tx succeeds when purchase tokens by an non-existing user !!] ===================')

        console.log('===================[CHECK tx should fail when purchase tokens by an existing user] ===================')
        console.log('=======================the same user purchases tokens again=======================');
        totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        let memberCount0 = membershipZkApp.memberCount.get();

        // construct a tx and send
        try {
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('===================[As Expected, tx fails when purchase tokens by an existing user !!] ===================')
            console.error(error);
        }

        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);// should equal
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

        console.log('========== [END]CHECK tx should succeed when purchase tokens by an non-existing user, but should fail when purchase by an existing user ==========');
    });

    // PASS on BERKELEY 0409
    it(`CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount AND CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength`, async () => {
        console.log('===================[CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount] ===================')
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
        let memberCount0 = membershipZkApp.memberCount.get();
        console.log('memberCount0: ', memberCount0.toString());

        let userPriKey = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('========== As Expected, tx fails when purchase tokens when EXCEEDING maximum purchasing amount ========== ');
            console.error(error);
        }

        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);


        console.log('===================[CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength] ===================')
        let totalAmountInCirculation00 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation00: ', totalAmountInCirculation00.toString());
        let memberTreeRoot00 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot00: ', memberTreeRoot00.toString());
        let memberCount00 = membershipZkApp.memberCount.get();
        console.log('memberCount00: ', memberCount00.toString());

        // wait for blockchainHeight
        await waitBlockHeightToExceed(purchaseEndBlockHeight, isLocalBlockChain);

        let userPriKey00 = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKey00, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('========== As Expected, tx fails when purchase tokens with EXCEEDING precondition.network.blockchainLength ========== ');
            console.error(error);
        }
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot00);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount00);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation00);

        console.log('========== [END]CHECK tx should fail when purchase tokens when EXCEEDING maximum purchasing amount AND CHECK tx should fail when purchase tokens with EXCEEDING precondition.network.blockchainLength ==========');

    });
    // PASS on BERKELEY 0409


    it(`CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY `, async () => {
        console.log('===================[CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY ] ===================')

        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================thirdUser starts========================');
        console.log('=========purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY, (should FAIL)=========');
        let totalAmountInCirculation0 = zkApp.totalAmountInCirculation.get();
        console.log('totalAmountInCirculation0: ', totalAmountInCirculation0.toString());
        let memberTreeRoot0 = membershipZkApp.memberTreeRoot.get();
        console.log('memberTreeRoot0: ', memberTreeRoot0.toString());
        let memberCount0 = membershipZkApp.memberCount.get();
        console.log('memberCount0: ', memberCount0.toString());

        let userPriKeyThird = PrivateKey.random();
        try {
            await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.add(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
                let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
                accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
            });
        } catch (error) {
            console.log('=========purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY, As Expected, tx FAIL!)=========');
            console.error(error);
        }
        expect(membershipZkApp.memberTreeRoot.get()).toEqual(memberTreeRoot0);
        expect(membershipZkApp.memberCount.get()).toEqual(memberCount0);
        expect(zkApp.totalAmountInCirculation.get()).toEqual(totalAmountInCirculation0);

        console.log('========== [END]CHECK tx should fail when purchase tokens when (totalAmountInCirculation + purchasingAmount) > SUPPLY ==========');
    });

    // PASS on Berkeley on 0409
    it(`CHECK if (timing-lock Mina balance when totalAmountInCirculation == SUPPLY) AND (Mina of 'cliffAmount' can be transferred after 'cliffTime')`, async () => {
        console.log('===================[CHECK if timing-lock Mina balance when totalAmountInCirculation == SUPPLY]===================');

        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================thirdUser starts========================');
        let userPriKeyThird = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        // wait for blocks grow...
        await waitBlockHeightToExceed(purchaseEndBlockHeight, isLocalBlockChain);

        let balanceAfter3Purchases = zkApp.account.balance.get();

        expect(zkAppAcctInfo?.timing.isTimed).toEqual(Bool(true));
        expect(zkAppAcctInfo?.timing.initialMinimumBalance).toEqual(UInt64.from('2000000000'));
        expect(zkAppAcctInfo?.timing.cliffAmount).toEqual(UInt64.from('200000000'));
        expect(zkAppAcctInfo?.timing.vestingIncrement).toEqual(UInt64.from('200000000'));
    });
    // PASS on Berkeley on 0409


    // PASS on Berkeley on 0411
    it(`CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND rollup VoteNotes by reducing Actions`, async () => {
        console.log('===================[CHECK if one can ONLY vote for ONE time To Process Rest Tokens AND then rollup VoteNotes by reducing Actions]===================');
        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        let userPubKeyFirst = userPriKeyFirst.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });
        console.log('     =================firstUser votes===================     ');
        await makeAndSendTransaction({
            feePayerPublicKey: userPubKeyFirst,
            zkAppAddress,
            mutateZkApp() {
                let voter = userPriKeyFirst;
                let voteOption = UInt64.from(1);// vote to Burn the extra tokens
                let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([userPriKeyFirst]);
            },
            async getState() {
                console.log('firstUser votes........');

                // get the length of actions list, and compare later to confirm the tx is done!
                let actionsList = await syncActions(zkAppAddress, isLocalBlockChain);
                console.log(`Obtaining actions of ${zkAppAddress.toBase58()}: `, JSON.stringify(actionsList));
                if (actionsList?.length == 0) {
                    await waitBlockHeightToExceed((await syncNetworkStatus(isLocalBlockChain)).blockchainLength.add(1), isLocalBlockChain);
                }

                return actionsList!.length;
            },
            statesEqual(state1, state2) {
                return state2 == state1;
            },
            isLocalBlockChain
        });

        console.log('===================[CHECK if one can ONLY vote for ONE time To Process Rest Tokens]===================');
        console.log('     ========== the firstUser vote again( tx should fail ) ==========     ')
        let pendingActions1 = zkApp.reducer.getActions({ fromActionState: Reducer.initialActionsHash });
        try {
            await makeAndSendTransaction({
                feePayerPublicKey: userPubKeyFirst,
                zkAppAddress,
                mutateZkApp() {
                    let voter = userPriKeyFirst;
                    let voteOption = UInt64.from(1);// vote to Burn the extra tokens
                    let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                    zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
                },
                transactionFee,
                signTx(tx: Mina.Transaction) {
                    tx.sign([userPriKeyFirst]);
                },
                async getState() {
                    // get the length of actions list, and compare later to confirm the tx is done!
                    let actionsList = await syncActions(zkAppAddress, isLocalBlockChain);
                    console.log(`Obtaining actions of ${zkAppAddress.toBase58()}: `, JSON.stringify(actionsList));
                    if (actionsList?.length == 0) {
                        await waitBlockHeightToExceed((await syncNetworkStatus(isLocalBlockChain)).blockchainLength.add(1), isLocalBlockChain);
                    }

                    return actionsList!.length;
                },
                statesEqual(state1, state2) {
                    return state2 == state1;
                },
                isLocalBlockChain
            });
        } catch (error) {
            console.log('========== the firstUser vote again, and As Expected, tx failed!!! ==========')
            console.error(error);
        }
        zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
        console.log('ZkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
        expect(zkApp.reducer.getActions({ fromActionState: Reducer.initialActionsHash }).length).toEqual(pendingActions1.length);

        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        let userPubKeySec = userPriKeySec.toPublicKey();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });
        console.log('     =================secUser votes===================     ');
        await makeAndSendTransaction({
            feePayerPublicKey: userPubKeySec,
            zkAppAddress,
            mutateZkApp() {
                let voter = userPriKeySec;
                let voteOption = UInt64.from(1);// vote to Burn the extra tokens
                let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([userPriKeySec]);
            },
            async getState() {
                // get the length of actions list, and compare later to confirm the tx is done!
                let actionsList = await syncActions(zkAppAddress, isLocalBlockChain);
                console.log(`Obtaining actions of ${zkAppAddress.toBase58()}: `, JSON.stringify(actionsList));
                if (actionsList?.length == 0) {
                    await waitBlockHeightToExceed((await syncNetworkStatus(isLocalBlockChain)).blockchainLength.add(1), isLocalBlockChain);
                }

                return actionsList!.length;
            },
            statesEqual(state1, state2) {
                return state2 == state1;
            },
            isLocalBlockChain
        });


        console.log('========================thirdUser starts========================');
        let userPriKeyThird = PrivateKey.random();
        let userPubKeyThird = userPriKeyThird.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('===================[CHECK rollup actions WITHOUT all members\' votes ( tx should fail )]===================');
        // wait for blockheight grows
        await waitBlockHeightToExceed(purchaseEndBlockHeight, isLocalBlockChain);

        zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
        console.log('ZkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
        senderAcctInfo = await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain);

        let actionHashVote0 = zkApp.actionHashVote.get();
        try {
            await makeAndSendTransaction({
                feePayerPublicKey: senderAccount,
                zkAppAddress,
                mutateZkApp() {
                    zkApp.rollupVoteNote();
                },
                transactionFee,
                signTx(tx: Mina.Transaction) {
                    tx.sign([senderKey]);
                },
                getState() {
                    return 0;
                },
                statesEqual(state1, state2) {
                    return false;
                },
                isLocalBlockChain
            });
        } catch (error) {
            console.log('========== rollup actions WITHOUT all members\' votes, and As Expected, tx failed!!! ==========')
            console.error(error);
        }
        zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
        console.log('ZkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
        expect(zkApp.actionHashVote.get()).toEqual(actionHashVote0);

        console.log('     =================thirdUser votes===================     ');
        await makeAndSendTransaction({
            feePayerPublicKey: userPubKeyThird,
            zkAppAddress,
            mutateZkApp() {
                let voter = userPriKeyThird;
                let voteOption = UInt64.from(2);// vote to keep the extra tokens
                let voterMerkleMapWitness = tokenMembersMerkleMap.getWitness(Poseidon.hash(voter.toPublicKey().toFields()));
                zkApp.voteToProcessRestTokens(voter, voteOption, voterMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([userPriKeyThird]);
            },
            async getState() {
                // get the length of actions list, and compare later to confirm the tx is done!
                let actionsList = await syncActions(zkAppAddress, isLocalBlockChain);
                console.log(`Obtaining actions of ${zkAppAddress.toBase58()}: `, JSON.stringify(actionsList));
                if (actionsList?.length == 0) {
                    await waitBlockHeightToExceed((await syncNetworkStatus(isLocalBlockChain)).blockchainLength.add(1), isLocalBlockChain);
                }

                return actionsList!.length;
            },
            statesEqual(state1, state2) {
                return state2 == state1;
            },
            isLocalBlockChain
        });
        zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
        console.log('ZkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));

        // wait for blockheight grows
        await waitBlockHeightToExceed(purchaseEndBlockHeight, isLocalBlockChain);

        await syncActions(zkApp.address, isLocalBlockChain);

        let actionHashVote01 = zkApp.actionHashVote.get();
        await makeAndSendTransaction({
            feePayerPublicKey: senderAccount,
            zkAppAddress,
            mutateZkApp() {
                zkApp.rollupVoteNote();
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey]);
            },
            async getState() {
                zkAppAcctInfo = await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain);
                console.log('ZkAppAcctInfo: ', JSON.stringify(zkAppAcctInfo));
                return zkApp.actionHashVote.get().toString();
            },
            statesEqual(state1, state2) {
                return state2 == state1;
            },
            isLocalBlockChain
        });

        expect(zkApp.actionHashVote.get()).not.toEqual(actionHashVote01);
    });
    // PASS on Berkeley on 0411


    // PASS on BERKELEY 0411
    it(`CHECK transfer custom tokens with proof authorization`, async () => {
        console.log('===================[CHECK transfer custom tokens with proof authorization]===================');

        let tokenId = zkApp.token.id;
        let userPriKey = PrivateKey.random();
        let userPubKey = userPriKey.toPublicKey();
        console.log('userPubKey: ', userPubKey.toBase58());

        let userPriKey1 = PrivateKey.random();
        let userPubKey1 = userPriKey1.toPublicKey();
        console.log('userPubKey1: ', userPubKey1.toBase58());

        // deploy two NormalTokenUser Zkapp
        let tx0 = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount, 2);
            zkApp.deployZkapp(userPubKey, NormalTokenUser._verificationKey!);
            zkApp.deployZkapp(userPubKey1, NormalTokenUser._verificationKey!);
        });
        await tx0.prove();
        tx0.sign([senderKey, userPriKey, userPriKey1]);
        // console.log('deploy NormalTokenUser tx: ', tx0.toJSON());
        let tx0Id = await tx0.send();
        if (tx0Id.hash() == null) {
            throw new Error(`deploy two NormalTokenUser contracts fails, txId.hash:${tx0Id.hash()!}`);
        }
        console.log(`[deploy two NormalTokenUser contracts for two users]'s tx[${tx0Id.hash()!}] sent...`);
        tx0Id.wait({ maxAttempts: 1000 });

        // loop to wait for two NormalTokenUser contracts to deploy done!
        await loopUntilAccountExists({
            address: userPubKey1,
            tokenId,
            eachTimeNotExist() {
                console.log('loop&wait for two NormalTokenUser contracts to deploy...');
            },
            isZkAppAccount: true,
            isLocalBlockChain
        });

        // user purchase token
        await constructOneUserAndPurchase(userPriKey, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });
        // user1 purchase token
        await constructOneUserAndPurchase(userPriKey1, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        let normalTokenUser = new NormalTokenUser(userPubKey, tokenId);
        let tx1 = await Mina.transaction({ sender: userPubKey, fee: transactionFee }, () => {
            let approveSendingCallback = Experimental.Callback.create(
                normalTokenUser,
                'approveTokenTransfer',
                [UInt64.from(1)]
            );
            zkApp.approveTransferCallback(
                userPubKey,
                userPubKey1,
                UInt64.from(1),
                approveSendingCallback
            );
        });
        await tx1.prove();
        tx1.sign([userPriKey]);
        console.log('approveTokenTransfer\'s tx:', tx1.toJSON());
        let tx1Id = await tx1.send();
        console.log(`[transfer token by proof-auth from one user to another user]'s tx[${tx1Id.hash()!}] sent...`);
        tx1Id.wait({ maxAttempts: 1000 });

        expect((await syncAcctInfo(userPubKey, tokenId, isLocalBlockChain)).balance.value.toBigInt()).toEqual(1n);
        expect((await syncAcctInfo(userPubKey1, tokenId, isLocalBlockChain)).balance.value.toBigInt()).toEqual(3n);

        console.log('========== [END]CHECK transfer custom tokens with proof authorization ==========');
    })
    // PASS on BERKELEY 0411



    // PASS on BERKELEY 0411
    it('CHECK \'Delegate\' cannot be set by Signature auth', async () => {
        console.log('===================[CHECK \'Delegate\' cannot be set by Signature auth]===================');
        let delegate0 = zkApp.account.delegate.get();
        console.log('delegate0: ', delegate0.toBase58());
        try {
            let tx = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                let accupdt = AccountUpdate.create(zkAppAddress);
                let onePriKey = PrivateKey.random();
                let onePublicKey = onePriKey.toPublicKey();
                accupdt.account.delegate.set(onePublicKey);
            });
            tx.sign([senderKey, zkAppPrivateKey]);
            let txId = await tx.send();
            console.log('txId.isSuccess', txId.isSuccess);
            txId.wait({ maxAttempts: 1000 });
            console.log('delegate1: ', zkApp.account.delegate.get().toBase58());

        } catch (error) {
            console.log('========== As Expected, tx failed, \'Delegate\' cannot be set by Signature auth ==========');
            console.error(error);
        }
        expect(zkApp.account.delegate.get()).toEqual(delegate0);
        console.log('========== [END]CHECK \'Delegate\' cannot be set by Signature auth ==========');
    });
    // PASS on BERKELEY 0411

    // PASS on BERKELEY 0411
    it('CHECK \'Burn\' custom token', async () => {
        console.log('===================[CHECK \'Burn\' custom token]===================');
        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 1 * 1e9 });
        });

        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 1 * 1e9 });
        });

        console.log('========================thirdUser starts========================');
        let userPriKeyThird = PrivateKey.random();
        let thirdUserPurchaseAmount = maximumPurchasingAmount.sub(1);// to make totalAmountInCirculation < SUPPLY
        await constructOneUserAndPurchase(userPriKeyThird, thirdUserPurchaseAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 1 * 1e9 });
        });

        // try to burn tokens
        try {
            let tx0 = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
                zkApp.burnTokens(userPriKeySec.toPublicKey(), UInt64.from(1));
            });
            await tx0.prove();
            tx0.sign([senderKey, userPriKeySec]);
            let txId0 = await tx0.send();
            console.log('txId.isSuccess', txId0.isSuccess);
            txId0.wait({ maxAttempts: 1000 });
        } catch (error) {
            console.log('======== As Expected, tx failed, if user burn tokens WITHOUT totalAmountInCirculation == SUPPLY ========');
            console.error(error);
        }

        console.log('========================forthUser starts========================');
        let userPriKeyForth = PrivateKey.random();
        let forthUserPurchaseAmount = UInt64.from(1);// to make totalAmountInCirculation == SUPPLY
        await constructOneUserAndPurchase(userPriKeyForth, forthUserPurchaseAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 1 * 1e9 });
        });

        // try to burn tokens
        let tx01 = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            zkApp.burnTokens(userPriKeySec.toPublicKey(), UInt64.from(1));
        });
        await tx01.prove();
        tx01.sign([senderKey, userPriKeySec]);
        let txId01 = await tx01.send();
        console.log('txId01.isSuccess', txId01.isSuccess);
        txId01.wait({ maxAttempts: 1000 });

        console.log('======== As Expected, tx failed, if user burn tokens WITH totalAmountInCirculation == SUPPLY ========');
        console.log('========== [END]CHECK \'Burn\' custom token ==========');
    });
    // PASS on BERKELEY 0411

});
