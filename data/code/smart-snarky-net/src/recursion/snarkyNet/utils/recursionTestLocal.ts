import {
  AccountUpdate,
  Circuit,
  Experimental,
  Field,
  isReady,
  Mina,
  Poseidon,
  PrivateKey,
  SelfProof,
  Struct,
  verify,
} from 'snarkyjs';
import { InputImage } from '../inputImageClass.js';
import { SnarkyLayer1, SnarkyLayer2 } from '../snarkyLayer.js';
import { weights_l1_8x8 } from '../assets/weights_l1_8x8.js';
import { weights_l2_8x8 } from '../assets/weights_l2_8x8.js';
import { image_0_label_7_8x8 } from '../assets/image_0_label_7_8x8.js';
import { num2Field_t1, num2Field_t2 } from './scaledWeights2Int65.js';
import { SnarkyNet } from '../snarkynet.js';
import { SmartSnarkyNet } from '../smartSnarkyNet.js';
import { Architecture, NeuralNet } from '../recursionProof.js';
await isReady;

async function main() {
  await isReady;

  function preprocessWeights(weightsScaled: number[][]): Array<Field>[] {
    const weights_l1_preprocessed = num2Field_t2(weightsScaled);
    // const weights_l2_preprocessed = await num2Field_t2(weights_l2);
    return weights_l1_preprocessed;
  }

  function preprocessImage(image: number[]): Array<Field> {
    const imagePreprocessed = num2Field_t1(image);
    console.log('imagePreprocessed', imagePreprocessed.toString());
    return imagePreprocessed;
  }

  console.log('SnarkyJS loaded');

  let snarkyLayer1s = new SnarkyLayer1(
    preprocessWeights(weights_l1_8x8),
    'relu'
  );

  let snarkyLayer2s = new SnarkyLayer2(
    preprocessWeights(weights_l2_8x8),
    'softmax'
  );

  // let inputImage = new InputImage(preprocessImage(image_0_label_7_8x8));

  // code for Struct update
  let inputImage = new InputImage({
    value: preprocessImage(image_0_label_7_8x8),
  });

  let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

  let predictionAndSteps = model.predict(inputImage);

  console.log('predictionAndSteps', predictionAndSteps);

  const { verificationKey } = await NeuralNet.compile();

  console.log('verificationKey', verificationKey);

  const architecture = new Architecture({
    layer1: snarkyLayer1s,
    layer2: snarkyLayer2s,
    precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
    precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
  });

  const proofLayer1 = await NeuralNet.layer1(architecture, inputImage);
  console.log('proofLayer1', proofLayer1);

  const proofLayer2 = await NeuralNet.layer2(architecture, proofLayer1);
  console.log('proofLayer2', proofLayer2);

  const isValid = await verify(proofLayer2, verificationKey);
  console.log('isValid', isValid);

  // -------------------------------------
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const deployerKey = Local.testAccounts[0].privateKey;
  const deployerAccount = deployerKey.toPublicKey();

  const useProof = true;

  if (useProof) {
    SmartSnarkyNet.compile();
  }

  // ----------------------------------------------------

  // create a destination we will deploy the smart contract to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // create an instance of Square - and deploy it to zkAppAddress
  const zkAppInstance = new SmartSnarkyNet(zkAppAddress);
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
  });
  await deploy_txn.prove();
  deploy_txn.sign([deployerKey, zkAppPrivateKey]);
  await (await deploy_txn.send()).wait();

  // get the initial state of Square after deployment
  const num0 = zkAppInstance.classification.get();
  console.log('state after init:', num0.toString());
  // ----------------------------------------------------

  // setting the layer hashes
  // ----------------------------------------------------
  // const txnInit = await Mina.transaction(deployerAccount, () => {
  //   zkAppInstance.initState(snarkyLayer1s, snarkyLayer2s);
  // });
  // await txnInit.prove();
  // txnInit.sign([deployerKey, zkAppPrivateKey]);
  // await (await txnInit.send()).wait();
  // console.log(
  //   'layer1 state after init:',
  //   zkAppInstance.layer1Hash.get().toString()
  // );
  // console.log(
  //   'layer1 state after init:',
  //   zkAppInstance.layer2Hash.get().toString()
  // );
  // // ----------------------------------------------------

  const txn0 = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.predict(proofLayer2);
  });
  await txn0.prove();
  txn0.sign([deployerKey, zkAppPrivateKey]);
  await (await txn0.send()).wait();

  const classification1 = zkAppInstance.classification.get();
  console.log('state after txn0, should be 7:', classification1.toString());
}
main();
