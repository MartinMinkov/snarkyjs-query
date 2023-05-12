// use this file to test the noobToken actions

import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Permissions,
  fetchAccount,
  Field,
} from 'snarkyjs';
import { NoobToken } from '../noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import {
  getFriendlyDateTime,
  fetchAndLoopEvents,
  fetchAndLoopAccount,
} from '../utils/utils';
import { saveVerificationKey } from '../utils/generateVerificationKey';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const isBerkeley = true;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test-actions', () => {
  async function runTests(deployToBerkeley: boolean = isBerkeley) {
    let Blockchain;
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      senderAccount: PublicKey,
      senderKey: PrivateKey,
      zkAppAddress: PublicKey,
      zkAppPrivateKey: PrivateKey,
      zkApp: NoobToken,
      zkAppBPrivateKey: PrivateKey,
      zkAppBAddress: PublicKey,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey,
      zkAppVerificationKey: { data: string; hash: Field } | undefined;

    beforeAll(async () => {
      await isReady;

      // choosing which Blockchain to use
      console.log('choosing blockchain');
      Blockchain = deployToBerkeley
        ? Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive-node-api.p42.xyz/',
          })
        : Mina.LocalBlockchain({ proofsEnabled });

      Mina.setActiveInstance(Blockchain);

      // choosing deployer account
      if (deployToBerkeley) {
        type Config = {
          deployAliases: Record<string, { url: string; keyPath: string }>;
        };
        let configJson: Config = JSON.parse(
          await fs.readFile('config.json', 'utf8')
        );
        // berkeley key hardcoded here
        let config = configJson.deployAliases['noobtokenaction'];
        let key: { privateKey: string } = JSON.parse(
          await fs.readFile(config.keyPath, 'utf8')
        );
        deployerKey = PrivateKey.fromBase58(key.privateKey);
        deployerAccount = deployerKey.toPublicKey();

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        zkApp = new NoobToken(zkAppAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({
          privateKey: deployerKey,
          publicKey: deployerAccount,
        } = Local.testAccounts[0]);

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        zkApp = new NoobToken(zkAppAddress);
      }
    }, 1000000);

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    async function localDeploy() {
      console.log('compiling...');

      let txn;
      try {
        ({ verificationKey: zkAppVerificationKey } = await NoobToken.compile());
      } catch (e) {
        console.log('error compiling zkapp', e);
      }

      if (zkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(deployerAccount, () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          AccountUpdate.createSigned(deployerAccount);
          zkApp.deploy({
            verificationKey: zkAppVerificationKey,
            zkappKey: zkAppPrivateKey,
          });
        });
        await saveVerificationKey(
          zkAppVerificationKey.hash,
          zkAppVerificationKey.data,
          'action',
          zkAppAddress,
          zkAppPrivateKey
        );
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        await (await txn.sign([deployerKey, zkAppPrivateKey]).send()).wait();
        console.log('deployed local zkApp', zkAppAddress.toBase58());
      }
      return zkAppVerificationKey;
    }

    async function berkeleyDeploy() {
      console.log('calling faucet...');
      try {
        await Mina.faucet(deployerAccount);
      } catch (e) {
        console.log('error calling faucet', e);
      }
      console.log('waiting for account to exist...');
      try {
        await loopUntilAccountExists({
          account: deployerAccount,
          eachTimeNotExist: () =>
            console.log(
              'waiting for deployerAccount account to be funded...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: false,
        });
      } catch (e) {
        console.log('error waiting for deployerAccount to exist', e);
      }
      console.log('compiling...');
      let { verificationKey: zkAppVerificationKey } = await NoobToken.compile();
      await saveVerificationKey(
        zkAppVerificationKey.hash,
        zkAppVerificationKey.data,
        'action',
        zkAppAddress,
        zkAppPrivateKey
      );
      console.log('generating deploy transaction');
      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 1.1e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy({
            verificationKey: zkAppVerificationKey,
            zkappKey: zkAppPrivateKey,
          });
        }
      );
      console.log('generating proof');
      await txn.prove();

      console.log('signing transaction');
      txn.sign([deployerKey, zkAppPrivateKey]);
      let response = await txn.send();
      console.log('response from deploy txn', response);
      console.log('generated deploy txn for zkApp', zkAppAddress.toBase58());
      return zkAppVerificationKey;
    }

    async function printBalances() {
      try {
        console.log(
          `deployerAccount balance: ${deployerAccount.toBase58()} ${Mina.getBalance(
            deployerAccount
          ).div(1e9)} MINA`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `zkApp balance: ${zkAppAddress.toBase58()} ${Mina.getBalance(
            zkAppAddress
          ).div(1e9)} MINA`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `zkApp balance of NOOB token: ${zkAppAddress.toBase58()} ${Mina.getBalance(
            zkAppAddress,
            zkApp.token.id
          ).div(1e9)} NOOB`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `receiver balance of Noob token: ${receiverAddress.toBase58()} ${Mina.getBalance(
            receiverAddress,
            zkApp.token.id
          ).div(1e9)} NOOB`
        );
      } catch (e) {
        console.log('error printing balances');
      }
    }

    // ------------------------------------------------------------------------
    // deploy zkApp and initialize
    // status: working
    // confirmed: true
    // dependencies: none
    it(`1. checking that zkAppVerificationKey gets deployed correctly - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('checking that zkAppVerificationKey gets deployed correctly');

      let zkAppVerificationKey = deployToBerkeley
        ? await berkeleyDeploy()
        : await localDeploy();

      if (isBerkeley) {
        // wait for the account to exist
        await loopUntilAccountExists({
          account: zkAppAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for zkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });
      }

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let actualVerificationKey = Mina.getAccount(zkAppAddress).zkapp
        ?.verificationKey;

      expect(actualVerificationKey?.hash).toEqual(zkAppVerificationKey?.hash);
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    it(`2. Sending Actions - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('applying actions..');

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
        });
      }

      console.log('sending action 1');
      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },

        () => {
          zkApp.incrementCounter(Field(1));
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait({ maxAttempts: 1000 });

      console.log('sending action 2');
      tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },
        () => {
          zkApp.incrementCounter(Field(1));
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait();
    }, 10000000);
    // // ------------------------------------------------------------------------
    // // ------------------------------------------------------------------------
    it(`3. waiting one block to reduce Actions later - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('sending dummy tx to wait 1 block...');
      let currentAccount;
      let currentNonce;
      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
        });
        await fetchAccount({
          publicKey: deployerAccount,
        });
        currentAccount = await fetchAccount({
          publicKey: deployerAccount,
        });
        currentNonce = currentAccount?.account?.nonce;
      } else {
        currentNonce = Mina.getAccount(deployerAccount).nonce;
      }
      Mina.getAccount(zkAppAddress);

      let tx = await Mina.transaction(
        {
          sender: deployerAccount,
          memo: 'Dummy Transaction',
          fee: 0.2e9,
          nonce: Number(currentNonce),
        },
        () => {
          zkApp.dummy.set(UInt64.from(1));
        }
      );
      await tx.prove();
      tx.sign([deployerKey]);
      await (await tx.send()).wait({ maxAttempts: 1000 });
      console.log('dummy tx done');
    }, 10000000);

    // // ------------------------------------------------------------------------
    it(`4. reduce Actions - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('rolling up pending actions..');

      console.log('state before: ' + zkApp.actionCounter.get());

      let currentAccount;
      let currentNonce;
      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
        });
        currentAccount = await fetchAccount({
          publicKey: deployerAccount,
        });
        currentNonce = currentAccount?.account?.nonce;
      } else {
        currentNonce = Mina.getAccount(deployerAccount).nonce;
      }
      Mina.getAccount(zkAppAddress);

      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9, nonce: Number(currentNonce) },
        () => {
          zkApp.reduceActions();
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait({ maxAttempts: 1000 });

      // wait for 3 minutes
      await new Promise((resolve) => setTimeout(resolve, 180000));
      console.log('waiting for 3 minutes..done');

      let currentActionCounter;
      let events;
      if (isBerkeley) {
        currentAccount = await fetchAndLoopAccount(zkAppAddress);
        currentActionCounter = currentAccount?.zkapp?.appState[4];

        events = await fetchAndLoopEvents(zkApp);
      } else {
        currentAccount = Mina.getAccount(zkAppAddress);
        currentActionCounter = currentAccount?.zkapp?.appState[4];
        events = await zkApp.fetchEvents();
      }

      await new Promise((resolve) => setTimeout(resolve, 60000));

      expect(events[0].event.data).toEqual(Field(2));
      expect(currentActionCounter).toEqual(Field(2));
    }, 10000000);

    it(`5. changing permission "editSequenceState" to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('changing permission "editSequenceState" to impossible');

      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(zkAppAddress);
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            access: Permissions.proofOrSignature(),
            setVerificationKey: Permissions.impossible(),
            editState: Permissions.proofOrSignature(),
            receive: Permissions.none(),
            editActionState: Permissions.impossible(),
          });
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey, zkAppPrivateKey]).send()).wait({
        maxAttempts: 1000,
      });

      let currentAccount;
      let currentPermission;
      if (isBerkeley) {
        currentAccount = await fetchAndLoopAccount(zkAppAddress);
        currentPermission = currentAccount?.permissions.editActionState;
      } else {
        currentAccount = Mina.getAccount(zkAppAddress);
        currentPermission = currentAccount.permissions.editActionState;
      }

      expect(currentPermission).toEqual(Permissions.impossible());
    }, 10000000);

    it(`6. trying to send Actions - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
        });
      }

      console.log('action 1');
      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },

        () => {
          zkApp.incrementCounter(Field(1));
        }
      );
      await tx.prove();

      expect(async () => {
        await (await tx.sign([deployerKey, zkAppPrivateKey]).send()).wait({
          maxAttempts: 1000,
        });
      }).rejects.toThrow();
    }, 10000000);
  }

  runTests();
});
