import { isReady, PrivateKey } from 'snarkyjs';

await isReady;

function generateKeys() {
  let account1PrivateKey = PrivateKey.random();
  let account1PublicKey = account1PrivateKey.toPublicKey();
  console.log('privateKey Account 1 is', account1PrivateKey.toBase58());
  console.log('publicKey Account 1 is', account1PublicKey.toBase58());

  let account2PrivateKey = PrivateKey.random();
  let account2PublicKey = account2PrivateKey.toPublicKey();
  console.log('privateKey Account 2 is', account2PrivateKey.toBase58());
  console.log('publicKey Account 2 is', account2PublicKey.toBase58());
}

generateKeys();
