import { AccountUpdate, fetchTransactionStatus, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, UInt32, UInt64 } from 'snarkyjs';
import { XTokenContract } from './XTokenContract.js';
import { Membership } from './Membership.js';
import { ConsumerContract } from './ConsumerContract.js';
import { loopUntilAccountExists, makeAndSendTransaction, syncNetworkStatus, syncAcctInfo, waitBlockHeightToExceed } from './utils.js';

describe('test fuctions inside ConsumerContract', () => {
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

    let consumerContractPrivateKey: PrivateKey;
    let consumerContractAddress: PublicKey;
    let consumerContract: ConsumerContract;
    let consumerContractVerificationKey: any;

    let purchaseStartBlockHeight: UInt32;
    let purchaseEndBlockHeight: UInt32;
    let tokenSupply: UInt64;
    let maximumPurchasingAmount: UInt64;

    async function syncAllAccountInfo() {
        console.log('current senderAcctInfo: ', JSON.stringify(await syncAcctInfo(senderAccount, Field(1), isLocalBlockChain)));
        console.log('current membershipAcctInfo: ', JSON.stringify(await syncAcctInfo(membershipZkAppAddress, Field(1), isLocalBlockChain)));
        console.log('current zkAppAcctInfo: ', JSON.stringify(await syncAcctInfo(zkAppAddress, Field(1), isLocalBlockChain)));
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
            isLocalBlockChain: isLocalBlockChain

        });
        // store the user
        tokenMembersMerkleMap.set(indx, Field(1));

        await syncAllAccountInfo();
    }

    beforeAll(async () => {
        await isReady;

        Blockchain = isLocalBlockChain ? Mina.LocalBlockchain({ proofsEnabled: true }) : Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive.berkeley.minaexplorer.com/',
        });
        Mina.setActiveInstance(Blockchain);

        membershipVerificationKey = (await Membership.compile()).verificationKey;
        console.log(`Membership.compile done!`);

        zkAppVerificationKey = (await XTokenContract.compile()).verificationKey;
        console.log(`XTokenContract.compile done!`);

        consumerContractVerificationKey = (await ConsumerContract.compile()).verificationKey;
        console.log(`ConsumerContract.compile done!`);
    });

    afterAll(() => {
        setInterval(shutdown, 0);
    });

    beforeEach(async () => {
        await syncNetworkStatus(isLocalBlockChain);

        if (!isLocalBlockChain) {// Berkeley
            senderKey = PrivateKey.random();
            senderAccount = senderKey.toPublicKey();

            console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
            await Mina.faucet(senderAccount);
            console.log('Mina.faucet...');
            await loopUntilAccountExists({
                address: senderAccount,
                eachTimeNotExist: () => { console.log('[loopUntilAccountExists] senderAccount is still not exiting, loop&wait...'); },
                isZkAppAccount: false,
                isLocalBlockChain: isLocalBlockChain
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

        consumerContractPrivateKey = PrivateKey.random();
        consumerContractAddress = consumerContractPrivateKey.toPublicKey();
        consumerContract = new ConsumerContract(consumerContractAddress);
        console.log('consumerContract\'s PrivateKey: ', consumerContractPrivateKey.toBase58(), ' , consumerContract\'s Address: ', consumerContractAddress.toBase58());

        // init appStatus values
        purchaseStartBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength;
        purchaseEndBlockHeight = Mina.activeInstance.getNetworkState().blockchainLength.add(icoBlocksRangeWindow);
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
            address: membershipZkAppAddress, eachTimeNotExist() {
                console.log('loop&wait for membership contract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain: isLocalBlockChain
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
            }, isZkAppAccount: true, isLocalBlockChain: isLocalBlockChain
        });
        console.log(`xTokenContract: deployment done!`);

        console.log(`ConsumerContract: deploying...`);
        // deploy ConsumerContract
        let tx_deployConsumerContract = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount);
            consumerContract.deploy({ zkappKey: consumerContractPrivateKey, verificationKey: consumerContractVerificationKey });
        });
        let txId_deployConsumerContract = await tx_deployConsumerContract.sign([senderKey]).send();
        console.log(`ConsumerContract: deployment tx[${txId_deployConsumerContract.hash()!}] sent...`);
        await txId_deployConsumerContract.wait({ maxAttempts: 1000 });
        console.log(`consumerContract: txId.isSuccess:`, txId_deployConsumerContract.isSuccess);

        // loop to wait for ConsumerContract to deploy done!
        await loopUntilAccountExists({
            address: consumerContractAddress, eachTimeNotExist() {
                console.log('loop&wait for ConsumerContract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain: isLocalBlockChain
        });
        console.log(`ConsumerContract: deployment done!`);

        // await syncAllAccountInfo();

        tokenMembersMerkleMap = new MerkleMap();
        const merkleRoot0 = tokenMembersMerkleMap.getRoot();
        console.log(`tokenMembersMerkleMap's initial root: ${merkleRoot0.toString()}`);

        await syncNetworkStatus(isLocalBlockChain);

        // initialize or reset XTokenContract & MembershipZkApp & ConsumerContract
        console.log(`trigger all contracts to initialize...`);
        console.log(`
            ================ params for xTokenContract: 
            tokenSupply: ${tokenSupply.toString()},\n
            maximumPurchasingAmount: ${maximumPurchasingAmount.toString()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            purchaseStartBlockHeight: ${purchaseStartBlockHeight.toString()},\n
            purchaseEndBlockHeight: ${purchaseEndBlockHeight.toString()},\n

            ================ params for consumerContract: 
            zkAppAddress: ${zkAppAddress.toBase58()},\n
            membershipZkAppAddress: ${membershipZkAppAddress.toBase58()},\n
            consumerContractAddress: ${consumerContractAddress.toBase58()}\n
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

                consumerContract.initOrReset(zkAppAddress, UInt64.from(1), consumerContractPrivateKey);
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
            isLocalBlockChain: isLocalBlockChain
        });

        await syncAllAccountInfo();

        const tokenSymbol = Blockchain.getAccount(zkAppAddress).tokenSymbol;
        expect(tokenSymbol).toEqual('XTKN');

        const zkAppUri = Blockchain.getAccount(zkAppAddress).zkapp?.zkappUri;
        expect(zkAppUri).toEqual('https://github.com/coldstar1993/mina-zkapp-e2e-testing');
    });

    it(`Check thirdpart zkapp could successfully transfer custom token by holders' signature from XTokenContract.`, async () => {
        console.log('===================[CHECK consume tokens]===================');

        let userPriKeyFirst = PrivateKey.random();
        let userPubKeyFirst = userPriKeyFirst.toPublicKey();
        let purchaseAmount = 2;
        await constructOneUserAndPurchase(userPriKeyFirst, maximumPurchasingAmount, (senderAccount0: PublicKey, userPriKey0: PrivateKey) => {
            let accUpdt = AccountUpdate.fundNewAccount(senderAccount0, purchaseAmount);
            accUpdt.send({ to: userPriKey0.toPublicKey(), amount: 3 * 1e9 });
        });

        // wait for blockheight grows
        console.log('============== the user purchses token done ==============');
        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                AccountUpdate.fundNewAccount(senderAccount);
                consumerContract.consume(userPubKeyFirst);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey, userPriKeyFirst]);
            },
            async getState() {
                let consumerContractAcctInfo = await syncAcctInfo(consumerContractAddress, zkApp.token.id, isLocalBlockChain);
                console.log('consumerContractAcctInfo: ', JSON.stringify(consumerContractAcctInfo));
                if (consumerContractAcctInfo == undefined) {
                    return '0';
                }
                return consumerContractAcctInfo.balance.toString();
            },
            statesEqual(state1, state2) {
                return state1 == state2;
            },
            isLocalBlockChain
        });
        // await waitBlockHeightToExceed((await syncNetworkStatus()).blockchainLength.add(2));// enough to wait for 2 blocks on Berkeley
        let userAcctInfo = await syncAcctInfo(userPubKeyFirst, zkApp.token.id, isLocalBlockChain);
        console.log('userAcctInfo: ', JSON.stringify(userAcctInfo));
        let consumerContractAcctInfo = await syncAcctInfo(consumerContractAddress, zkApp.token.id, isLocalBlockChain);
        console.log('consumerContractAcctInfo: ', JSON.stringify(consumerContractAcctInfo));
        expect(consumerContractAcctInfo.balance).toEqual(UInt64.from(1));
    });

});