import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  fetchAccount,
  Field,
  fetchLastBlock,
} from 'snarkyjs';
import { NoobToken } from '../noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';
import { saveVerificationKey } from '../utils/generateVerificationKey';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;

console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test-minting', () => {
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
        let config = configJson.deployAliases['noobtokenminting'];
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
          'minting',
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
        'minting',
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
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
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

    // mintWithMina but balance is 0. expecting failure
    // status: working
    // confirmed:
    it(`2. mintWithMina 1 tokens but balance is 0  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('mintWithMina but balance is 0. expecting failure');

      printBalances();
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      Mina.getAccount(zkAppAddress);
      expect(async () => {
        const txn20 = await Mina.transaction(
          { sender: deployerAccount, fee: 0.1e9 },
          () => {
            AccountUpdate.fundNewAccount(deployerAccount);
            zkApp.mintWithMina(deployerAccount, UInt64.from(1));
          }
        );
        await txn20.prove();
        txn20.sign([deployerKey, zkAppPrivateKey]);
        await (await txn20.send()).wait({ maxAttempts: 1000 });
      }).rejects.toThrow();
    }, 1000000);

    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mintWithMina 1 tokens, but balance is 1
    // status: constantly fails on berkeley - no idea why
    // confirmed:
    // dependencies: mint 7 tokens (because otherwise Mina.getAccount fails - error) /
    it(`3. sending one 1 Mina to zkAppAddress  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('sending one 1 Mina to zkAppAddress');
      printBalances();
      let tokenId = zkApp.token.id;

      if (isBerkeley) {
        await fetchAccount({ publicKey: deployerAccount });
        await fetchAccount({ publicKey: zkAppAddress });
      }
      Mina.getAccount(zkAppAddress);
      Mina.getAccount(deployerAccount);

      // send 2 Mina to zkAppAddress to fund account
      let tx = await Mina.transaction(
        {
          sender: deployerAccount,
          fee: 0.2e9,
        },
        () => {
          zkApp.deposit(UInt64.from(1e9));
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: deployerAccount });
        await fetchAccount({ publicKey: zkAppAddress });
      }

      Mina.getAccount(zkAppAddress);
      Mina.getAccount(deployerAccount);
      let newBalance = Mina.getBalance(zkAppAddress);
      printBalances();
      expect(newBalance).toEqual(UInt64.from(1e9));
    }, 1000000);

    it(`4. try to mint now that the balance is 1 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('try to mint now that the balance is 1');
      printBalances();
      let mintWithMinaAmount = UInt64.from(1e9);
      let tokenId = zkApp.token.id;
      if (isBerkeley) {
        try {
          await fetchAccount({ publicKey: zkAppAddress, tokenId });
          await fetchAccount({ publicKey: deployerAccount });
          await fetchAccount({ publicKey: zkAppAddress });
          await fetchLastBlock();
        } catch (e) {
          console.log('error fetching accounts in 4.', e);
        }
      }

      // mintWithMina 1 tokens
      const txn20 = await Mina.transaction(
        { sender: deployerAccount, fee: 0.3e9 },
        () => {
          Mina.getBalance(zkAppAddress);
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.mintWithMina(zkAppAddress, mintWithMinaAmount);
        }
      );

      await txn20.prove();
      txn20.sign([deployerKey, zkAppPrivateKey]);
      await (await txn20.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: zkAppAddress,
        });
      }
      let newNoobBalance = zkApp.account.balance.get();
      console.log('mintWithMina, newNoobBalance is', newNoobBalance.toJSON());

      expect(newNoobBalance).toEqual(UInt64.from(1e9));
    }, 10000000);
  }
  runTests();
});
