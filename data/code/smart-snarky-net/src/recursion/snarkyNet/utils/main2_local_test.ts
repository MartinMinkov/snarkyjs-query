// use this file to test the accuracy of the network
// It was needed to write local "test".

// import { SmartSnarkyNet } from './smartSnarkyNet.js';
// import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
// import { num2Field_t1, num2Field_t2 } from './utils/scaledWeights2Int65.js';
// import { InputImage } from './inputImageClass.js';

// import { weights_l1_8x8 } from './assets/weights_l1_8x8.js';
// import { weights_l2_8x8 } from './assets/weights_l2_8x8.js';
// import { image_0_label_7_8x8 } from './assets/image_0_label_7_8x8.js';
// import { image_1_label_2_8x8 } from './assets/image_1_label_2_8x8.js';
// import { image_2_label_1_8x8 } from './assets/image_2_label_1_8x8.js';
// import { image_3_label_0_8x8 } from './assets/image_3_label_0_8x8.js';
// import { image_4_label_4_8x8 } from './assets/image_4_label_4_8x8.js';
// import { image_5_label_1_8x8 } from './assets/image_5_label_1_8x8.js';
// import { image_6_label_4_8x8 } from './assets/image_6_label_4_8x8.js';
// import { image_7_label_9_8x8 } from './assets/image_7_label_9_8x8.js';
// import { image_8_label_5_8x8 } from './assets/image_8_label_5_8x8.js';
// import { image_9_label_9_8x8 } from './assets/image_9_label_9_8x8.js';
// import { image_10_label_0_8x8 } from './assets/image_10_label_0_8x8.js';
// import { image_11_label_6_8x8 } from './assets/image_11_label_6_8x8.js';
// import { image_12_label_9_8x8 } from './assets/image_12_label_9_8x8.js';
// import { image_13_label_0_8x8 } from './assets/image_13_label_0_8x8.js';
// import { image_14_label_1_8x8 } from './assets/image_14_label_1_8x8.js';
// import { image_15_label_5_8x8 } from './assets/image_15_label_5_8x8.js';
// import { image_16_label_9_8x8 } from './assets/image_16_label_9_8x8.js';
// import { image_17_label_7_8x8 } from './assets/image_17_label_7_8x8.js';
// import { image_18_label_3_8x8 } from './assets/image_18_label_3_8x8.js';
// import { image_19_label_4_8x8 } from './assets/image_19_label_4_8x8.js';

// import {
//   isReady,
//   shutdown,
//   Field,
//   Mina,
//   PrivateKey,
//   AccountUpdate,
// } from 'snarkyjs';

// (async function main() {
//   await isReady;

//   function preprocessWeights(weightsScaled: number[][]): Array<Field>[] {
//     const weights_l1_preprocessed = num2Field_t2(weightsScaled);
//     // const weights_l2_preprocessed = await num2Field_t2(weights_l2);
//     return weights_l1_preprocessed;
//   }

//   function preprocessImage(image: number[]): Array<Field> {
//     const imagePreprocessed = num2Field_t1(image);
//     console.log('imagePreprocessed', imagePreprocessed.toString());
//     return imagePreprocessed;
//   }

//   console.log('SnarkyJS loaded');

//   const Local = Mina.LocalBlockchain();
//   Mina.setActiveInstance(Local);
//   const deployerKey = Local.testAccounts[0].privateKey;
//   const deployerAccount = deployerKey.toPublicKey();

//   const useProof = true;

//   if (useProof) {
//     SmartSnarkyNet.compile();
//   }

//   // ----------------------------------------------------

//   // create a destination we will deploy the smart contract to
//   const zkAppPrivateKey = PrivateKey.random();
//   const zkAppAddress = zkAppPrivateKey.toPublicKey();

//   // create an instance of Square - and deploy it to zkAppAddress
//   const zkAppInstance = new SmartSnarkyNet(zkAppAddress);
//   const deploy_txn = await Mina.transaction(deployerAccount, () => {
//     AccountUpdate.fundNewAccount(deployerAccount);
//     zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
//   });
//   await deploy_txn.prove();
//   deploy_txn.sign([deployerKey, zkAppPrivateKey]);
//   await (await deploy_txn.send()).wait();

//   // get the initial state of Square after deployment
//   const num0 = zkAppInstance.classification.get();
//   console.log('state after init:', num0.toString());
//   // ----------------------------------------------------

//   let snarkyLayer1s = new SnarkyLayer1(
//     preprocessWeights(weights_l1_8x8),
//     'relu'
//   );

//   let snarkyLayer2s = new SnarkyLayer2(
//     preprocessWeights(weights_l2_8x8),
//     'softmax'
//   );

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

// const txn0 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_0_label_7_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   zkAppInstance.sign(zkAppPrivateKey);
// });
// await txn0.prove();
// txn0.sign([deployerKey, zkAppPrivateKey]);
// await (await txn0.send()).wait();

// const classification1 = zkAppInstance.classification.get();
// console.log('state after txn0, should be 7:', classification1.toString());

// // ----------------------------------------------------

// // ----------------------------------------------------

// try {
//   const txn1 = await Mina.transaction(deployerAccount, () => {
//     zkAppInstance.predict(
//       new InputImage(preprocessImage(image_1_label_2_8x8)),
//       snarkyLayer1s,
//       snarkyLayer2s
//     );
//     zkAppInstance.sign(zkAppPrivateKey);
//   });
//   await txn1.send();
// } catch (ex) {
//   // console.log(ex.message);
//   console.log("error, but it's ok");
// }
// const num1 = zkAppInstance.classification.get();
// console.log('classification after txn1, should be 2:', num1.toString());

// // // ----------------------------------------------------
// // // ----------------------------------------------------

// const txn2 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_2_label_1_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn2.prove();
// }
// await txn2.send();

// const num2 = zkAppInstance.classification.get();
// console.log('classification after txn2, should be 1:', num2.toString());

// // // ----------------------------------------------------
// // // ----------------------------------------------------

// const txn3 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_3_label_0_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn3.prove();
// }
// await txn3.send();

// const num3 = zkAppInstance.classification.get();
// console.log('classification after txn3, should be 0:', num3.toString());

// // // ----------------------------------------------------

// // ----------------------------------------------------
// const txn4 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_4_label_4_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn4.prove();
// }
// await txn4.send();

// const num4 = zkAppInstance.classification.get();
// console.log('classification after txn4, should be 4:', num4.toString());

// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn5 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_5_label_1_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn5.prove();
// }
// await txn5.send();

// const num5 = zkAppInstance.classification.get();
// console.log('classification after txn5, should be 1:', num5.toString());

// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn6 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_6_label_4_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn6.prove();
// }
// await txn6.send();

// const num6 = zkAppInstance.classification.get();
// console.log('classification after txn6, should be 4:', num6.toString());

// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn7 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_7_label_9_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn7.prove();
// }
// await txn7.send();

// const num7 = zkAppInstance.classification.get();
// console.log('classification after txn7, should be 9:', num7.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn8 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_8_label_5_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn8.prove();
// }
// await txn8.send();

// const num8 = zkAppInstance.classification.get();
// console.log('classification after txn8, should be 5:', num8.toString());

// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn9 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_9_label_9_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn9.prove();
// }
// await txn9.send();

// const num9 = zkAppInstance.classification.get();
// console.log('classification after txn9, should be 9:', num9.toString());

// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn10 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_10_label_0_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn10.prove();
// }
// await txn10.send();

// const num10 = zkAppInstance.classification.get();
// console.log('classification after txn10, should be 0:', num10.toString());
// // ----------------------------------------------------

// // ----------------------------------------------------
// const txn11 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_11_label_6_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn11.prove();
// }
// await txn11.send();

// const num11 = zkAppInstance.classification.get();
// console.log('classification after txn11, should be 6:', num11.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn12 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_12_label_9_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn12.prove();
// }
// await txn12.send();

// const num12 = zkAppInstance.classification.get();
// console.log('classification after txn12, should be 9:', num12.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn13 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_13_label_0_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn13.prove();
// }
// await txn13.send();

// const num13 = zkAppInstance.classification.get();
// console.log('classification after txn13, should be 0:', num13.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn14 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_14_label_1_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn14.prove();
// }
// await txn14.send();

// const num14 = zkAppInstance.classification.get();
// console.log('classification after txn14, should be 1:', num14.toString());
// // ----------------------------------------------------

// // ----------------------------------------------------
// const txn15 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_15_label_5_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn15.prove();
// }
// await txn15.send();

// const num15 = zkAppInstance.classification.get();
// console.log('classification after txn15, should be 5:', num15.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn16 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_16_label_9_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn16.prove();
// }
// await txn16.send();

// const num16 = zkAppInstance.classification.get();
// console.log('classification after txn3, should be 9:', num16.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn17 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_17_label_7_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn17.prove();
// }
// await txn17.send();

// const num17 = zkAppInstance.classification.get();
// console.log('classification after txn17, should be 7:', num17.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn18 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_18_label_3_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn18.prove();
// }
// await txn18.send();

// const num18 = zkAppInstance.classification.get();
// console.log('classification after txn3, should be 3:', num18.toString());
// // ----------------------------------------------------
// // ----------------------------------------------------
// const txn19 = await Mina.transaction(deployerAccount, () => {
//   zkAppInstance.predict(
//     new InputImage(preprocessImage(image_19_label_4_8x8)),
//     snarkyLayer1s,
//     snarkyLayer2s
//   );
//   if (!useProof) {
//     zkAppInstance.sign(zkAppPrivateKey);
//   }
// });
// if (useProof) {
//   await txn19.prove();
// }
// await txn19.send();

// const num19 = zkAppInstance.classification.get();
// console.log('classification after txn3, should be 4:', num19.toString());
// // ----------------------------------------------------

//   console.log('Shutting down');

//   await shutdown();
// })();
