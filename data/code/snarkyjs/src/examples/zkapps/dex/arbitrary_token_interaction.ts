import {
  isReady,
  Mina,
  AccountUpdate,
  UInt64,
  shutdown,
  TokenId,
} from 'snarkyjs';
import { TokenContract, addresses, keys, tokenIds } from './dex.js';

await isReady;
let doProofs = true;

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);
let accountFee = Mina.accountCreationFee();

let [{ privateKey: userKey, publicKey: userAddress }] = Local.testAccounts;
let tx;

console.log('-------------------------------------------------');
console.log('TOKEN X ADDRESS\t', addresses.tokenX.toBase58());
console.log('USER ADDRESS\t', userAddress.toBase58());
console.log('-------------------------------------------------');
console.log('TOKEN X ID\t', TokenId.toBase58(tokenIds.X));
console.log('-------------------------------------------------');

// compile & deploy all 5 zkApps
console.log('compile (token)...');
await TokenContract.compile();

let tokenX = new TokenContract(addresses.tokenX);

console.log('deploy & init token contracts...');
tx = await Mina.transaction(userKey, () => {
  // pay fees for creating 2 token contract accounts, and fund them so each can create 1 account themselves
  let feePayerUpdate = AccountUpdate.createSigned(userKey);
  feePayerUpdate.balance.subInPlace(accountFee.mul(1));
  tokenX.deploy();
});
await tx.prove();
tx.sign([keys.tokenX]);
await tx.send();

console.log('arbitrary token minting...');
tx = await Mina.transaction(userKey, () => {
  // pay fees for creating user's token X account
  AccountUpdate.createSigned(userKey).balance.subInPlace(accountFee.mul(1));
  // 😈😈😈 mint any number of tokens to our account 😈😈😈
  let tokenContract = new TokenContract(addresses.tokenX);
  tokenContract.token.mint({
    address: userAddress,
    amount: UInt64.from(1e18),
  });
});
await tx.prove();
console.log(tx.toPretty());
await tx.send();

console.log(
  'User tokens: ',
  Mina.getBalance(userAddress, tokenIds.X).value.toBigInt()
);

shutdown();
