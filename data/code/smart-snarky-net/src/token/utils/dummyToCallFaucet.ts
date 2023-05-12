import { Mina, PrivateKey, isReady, shutdown } from 'snarkyjs';
import { loopUntilAccountExists, getFriendlyDateTime } from './utils.js';

await isReady;
let newKey = PrivateKey.random();
let newAddress = newKey.toPublicKey();
console.log('newAddress is:', newAddress.toBase58());

Mina.Network('https://api.minascan.io/node/berkeley/v1/graphql');

await Mina.faucet(newAddress);

// await loopUntilAccountExists({
//   account: newAddress,
//   eachTimeNotExist: () =>
//     console.log(
//       'waiting for smartSnarkyNetZkApp account to be deployed...',
//       getFriendlyDateTime()
//     ),
//   isZkAppAccount: false,
// });
shutdown();
