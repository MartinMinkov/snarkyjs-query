import { AccountUpdate, fetchAccount, fetchLastBlock, Field, isReady, MerkleMap, Mina, Poseidon, PrivateKey, PublicKey, shutdown, Types } from 'snarkyjs';
import { Membership } from './Membership.js';
import { loopUntilAccountExists, makeAndSendTransaction } from './utils.js';

describe('test fuctions inside Membership', () => {
    let Blockchain: any;
    let transactionFee = 100_000_000;
    let senderAccount: PublicKey,
        senderKey: PrivateKey,
        zkAppVerificationKey: any,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkApp: Membership,
        membershipMerkleMap: MerkleMap;


    let senderAcctInfo: Types.Account | undefined;

    async function syncNetworkStatus() {
        if (process.env.TEST_ON_BERKELEY! == 'true') {
            await fetchLastBlock();
            console.log('sync Berkeley Network status: done!');
        }
        console.log('current network state: ', JSON.stringify(Mina.activeInstance.getNetworkState()));
        return Mina.activeInstance.getNetworkState();
    }

    async function syncAcctInfo(acctAddr: PublicKey) {
        let acctInfo: Types.Account | undefined;
        if (process.env.TEST_ON_BERKELEY! == 'true') {
            acctInfo = (await fetchAccount({ publicKey: acctAddr })).account!;
        } else {
            acctInfo = Mina.activeInstance.getAccount(acctAddr);
        }

        return acctInfo;
    }

    beforeAll(async () => {
        await isReady;

        zkAppVerificationKey = (await Membership.compile()).verificationKey;

        Blockchain = process.env.TEST_ON_BERKELEY! == 'true' ? Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive.berkeley.minaexplorer.com/',
        }) : Mina.LocalBlockchain({ proofsEnabled: true });
        Mina.setActiveInstance(Blockchain);
    });

    afterAll(() => {
        setInterval(shutdown, 0);
    });

    beforeEach(async () => {
        await syncNetworkStatus();

        if (process.env.TEST_ON_BERKELEY! == 'true') {// Berkeley
            senderKey = PrivateKey.random();//PrivateKey.fromBase58('EKDmWEWjC6UampzAph9ddAbnmuBgHAfiQhAmSVT6ACJgPFzCsoTW');
            senderAccount = senderKey.toPublicKey();//    pubKey:  B62qkvenQ4bZ5qt5QJN8bmEq92KskKH4AZP7pgbMoyiMAccWTWjHRoD

            console.log(`Funding fee payer ${senderAccount.toBase58()} and waiting for inclusion in a block..`);
            await Mina.faucet(senderAccount);
            await loopUntilAccountExists({
                address: senderAccount,
                eachTimeNotExist: () => { console.log('[loopUntilAccountExists] senderAccount is still not exiting, loop&wait...'); },
                isZkAppAccount: false,
                isLocalBlockChain: false
            });
            console.log('senderAccount is funded!');

        } else {// Local
            ({ privateKey: senderKey, publicKey: senderAccount } = Blockchain.testAccounts[0]);
        }

        console.log(`senderKey: ${senderKey.toBase58()}, senderAccount: ${senderAccount.toBase58()}`);
        senderAcctInfo = await syncAcctInfo(senderAccount);
        let { nonce, balance } = senderAcctInfo;
        console.log(`initially, senderAccount.nonce: ${nonce}, senderAccount.balance: ${balance}`);

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new Membership(zkAppAddress);
        console.log('zkAppAddress: ', zkAppAddress.toBase58());

        // deploy zkApp
        console.log(`Membership Contract: deploying...`);
        let tx_deployMembership = await Mina.transaction({ sender: senderAccount, fee: transactionFee }, () => {
            AccountUpdate.fundNewAccount(senderAccount);
            zkApp.deploy({ zkappKey: zkAppPrivateKey, verificationKey: zkAppVerificationKey });
        });
        let txId_deployMembership = await tx_deployMembership.sign([senderKey]).send();
        console.log(`Membership Contract: deployment tx[${txId_deployMembership.hash()!}] sent...`);
        await txId_deployMembership.wait({ maxAttempts: 1000 });
        console.log(`Membership Contract: txId.isSuccess:`, txId_deployMembership.isSuccess);

        // loop to wait for membership contract to deploy done!
        await loopUntilAccountExists({
            address: zkAppAddress, eachTimeNotExist() {
                console.log('loop&wait for membership contract to deploy...');
            }, isZkAppAccount: true, isLocalBlockChain: !(process.env.TEST_ON_BERKELEY! == 'true')
        });
        console.log(`Membership Contract: deployment done!`);

        membershipMerkleMap = new MerkleMap();
        const merkleRoot0 = membershipMerkleMap.getRoot();
        console.log(`membershipMerkleMap's initial root: ${merkleRoot0.toString()}`);
    });

    it(`CHECK tx should succeed when store an non-existing user, AND fail when store an existing user`, async () => {
        console.log('===================[CHECK tx should succeed when store an non-existing user]===================');

        let oneUserPriKey = PrivateKey.random();
        let oneUserPubKey = oneUserPriKey.toPublicKey();
        console.log(`oneUserPriKey: ${oneUserPriKey.toBase58()},  oneUserPubKey: ${oneUserPubKey.toBase58()}`)

        // get witness for existence
        let indx = Poseidon.hash(oneUserPubKey.toFields());
        let oneUserValue = membershipMerkleMap.get(indx);
        console.log(`oneUserValue: ${oneUserValue.toString()}`);
        let oneUserMerkleMapWitness = membershipMerkleMap.getWitness(indx);

        // construct a tx and send
        await makeAndSendTransaction({
            feePayerPublicKey: senderKey.toPublicKey(),
            zkAppAddress,
            mutateZkApp() {
                zkApp.addNewMember(oneUserPubKey, oneUserMerkleMapWitness);
            },
            transactionFee,
            signTx(tx: Mina.Transaction) {
                tx.sign([senderKey]);
            },
            getState() {
                return zkApp.memberCount.get();
            },
            statesEqual(state1, state2) {
                return state2.equals(state1).toBoolean();
            },
            isLocalBlockChain: !(process.env.TEST_ON_BERKELEY! == 'true')

        });
        // store the user
        membershipMerkleMap.set(indx, Field(1));
        expect(zkApp.memberTreeRoot.get()).toEqual(membershipMerkleMap.getRoot());
        console.log('===================As Expected, tx succeed when store an non-existing user===================');


        console.log('===================[CHECK tx should fail when store an existing user]===================');
        // get witness for existence
        oneUserMerkleMapWitness = membershipMerkleMap.getWitness(indx);
        let merkleRoot0 = membershipMerkleMap.getRoot();
        try {
            // construct a tx and send
            await makeAndSendTransaction({
                feePayerPublicKey: senderKey.toPublicKey(),
                zkAppAddress,
                mutateZkApp() {
                    zkApp.addNewMember(oneUserPubKey, oneUserMerkleMapWitness);
                },
                transactionFee,
                signTx(tx: Mina.Transaction) {
                    tx.sign([senderKey]);
                },
                getState() {
                    return zkApp.memberCount.get();
                },
                statesEqual(state1, state2) {
                    return state2.equals(state1).toBoolean();
                },
                isLocalBlockChain: !(process.env.TEST_ON_BERKELEY! == 'true')

            });
        } catch (error) {
            console.log('===================As Expected, tx fails when store an existing user===================');
            console.error(error);
        }
        // store the user
        expect(zkApp.memberTreeRoot.get()).toEqual(merkleRoot0);
    });
});