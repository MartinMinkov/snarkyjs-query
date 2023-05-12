import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Permissions,
  Signature,
  fetchAccount,
  setGraphqlEndpoint,
  Account,
  VerificationKey,
  Field,
  Poseidon,
  Bool,
} from 'snarkyjs';
import { NoobToken } from '../noobToken';

import fs from 'fs/promises';
import { fetchAndLoopAccount, loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';
import { saveVerificationKey } from '../utils/generateVerificationKey';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test-permission', () => {
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
        let config = configJson.deployAliases['noobtokenpermission'];
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
          'permission',
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
        'permission',
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
    // // change zkAppUri with SignedTransaction
    // // status: working
    // // confirmed: true
    it(`2. change zkAppUri with SignedTransaction - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('change zkAppUri with SignedTransaction');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      } else {
        Mina.getAccount(zkAppAddress);
      }

      let newUri = 'https://www.newUri.com';
      const txn_changeZkappUri = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.zkappUri.set(newUri);
        }
      );

      txn_changeZkappUri.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_changeZkappUri.send()).wait({ maxAttempts: 100 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newZkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;

      console.log('newUri is', newZkAppUri);
      expect(newZkAppUri).toEqual(newUri);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // change setZkAppUri permissions to none() and updating zkAppUri without signature
    // // status: working
    // // confirmed: true
    it(`3. change setZkAppUri permissions to none() and updating zkAppUri without signature  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log(
        'change setZkAppUri permissions to none() and updating zkAppUri without signature'
      );
      let newUri = 'https://www.newuriAfterPermissions.com';

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }

      // change permissions for setZkappUri to none
      Mina.getAccount(zkAppAddress);
      const txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(zkAppAddress);
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            setZkappUri: Permissions.none(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_permission.send()).wait({ maxAttempts: 1000 });

      // try to change zkappUri without signature
      const txn_changeZkappUri = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.create(zkAppAddress);
          update.account.zkappUri.set(newUri);
        }
      );
      await txn_changeZkappUri.prove();
      txn_changeZkappUri.sign([deployerKey]);
      await (await txn_changeZkappUri.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let updatedZkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;
      console.log(
        'zkAppUri after changing Permission to none() is',
        updatedZkAppUri
      );

      expect(updatedZkAppUri).toEqual(newUri);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // change setTiming Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`4. change setTiming Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }

      // change permissions for setTiming to impossible
      let txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(zkAppAddress);
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            setTiming: Permissions.impossible(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_permission.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newTiming = Mina.getAccount(zkAppAddress).permissions.setTiming;
      console.log('newTiming Permission is', newTiming);

      expect(newTiming).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // set voting for Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`5. set voting for Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set voting for Permission to impossible()');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;

      // set voting for Permission to impossible()
      let txn_votingForPermission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.permissions.set({
            ...Permissions.default(),
            setVotingFor: Permissions.impossible(),
          });
        }
      );
      await txn_votingForPermission.prove();
      txn_votingForPermission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_votingForPermission.send()).wait({ maxAttempts: 1000 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;
      console.log('newVotingForPermission is', newVotingForPermission);

      expect(newVotingForPermission).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // set delegate to deployerAccount
    // // status: confirmed
    // // confirmed: true
    it(`6. set delegate to deployerAccount - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set delegate to  deployerAccount');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldDelegate = Mina.getAccount(zkAppAddress).delegate;
      console.log('oldDelegate is', oldDelegate?.toJSON());

      // set delegate for deployerAccount
      let txn_delegate = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.delegate.set(deployerAccount);
        }
      );
      await txn_delegate.prove();
      txn_delegate.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_delegate.send()).wait({ maxAttempts: 1000 });

      let currentAccount;
      let currentDelegate;
      if (isBerkeley) {
        // currentAccount = await fetchAndLoopAccount(zkAppAddress);
        // currentDelegate = currentAccount.delegate;

        currentAccount = await fetchAccount({ publicKey: zkAppAddress });
        currentDelegate = currentAccount.account?.delegate;
      } else {
        currentAccount = Mina.getAccount(zkAppAddress);
        currentDelegate = currentAccount.delegate;
      }

      console.log('newDelegate is', currentDelegate?.toJSON());

      expect(currentDelegate).toEqual(deployerAccount);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // setDelegate for Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`7. setDelegate for Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set voting for Permission to impossible()');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;

      // set voting for Permission to impossible()
      let txn_votingForPermission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.permissions.set({
            ...Permissions.default(),
            setDelegate: Permissions.impossible(),
          });
        }
      );
      await txn_votingForPermission.prove();
      txn_votingForPermission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_votingForPermission.send()).wait({ maxAttempts: 1000 });

      let currentAccount;
      let currentDelegatePermission;
      if (isBerkeley) {
        // currentAccount = await fetchAndLoopAccount(zkAppAddress);
        // currentDelegatePermission = currentAccount.permissions.setDelegate;
        currentAccount = await fetchAccount({ publicKey: zkAppAddress });
        currentDelegatePermission =
          currentAccount.account?.permissions.setDelegate;
      } else {
        currentAccount = Mina.getAccount(zkAppAddress);
        currentDelegatePermission = currentAccount.permissions.setDelegate;
      }

      console.log('newVotingForPermission is', currentDelegatePermission);

      expect(currentDelegatePermission).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------
  }

  runTests();
});
