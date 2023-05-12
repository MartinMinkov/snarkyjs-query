import {
  Mina,
  PublicKey,
  PrivateKey,
  isReady,
  shutdown,
  AccountUpdate,
  fetchAccount,
  Field,
  Poseidon,
  verify,
  Permissions,
} from 'snarkyjs';
import fs from 'fs/promises';
import { loopUntilAccountExists } from '../../token/utils/utils';
import { getFriendlyDateTime } from '../../token/utils/utils';
import { ProxyRecursionZkApp } from '../proxyRecursionZkApp.js';
import { SmartSnarkyNet } from '../snarkyNet/smartSnarkyNet';
import { SnarkyLayer1, SnarkyLayer2 } from '../snarkyNet/snarkyLayer';
import {
  preprocessImage,
  preprocessWeights,
} from '../snarkyNet/utils/preprocess';
import { weights_l1_8x8 } from '../snarkyNet/assets/weights_l1_8x8';
import { weights_l2_8x8 } from '../snarkyNet/assets/weights_l2_8x8';
import { Architecture, NeuralNet } from '../snarkyNet/recursionProof';
import { InputImage } from '../snarkyNet/inputImageClass';
import { image_0_label_7_8x8 } from '../snarkyNet/assets/image_0_label_7_8x8';
import { SnarkyNet } from '../snarkyNet/snarkynet';
import { image_1_label_2_8x8 } from '../snarkyNet/assets/image_1_label_2_8x8';
import { saveVerificationKey } from '../../token/utils/generateVerificationKey';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;

console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('proxy-recursion-test', () => {
  async function runTests(deployToBerkeley: boolean = isBerkeley) {
    let Blockchain;
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      proxyZkAppAddress: PublicKey,
      proxyZkAppPrivateKey: PrivateKey,
      proxyZkApp: ProxyRecursionZkApp,
      smartSnarkyNetPrivateKey: PrivateKey,
      smartSnarkyNetAddress: PublicKey,
      smartSnarkyNetZkApp: SmartSnarkyNet,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey;
    let addZkAppVerificationKey: string | undefined;
    let neuralNetVerificationKey: string;

    let proxyZkAppVerificationKey: { data: string; hash: Field } | undefined;
    let smartSnarkyZkAppVerificationKey:
      | { data: string; hash: Field }
      | undefined;
    beforeAll(async () => {
      await isReady;

      // choosing which Blockchain to use
      console.log('choosing blockchain');
      Blockchain = deployToBerkeley
        ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql')
        : Mina.LocalBlockchain({ proofsEnabled });

      Mina.setActiveInstance(Blockchain);

      try {
        console.log('compiling SmartContracts...');

        ({
          verificationKey: neuralNetVerificationKey,
        } = await NeuralNet.compile());
        console.log('compiling SmartSnarkyNet...');
        ({
          verificationKey: smartSnarkyZkAppVerificationKey,
        } = await SmartSnarkyNet.compile());

        console.log('compiling RecursionZkapp...');

        ({
          verificationKey: proxyZkAppVerificationKey,
        } = await ProxyRecursionZkApp.compile());
      } catch (e) {
        console.log('error compiling one of the zkapps', e);
      }

      // choosing deployer account
      if (deployToBerkeley) {
        type Config = {
          deployAliases: Record<string, { url: string; keyPath: string }>;
        };
        let configJson: Config = JSON.parse(
          await fs.readFile('config.json', 'utf8')
        );
        // berkeley key hardcoded here
        let config = configJson.deployAliases['proxyrecursionzkapp'];
        let key: { privateKey: string } = JSON.parse(
          await fs.readFile(config.keyPath, 'utf8')
        );
        deployerKey = PrivateKey.fromBase58(key.privateKey);
        deployerAccount = deployerKey.toPublicKey();

        proxyZkAppPrivateKey = PrivateKey.random();
        proxyZkAppAddress = proxyZkAppPrivateKey.toPublicKey();

        smartSnarkyNetPrivateKey = PrivateKey.random();
        smartSnarkyNetAddress = smartSnarkyNetPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new SmartSnarkyNet(smartSnarkyNetAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({
          privateKey: deployerKey,
          publicKey: deployerAccount,
        } = Local.testAccounts[0]);

        proxyZkAppPrivateKey = PrivateKey.random();
        proxyZkAppAddress = proxyZkAppPrivateKey.toPublicKey();

        smartSnarkyNetPrivateKey = PrivateKey.random();
        smartSnarkyNetAddress = smartSnarkyNetPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new SmartSnarkyNet(smartSnarkyNetAddress);
      }
    }, 1000000);

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    async function localDeploy() {
      console.log('localDeploy...');

      let txn;

      if (
        proxyZkAppVerificationKey !== undefined &&
        smartSnarkyZkAppVerificationKey !== undefined
      ) {
        txn = await Mina.transaction(deployerAccount, () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          AccountUpdate.fundNewAccount(deployerAccount);

          smartSnarkyNetZkApp.deploy({
            verificationKey: smartSnarkyZkAppVerificationKey,
            zkappKey: smartSnarkyNetPrivateKey,
          });
          proxyZkApp.deploy({
            verificationKey: proxyZkAppVerificationKey,
            zkappKey: proxyZkAppPrivateKey,
          });
        });
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        await (
          await txn
            .sign([deployerKey, smartSnarkyNetPrivateKey, proxyZkAppPrivateKey])
            .send()
        ).wait();
        console.log('deployed proxyZkApp local', proxyZkAppAddress.toBase58());
        console.log(
          'deployed recursionZkApp local',
          smartSnarkyNetAddress.toBase58()
        );
      }
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

      console.log('calling faucet...done');

      console.log('deploy on Berkeley...');

      let txn;

      if (smartSnarkyZkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.2e9 },
          () => {
            AccountUpdate.fundNewAccount(deployerAccount, 2);

            smartSnarkyNetZkApp.deploy({
              verificationKey: smartSnarkyZkAppVerificationKey,
              zkappKey: smartSnarkyNetPrivateKey,
            });
            proxyZkApp.deploy({
              verificationKey: proxyZkAppVerificationKey,
              zkappKey: proxyZkAppPrivateKey,
            });
          }
        );
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
        let response = await txn.send();
        console.log('response from recursion deploy is', response);
      }
    }

    it(`1. deploy zkApps and check verificationKeys and hashes stored - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      await saveVerificationKey(
        smartSnarkyZkAppVerificationKey?.hash,
        smartSnarkyZkAppVerificationKey?.data,
        'recursionSmartSnarkyNet',
        smartSnarkyNetAddress,
        smartSnarkyNetPrivateKey
      );
      await saveVerificationKey(
        proxyZkAppVerificationKey?.hash,
        proxyZkAppVerificationKey?.data,
        'recursionProxy',
        proxyZkAppAddress,
        proxyZkAppPrivateKey
      );
      console.log('deploying zkApps...');
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

      if (isBerkeley) {
        // wait for the account to exist
        await loopUntilAccountExists({
          account: smartSnarkyNetAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for smartSnarkyNetZkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });

        await loopUntilAccountExists({
          account: proxyZkAppAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for proxyZkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });
      }

      if (isBerkeley) {
        await fetchAccount({
          publicKey: smartSnarkyNetAddress,
        });
        await fetchAccount({
          publicKey: proxyZkAppAddress,
        });
      }
      let actualSmartSnarkyVerificationKeyHash = Mina.getAccount(
        smartSnarkyNetAddress
      ).zkapp?.verificationKey?.hash;
      let actualProxyVerificationKeyHash = Mina.getAccount(proxyZkAppAddress)
        .zkapp?.verificationKey?.hash;

      expect(actualProxyVerificationKeyHash).toEqual(
        proxyZkAppVerificationKey?.hash
      );
      expect(actualSmartSnarkyVerificationKeyHash).toEqual(
        smartSnarkyZkAppVerificationKey?.hash
      );
    }, 100000000);

    it(`2. proving that input image was indeed a picture of a 2 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('proving that input image was indeed a picture of a 2...');
      let snarkyLayer1s = new SnarkyLayer1(
        preprocessWeights(weights_l1_8x8),
        'relu'
      );

      let snarkyLayer2s = new SnarkyLayer2(
        preprocessWeights(weights_l2_8x8),
        'softmax'
      );

      let inputImage = new InputImage({
        value: preprocessImage(image_1_label_2_8x8),
      });

      let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

      let predictionAndSteps = model.predict(inputImage);

      const architecture = new Architecture({
        layer1: snarkyLayer1s,
        layer2: snarkyLayer2s,
        precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
        precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
      });

      const proofLayer1 = await NeuralNet.layer1(architecture, inputImage);
      const proofLayer2 = await NeuralNet.layer2(architecture, proofLayer1);
      const isValidLocal = await verify(proofLayer2, neuralNetVerificationKey);
      console.log('isValidLocal', isValidLocal);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9, memo: '2. call predict' },
        () => {
          proxyZkApp.callPredict(proofLayer2, smartSnarkyNetAddress);
        }
      );
      await txn.prove();
      txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }

      const currentClassification = smartSnarkyNetZkApp.classification.get();
      const currentLayer1Hash = smartSnarkyNetZkApp.layer1Hash.get();
      const currentLayer2Hash = smartSnarkyNetZkApp.layer2Hash.get();
      // checking classification and the hashes of layers
      expect(Poseidon.hash(snarkyLayer1s.toFields())).toEqual(
        currentLayer1Hash
      );
      expect(Poseidon.hash(snarkyLayer2s.toFields())).toEqual(
        currentLayer2Hash
      );
      expect(currentClassification).toEqual(Field(2));
    }, 10000000);

    it(`3. try to update hashes with signature while "editstate" is proofOrSignature()"- deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log(
        '3. try to update hashes with signature while editstate is proofOrSignature()'
      );
      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }

      // change permissions for setVerificationKey to impossible
      let txn_permission = await Mina.transaction(
        {
          sender: deployerAccount,
          fee: 0.2e9,
          memo: '3. update hashes with signature',
        },
        () => {
          smartSnarkyNetZkApp.setLayerHashes(Field(1), Field(2));
        }
      );
      await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn_permission.send()).wait({ maxAttempts: 100 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }
      Mina.getAccount(smartSnarkyNetAddress);

      let currentLayer1Hash = smartSnarkyNetZkApp.layer1Hash.get();
      let currentLayer2Hash = smartSnarkyNetZkApp.layer2Hash.get();

      expect(currentLayer1Hash).toEqual(Field(1));
      expect(currentLayer2Hash).toEqual(Field(2));
    }, 10000000);

    it(`4. set hashes back to true hashes with signature while "editstate" is proofOrSignature()"- deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log(
        '4. set hashes back to true hashes with signature while "editstate" is proofOrSignature()'
      );
      let snarkyLayer1s = new SnarkyLayer1(
        preprocessWeights(weights_l1_8x8),
        'relu'
      );

      let snarkyLayer2s = new SnarkyLayer2(
        preprocessWeights(weights_l2_8x8),
        'softmax'
      );

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }

      // change permissions for setVerificationKey to impossible
      let txn_permission = await Mina.transaction(
        {
          sender: deployerAccount,
          fee: 0.2e9,
          memo: '4. correct hashes again',
        },
        () => {
          smartSnarkyNetZkApp.setLayerHashes(
            Poseidon.hash(snarkyLayer1s.toFields()),
            Poseidon.hash(snarkyLayer2s.toFields())
          );
        }
      );
      await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn_permission.send()).wait({ maxAttempts: 100 });

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }
      Mina.getAccount(smartSnarkyNetAddress);

      const currentLayer1Hash = smartSnarkyNetZkApp.layer1Hash.get();
      const currentLayer2Hash = smartSnarkyNetZkApp.layer2Hash.get();

      expect(currentLayer1Hash).toEqual(
        Poseidon.hash(snarkyLayer1s.toFields())
      );
      expect(currentLayer2Hash).toEqual(
        Poseidon.hash(snarkyLayer2s.toFields())
      );
    }, 10000000);

    it(`5. set Permission "editState" to proof()"  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        try {
          await fetchAccount({ publicKey: smartSnarkyNetAddress });
          await fetchAccount({ publicKey: deployerAccount });
        } catch (e) {
          console.log('fetch in 5. errors', e);
        }
      }
      Mina.getAccount(smartSnarkyNetAddress);

      // change permissions for setVerificationKey to impossible
      let txn_permission = await Mina.transaction(
        {
          sender: deployerAccount,
          fee: 0.2e9,
          memo: '5. set editState to proof',
        },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(
            smartSnarkyNetAddress
          );
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proof(),
            access: Permissions.proofOrSignature(),
            setZkappUri: Permissions.proof(),
            setVerificationKey: Permissions.proof(),
            setTokenSymbol: Permissions.impossible(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn_permission.send()).wait();

      let currentAccount;
      let currentPermissionEdit;
      if (isBerkeley) {
        currentAccount = await fetchAccount({
          publicKey: smartSnarkyNetAddress,
        });
        await fetchAccount({ publicKey: deployerAccount });
        currentPermissionEdit = currentAccount?.account?.permissions.editState;
      } else {
        currentAccount = Mina.getAccount(smartSnarkyNetAddress);
        currentPermissionEdit = currentAccount?.permissions.editState;
      }

      expect(currentPermissionEdit).toEqual(Permissions.proof());
    }, 10000000);

    it(`6. try to update hashes with signature while "editstate is proof() but the method requires a signature"- deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }
      let txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          smartSnarkyNetZkApp.setLayerHashes(Field(1), Field(2));
        }
      );
      await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      // console.log('txn_permission hashes edit', txn_permission.toPretty());
      expect(async () => {
        await (await txn_permission.send()).wait({ maxAttempts: 1000 });
      }).rejects.toThrow();
    }, 10000000);

    it(`7. set permission "access" to signature() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }
      Mina.getAccount(smartSnarkyNetAddress);
      // change permissions for access to signature
      let txn_permission = await Mina.transaction(
        {
          sender: deployerAccount,
          fee: 0.2e9,
          memo: '7. set access to signature',
        },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(
            smartSnarkyNetAddress
          );
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proof(),
            access: Permissions.signature(),
            setZkappUri: Permissions.proof(),
            setVerificationKey: Permissions.proof(),
            setTokenSymbol: Permissions.impossible(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn_permission.send()).wait({ maxAttempts: 100 });

      let currentAccount;
      let currentPermissionAccess;
      if (isBerkeley) {
        currentAccount = (
          await fetchAccount({
            publicKey: smartSnarkyNetAddress,
          })
        ).account;
        currentPermissionAccess = currentAccount?.permissions.access;
      } else {
        currentAccount = Mina.getAccount(smartSnarkyNetAddress);
        currentPermissionAccess = currentAccount?.permissions.access;
      }

      expect(currentPermissionAccess?.signatureNecessary).toEqual(
        Permissions.signature().signatureNecessary
      );
    }, 10000000);

    it(`8. proving that input image was indeed a picture of a 7 BUT access is set to signature() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('proving that input image was indeed a picture of a 7...');

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }
      let snarkyLayer1s = new SnarkyLayer1(
        preprocessWeights(weights_l1_8x8),
        'relu'
      );

      let snarkyLayer2s = new SnarkyLayer2(
        preprocessWeights(weights_l2_8x8),
        'softmax'
      );

      let inputImage = new InputImage({
        value: preprocessImage(image_0_label_7_8x8),
      });

      let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

      let predictionAndSteps = model.predict(inputImage);

      const architecture = new Architecture({
        layer1: snarkyLayer1s,
        layer2: snarkyLayer2s,
        precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
        precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
      });

      const proofLayer1 = await NeuralNet.layer1(architecture, inputImage);
      // console.log('proofLayer1', proofLayer1);

      const proofLayer2 = await NeuralNet.layer2(architecture, proofLayer1);
      // console.log('proofLayer2', proofLayer2);

      const isValidLocal = await verify(proofLayer2, neuralNetVerificationKey);
      console.log('isValidLocal', isValidLocal);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.3e9, memo: '8. set classification' },
        () => {
          proxyZkApp.callPredict(proofLayer2, smartSnarkyNetAddress);
        }
      );
      await txn.prove();
      txn.sign([deployerKey]);
      expect(async () => {
        await (await txn.send()).wait();
      }).rejects.toThrow();

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
        await fetchAccount({ publicKey: deployerAccount });
      }
      let currentClassification = smartSnarkyNetZkApp.classification.get();

      expect(currentClassification).toEqual(Field(2));
      // }).rejects.toThrow();
    }, 10000000);

    it(`9. changing Permission to impossible to fix architecture - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log(
        'changing smartSnarkyNet Permission to impossible to fix architecture...'
      );
      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }

      // change permissions for setVerificationKey to impossible
      let txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.4e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(
            smartSnarkyNetAddress
          );
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proof(),
            access: Permissions.proof(),
            setZkappUri: Permissions.impossible(),
            setVerificationKey: Permissions.impossible(),
            setTokenSymbol: Permissions.impossible(),
            setPermissions: Permissions.impossible(),
          });
        }
      );

      // await txn_permission.prove();
      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn_permission.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }

      let currentPermissionSetVerificationKey = Mina.getAccount(
        smartSnarkyNetAddress
      ).permissions.setVerificationKey;
      let currentPermissionAccess = Mina.getAccount(smartSnarkyNetAddress)
        .permissions.access;
      let currentPermissionEdit = Mina.getAccount(smartSnarkyNetAddress)
        .permissions.editState;
      let currentPermissionSetZkappUri = Mina.getAccount(smartSnarkyNetAddress)
        .permissions.setZkappUri;
      let currentPermissionSetTokenSymbol = Mina.getAccount(
        smartSnarkyNetAddress
      ).permissions.setTokenSymbol;
      let currentPermissionSetPermissions = Mina.getAccount(
        smartSnarkyNetAddress
      ).permissions.setPermissions;

      expect(currentPermissionAccess).toEqual(Permissions.proof());
      expect(currentPermissionEdit).toEqual(Permissions.proof());
      expect(currentPermissionSetZkappUri).toEqual(Permissions.impossible());
      expect(currentPermissionSetTokenSymbol).toEqual(Permissions.impossible());
      expect(currentPermissionSetPermissions).toEqual(Permissions.impossible());
      expect(currentPermissionSetVerificationKey).toEqual(
        Permissions.impossible()
      );
    }, 10000000);

    it(`10. changing Permission "access" to signature, BUT permission "setPermission" is impossible - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }

      // change permissions for setVerificationKey to impossible
      let txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.5e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(
            smartSnarkyNetAddress
          );
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            editState: Permissions.proof(),
            access: Permissions.signature(),
            setZkappUri: Permissions.impossible(),
            setVerificationKey: Permissions.impossible(),
            setTokenSymbol: Permissions.impossible(),
            setPermissions: Permissions.impossible(),
          });
        }
      );

      txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
      expect(async () => {
        await (await txn_permission.send()).wait();

        if (isBerkeley) {
          await fetchAccount({ publicKey: smartSnarkyNetAddress });
        }

        let currentPermissionAccess = Mina.getAccount(smartSnarkyNetAddress)
          .permissions.access;

        expect(currentPermissionAccess).toEqual(Permissions.signature());
      }).rejects.toThrow();
    }, 10000000);
  }
  runTests();
});
