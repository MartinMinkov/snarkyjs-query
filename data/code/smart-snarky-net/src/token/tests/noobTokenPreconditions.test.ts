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
  Bool,
} from 'snarkyjs';
import { NoobToken } from '../noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';
import { Transaction } from 'snarkyjs/dist/node/lib/mina';
import { saveVerificationKey } from '../utils/generateVerificationKey';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;

console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test-preconditions', () => {
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
            archive: 'https://archive.berkeley.minaexplorer.com',
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
        let config = configJson.deployAliases['noobtokenprecondition'];
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
          'preconditions',
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
        'preconditions',
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

    // // ------------------------------------------------------------------------
    // // check that tokenSymbol is 'NOOB'
    // // status: working
    // // confirmed: true
    // // dependencies:
    it(`2. check that tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
      console.log('tokenSymbol is', tokenSymbol);
      expect(tokenSymbol).toEqual('NOOB');
    }, 1000000);
    // // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mint 7 tokens to zkAppAccount
    // status: working
    // confirmed: true
    it(`3. mint 7 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      printBalances();
      console.log('minting 7 tokens');
      let tokenId = zkApp.token.id;

      let events = await zkApp.fetchEvents();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress, tokenId });
        await fetchAccount({ publicKey: deployerAccount, tokenId });
      }
      Mina.getAccount(zkAppAddress);
      Mina.getAccount(deployerAccount);

      const mintAmount = UInt64.from(7e9);
      const txn_mint = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.mint(zkAppAddress, mintAmount);
        }
      );
      await txn_mint.prove();
      txn_mint.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_mint.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: zkAppAddress,
        });
      }
      // let newBalance = Mina.getAccount(zkAppAddress, tokenId).balance;
      let newNoobBalance = Mina.getBalance(zkAppAddress, tokenId);
      console.log('mint 7, newBalance is', newNoobBalance.toJSON());

      let newTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();

      expect(newTotalAmountInCirculation).toEqual(mintAmount);
      expect(newNoobBalance).toEqual(mintAmount);
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // sendTokens to deployerAccount
    // status: working
    // confirmed: true
    it(`4. sendTokens to deployerAccount - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('sendTokens to deployerAccount');

      let events = await zkApp.fetchEvents();

      if (isBerkeley) {
        let fetch = await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
      }
      Mina.getAccount(zkAppAddress, zkApp.token.id);

      let sendAmount = UInt64.from(1e9);

      const txn_send = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          let zkAppUpdate = AccountUpdate.createSigned(zkAppAddress);
          zkAppUpdate.token().send({
            from: zkAppAddress,
            to: deployerAccount,
            amount: sendAmount,
          });
        }
      );
      await txn_send.prove();
      txn_send.sign([deployerKey, zkAppPrivateKey]);
      await (await txn_send.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
      }

      let deployerNoobBalance = Mina.getBalance(
        deployerAccount,
        zkApp.token.id
      );

      console.log('deployerNoobBalance is', deployerNoobBalance.toJSON());
      // console.log('events are', events);
      expect(deployerNoobBalance).toEqual(sendAmount);
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // sendNOOBIfCorrectTime to deployerAccount if the network time is correct
    // status: working
    // confirmed: true
    // dependencies: mintWithMina / sendTokens to deployerAccount
    it(`5. sendNOOBIfCorrectTime to deployerAccount if the network time is correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let amount = UInt64.from(1e9);

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
      }
      Mina.getAccount(zkAppAddress, zkApp.token.id);
      Mina.getAccount(deployerAccount, zkApp.token.id);

      let oldDeployerNoobBalance = Mina.getBalance(
        deployerAccount,
        zkApp.token.id
      );

      // assuring that the endDate is always in the future
      let endDateCorrect = UInt64.from(Date.now() + 1000000);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          // AccountUpdate.fundNewAccount(deployerAccount);
          AccountUpdate.createSigned(zkAppAddress);
          zkApp.sendNOOBIfCorrectTime(deployerAccount, amount, endDateCorrect);
        }
      );
      await txn.prove();
      txn.sign([deployerKey, zkAppPrivateKey, receiverKey]);
      await (await txn.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
      }
      // get the NOOB balance of the deployerAccount
      let newDeployerNoobBalance = Mina.getBalance(
        deployerAccount,
        zkApp.token.id
      );
      console.log('updateBalance is', newDeployerNoobBalance.toString());

      printBalances();
      expect(newDeployerNoobBalance).toEqual(
        oldDeployerNoobBalance.add(amount)
      );
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // Send NOOB if the network time is NOT correct
    // status: working
    // confirmed: true
    // dependencies: mint
    it(`6. Send NOOB if the network time is NOT correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      // testing with incorrect time
      let amount = UInt64.from(1e9);

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
      }

      Mina.getAccount(zkAppAddress, zkApp.token.id);
      Mina.getAccount(deployerAccount, zkApp.token.id);

      let oldDeployerNoobBalance = Mina.getBalance(
        deployerAccount,
        zkApp.token.id
      );

      // assuring that the endDate is always in the past
      let endDateIncorrect = UInt64.from(Date.now() - 1000000);
      let txn: Transaction;
      // sending also 1 Mina to the receiverAddress because of the bug in the Mina explorer, otherwise address wouldn't be found
      expect(async () => {
        txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.1e9 },
          () => {
            zkApp.sendNOOBIfCorrectTime(
              deployerAccount,
              amount,
              endDateIncorrect
            );
          }
        );
        await txn.prove();
        txn.sign([deployerKey, zkAppPrivateKey]);

        await (await txn.send()).wait({ maxAttempts: 1000 });
      }).rejects.toThrow();

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
      }

      let newDeployerNoobBalance = Mina.getBalance(
        deployerAccount,
        zkApp.token.id
      );
    }, 10000000);

    // ------------------------------------------------------------------------
    // setPaused to true
    // status: working
    // confirmed: true
    it(`7. setPaused to true - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        try {
          await fetchAccount({
            publicKey: deployerAccount,
            tokenId: zkApp.token.id,
          });
          await fetchAccount({
            publicKey: zkAppAddress,
          });
        } catch (e) {
          console.log('fetch error in 7. setPaused to true', e);
        }
      }

      let txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },
        () => {
          zkApp.pause(new Bool(true));
        }
      );

      txn.sign([deployerKey, zkAppPrivateKey]);
      await (await txn.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: zkAppAddress,
        });
      }
      let currentIsPaused = zkApp.isPaused.get();
      console.log('currentIsPaused is', currentIsPaused);

      expect(currentIsPaused).toEqual(UInt64.from(1));
    }, 10000000);

    // ------------------------------------------------------------------------
    // mint while isPaused is true
    // status: working
    // confirmed: true
    // dependencies: setPaused
    it(`Try to mint while isPaused is true - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      expect(async () => {
        if (isBerkeley) {
          await fetchAccount({ publicKey: zkAppAddress });
        }
        Mina.getAccount(zkAppAddress);
        const txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.3e9 },
          () => {
            zkApp.mint(zkAppAddress, UInt64.from(1));
          }
        );

        txn.sign([deployerKey, zkAppPrivateKey]);
        await (await txn.send()).wait({ maxAttempts: 1000 });
      }).rejects.toThrow();
    }, 10000000);
  }

  runTests();
});
