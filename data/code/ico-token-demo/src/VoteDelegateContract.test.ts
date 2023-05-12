import { AccountUpdate, Bool, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, Types, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract } from './XTokenContract.js';
import { Membership } from './Membership.js';
import { VoteZkProgram, VoteState } from "./vote.js";
import { VoteDelegateContract } from './VoteDelegateContract.js';
import { loopUntilAccountExists, makeAndSendTransaction, syncNetworkStatus, syncAcctInfo, syncActions, waitBlockHeightToExceed } from './utils.js';

describe('test fuctions inside VoteDelegateContract', () => {
    let isLocalBlockChain = !(process.env.TEST_ON_BERKELEY! == 'true');

    let Blockchain: any;
    let transactionFee = 100_000_000;
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

    let voteDelegateContractPrivateKey: PrivateKey;
    let voteDelegateContractAddress: PublicKey;
    let voteDelegateContract: VoteDelegateContract;
    let voteDelegateContractVerificationKey: any;
    let voterNullifierMerkleMap: MerkleMap;

    let voteZkProgramVerificationKey: any;

    let purchaseStartBlockHeight: UInt32;
    let purchaseEndBlockHeight: UInt32;
    let tokenSupply: UInt64;
    let maximumPurchasingAmount: UInt64;

    let newDelegateTargetKey: PrivateKey;
    let newDelegateTargetAddress: PublicKey;

    async function syncAllAccountInfo() {
        console.log('current senderAcctInfo: ', JSON.stringify(await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain)));
        console.log('current membershipAcctInfo: ', JSON.stringify(await syncAcctInfo(membershipZkAppAddress, Field(1), isLocalBlockChain)));
        console.log('current zkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain)));
        console.log('current voteDelegateContractAcctInfo: ', JSON.stringify(await syncAcctInfo(voteDelegateContractAddress, Field(1), isLocalBlockChain)));
    }

    const constructOneUserAndPurchase = async (userPriKey: PrivateKey, purchaseAmount0: UInt64, prePurchaseCallback: any) => {
        await syncAllAccountInfo();

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

        await syncAllAccountInfo();
    }

    beforeAll(async () => {
        await isReady;

        Blockchain = process.env.TEST_ON_BERKELEY! == 'true' ? Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive.berkeley.minaexplorer.com/',
        }) : Mina.LocalBlockchain({ proofsEnabled: true });
        Mina.setActiveInstance(Blockchain);

        membershipVerificationKey = (await Membership.compile()).verificationKey;
        console.log(`Membership.compile done!`);

        zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
        console.log(`XTokenContract.compile done!`);

        voteZkProgramVerificationKey = await VoteZkProgram.compile();
        console.log(`VoteZkProgram.compile done!`);

        voteDelegateContractVerificationKey = (await VoteDelegateContract.compile()).verificationKey;
        console.log(`VoteDelegateContract.compile done!`);

    });

    afterAll(() => {
        setInterval(shutdown, 0);
    });

    beforeEach(async () => {
        await syncNetworkStatus(isLocalBlockChain);

        if (process.env.TEST_ON_BERKELEY! == 'true') {// Berkeley
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
        let { nonce, balance } = await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain);
        console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);

        membershipZkAppPrivateKey = PrivateKey.random();
        membershipZkAppAddress = membershipZkAppPrivateKey.toPublicKey();
        membershipZkApp = new Membership(membershipZkAppAddress);
        console.log('membershipZkApp\'s PrivateKey: ', membershipZkAppPrivateKey.toBase58(), ' ,  membershipZkApp\'s Address: ', membershipZkAppAddress.toBase58());

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new XTokenContract(zkAppAddress);
        console.log('xTokenContractZkApp\'s PrivateKey: ', zkAppPrivateKey.toBase58(), ' , xTokenContractZkApp\'s Address: ', zkAppAddress.toBase58());

        voteDelegateContractPrivateKey = PrivateKey.random();
        voteDelegateContractAddress = voteDelegateContractPrivateKey.toPublicKey();
        voteDelegateContract = new VoteDelegateContract(voteDelegateContractAddress);
        console.log('voteDelegateContract\'s PrivateKey: ', voteDelegateContractPrivateKey.toBase58(), ' , voteDelegateContract\'s Address: ', voteDelegateContractAddress.toBase58());

        // init appStatus values
        purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
        purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(icoBlocksRangeWindow);// TODO
        tokenSupply = UInt64.from(6);
        maximumPurchasingAmount = UInt64.from(2);

        newDelegateTargetKey = PrivateKey.random();
        newDelegateTargetAddress = newDelegateTargetKey.toPublicKey();
        console.log('newDelegateTarget\'s PrivateKey: ', voteDelegateContractPrivateKey.toBase58(), ' , newDelegateTarget\'s Address: ', newDelegateTargetAddress.toBase58());

        // TODO to confirm if need deploy token each time
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
            address: membershipZkAppAddress, eachTimeNotExist() {
                console.log('loop&wait for membership contract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain
        });
        console.log(`Membership Contract: deployment done!`);

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
            address: zkAppAddress, eachTimeNotExist() {
                console.log('loop&wait for XTokenContract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain
        });
        console.log(`xTokenContract: deployment done!`);

        console.log(`VoteDelegateContract: deploying...`);
        // deploy VoteDelegateContract
        let tx_deployVoteDelegateContract = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount);
            voteDelegateContract.deploy({ zkappKey: voteDelegateContractPrivateKey, verificationKey: voteDelegateContractVerificationKey });
        });
        let txId_deployVoteDelegateContract = await tx_deployVoteDelegateContract.sign([senderKey]).send();
        console.log(`VoteDelegateContract: deployment tx[${txId_deployVoteDelegateContract.hash()!}] sent...`);
        await txId_deployVoteDelegateContract.wait({ maxAttempts: 1000 });
        console.log(`voteDelegateContract: txId.isSuccess:`, txId_deployVoteDelegateContract.isSuccess);

        // loop to wait for VoteDelegateContract to deploy done!
        await loopUntilAccountExists({
            address: voteDelegateContractAddress, eachTimeNotExist() {
                console.log('loop&wait for VoteDelegateContract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain
        });
        console.log(`VoteDelegateContract: deployment done!`);

        await syncAllAccountInfo();

        tokenMembersMerkleMap = new MerkleMap();
        const merkleRoot0 = tokenMembersMerkleMap.getRoot();
        console.log(`tokenMembersMerkleMap's initial root: ${merkleRoot0.toString()}`);

        voterNullifierMerkleMap = new MerkleMap();
        const voterNullifierMerkleMapRoot0 = voterNullifierMerkleMap.getRoot();
        console.log(`voterNullifierMerkleMap's initial root: ${voterNullifierMerkleMapRoot0.toString()}`);

        await syncNetworkStatus(isLocalBlockChain);

        // initialize or reset XTokenContract & MembershipZkApp & VoteDelegateContract
        console.log(`trigger all contracts to initialize...`);
        console.log(`
            ================ params for xTokenContract: 
            tokenSupply: ${tokenSupply.toString()},\n
            maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
            purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()},\n

            ================ params for voteDelegateContract: 
            zkAppAddress: ${zkAppAddress.toBase58()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            newDelegateTargetAddress: ${newDelegateTargetAddress.toBase58()}\n
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

                voteDelegateContract.initOrReset(zkAppAddress, membershipZkAppAddress, new MerkleMap().getRoot(), newDelegateTargetAddress, voteDelegateContractPrivateKey);

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

        console.log(`wait for 2 blocks...`);
        await waitBlockHeightToExceed((await syncNetworkStatus()).blockchainLength.add(2));

        // fetch events to confirm         
        let events = await voteDelegateContract.fetchEvents(purchaseStartBlockHeight);
        console.log(`fetchEvents(${purchaseStartBlockHeight.toString()}): `, JSON.stringify(events));
        expect(events.filter((e) => {
            return e.type == 'init-delegate-target'
        })[0].event.data).toEqual(newDelegateTargetAddress);
        console.log(`trigger voteDelegateContract.initOrReset(*): tx confirmed!`);

        await syncAllAccountInfo();

        const tokenSymbol = Blockchain.getAccount(zkAppAddress).tokenSymbol;
        expect(tokenSymbol).toEqual('XTKN');

        const zkAppUri = Blockchain.getAccount(zkAppAddress).zkapp?.zkappUri;
        expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
    });

    it(`CHECK all members (recursively) votes to set delegate`, async () => {
        console.log('===================[CHECK all members votes to set delegate]===================');

        console.log('========================firstUser starts========================');
        let userPriKeyFirst = PrivateKey.random();
        let userPubKeyFirst = userPriKeyFirst.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });
        console.log('========================secUser starts========================');
        let userPriKeySec = PrivateKey.random();
        let userPubKeySec = userPriKeySec.toPublicKey();
        await constructOneUserAndPurchase(userPriKeySec, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        console.log('========================thirdUser starts========================');
        let userPriKeyThird = PrivateKey.random();
        let userPubKeyThird = userPriKeyThird.toPublicKey();
        await constructOneUserAndPurchase(userPriKeyThird, maximumPurchasingAmount.sub(1), (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, 2);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        // wait for blockheight grows
        await waitBlockHeightToExceed(purchaseEndBlockHeight, isLocalBlockChain);

        console.log('======================== start recursively voting========================');
        console.log('zkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain)));
        console.log('voteDelegateContractAcctInfo: ', JSON.stringify(await syncAcctInfo(voteDelegateContractAddress, Field(1), isLocalBlockChain)));

        let delegate0 = zkApp.account.delegate.get();
        console.log('original delegate address: ', delegate0.toBase58());

        console.log('new delegate address: ', voteDelegateContract.targetDelegateTo.get().toBase58());

        console.log('making zero_proof... ');
        const vote0 = VoteState.newVote(tokenMembersMerkleMap.getRoot());
        const proof0 = await VoteZkProgram.create(vote0);

        console.log('making proof 1 - userPriKeyFirst...');
        const nullifierKey1 = Poseidon.hash(userPriKeyFirst.toFields());
        const nullifierWitness1 = voterNullifierMerkleMap.getWitness(nullifierKey1)
        const tokenMembersWitness1 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeyFirst.toFields()));

        const vote1 = VoteState.applyVote(vote0, Bool(true), userPriKeyFirst, tokenMembersWitness1, nullifierWitness1);
        const proof1 = await VoteZkProgram.applyVote(vote1, proof0, Bool(true), userPriKeyFirst, tokenMembersWitness1, nullifierWitness1);
        voterNullifierMerkleMap.set(nullifierKey1, Field(1));

        console.log('making proof 2 - userPriKeySec...');
        const nullifierKey2 = Poseidon.hash(userPriKeySec.toFields());
        const nullifierWitness2 = voterNullifierMerkleMap.getWitness(nullifierKey2)
        const tokenMembersWitness2 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeySec.toFields()));

        const vote2 = VoteState.applyVote(vote1, Bool(true), userPriKeySec, tokenMembersWitness2, nullifierWitness2);
        const proof2 = await VoteZkProgram.applyVote(vote2, proof1, Bool(true), userPriKeySec, tokenMembersWitness2, nullifierWitness2);
        voterNullifierMerkleMap.set(nullifierKey2, Field(1));

        console.log('making proof 3 - userPriKeyThird...');
        const nullifierKey3 = Poseidon.hash(userPriKeyThird.toFields());
        const nullifierWitness3 = voterNullifierMerkleMap.getWitness(nullifierKey3)
        const tokenMembersWitness3 = tokenMembersMerkleMap.getWitness(Poseidon.hash(userPubKeyThird.toFields()));

        const vote3 = VoteState.applyVote(vote2, Bool(true), userPriKeyThird, tokenMembersWitness3, nullifierWitness3);
        const proof3 = await VoteZkProgram.applyVote(vote3, proof2, Bool(true), userPriKeyThird, tokenMembersWitness3, nullifierWitness3);
        voterNullifierMerkleMap.set(nullifierKey3, Field(1));

        console.log(`[recursively voting] start...`);
        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                voteDelegateContract.voteDelegateTo(zkAppPrivateKey, proof3);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey]);
            },
            getState() {
                return zkApp.account.delegate.get();
            },
            statesEqual(state1, state2) {
                console.log('state1: ', state1, '  state2: ', state2);
                return state2.equals(state1).toBoolean();
            },
            isLocalBlockChain

        });
        console.log('ZkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain)));
        console.log('voteDelegateContractAcctInfo: ', JSON.stringify(await syncAcctInfo(voteDelegateContractAddress, Field(1), isLocalBlockChain)));
        expect(zkApp.account.delegate.get()).not.toEqual(delegate0);
        expect(zkApp.account.delegate.get()).toEqual(voteDelegateContract.targetDelegateTo.get());

        // fetch events to confirm        
        console.log(`wait for 2 blocks...`);
        await waitBlockHeightToExceed((await syncNetworkStatus()).blockchainLength.add(2));
        let events = await zkApp.fetchEvents(purchaseEndBlockHeight);
        console.log(`fetchEvents(${purchaseEndBlockHeight.toString()}): `, JSON.stringify(events));

        expect(events.filter((e) => {
            return e.type == 'set-delegate'
        })[0].event.data).toEqual(newDelegateTargetAddress);

        console.log(`trigger voteDelegateContract.voteDelegateTo(*): tx confirmed!`);

        // 
    });

});