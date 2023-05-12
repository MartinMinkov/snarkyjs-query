import { isReady, Mina, AccountUpdate, UInt64 } from 'snarkyjs';
import {
  Dex,
  DexTokenHolder,
  addresses,
  keys,
  tokenIds,
  getTokenBalances,
} from './dex-with-actions.js';
import { TokenContract } from './dex.js';
import { expect } from 'expect';
import { tic, toc } from '../tictoc.js';

await isReady;

let proofsEnabled = false;

tic('Happy path with actions');
console.log();

let Local = Mina.LocalBlockchain({
  proofsEnabled,
  enforceTransactionLimits: true,
});
Mina.setActiveInstance(Local);
let accountFee = Mina.accountCreationFee();
let [{ privateKey: feePayerKey, publicKey: feePayerAddress }] =
  Local.testAccounts;
let tx, balances, oldBalances;

if (proofsEnabled) {
  tic('compile (token)');
  await TokenContract.compile();
  toc();
  tic('compile (dex token holder)');
  await DexTokenHolder.compile();
  toc();
  tic('compile (dex main contract)');
  await Dex.compile();
  toc();
}

let tokenX = new TokenContract(addresses.tokenX);
let tokenY = new TokenContract(addresses.tokenY);
let dex = new Dex(addresses.dex);
let dexTokenHolderX = new DexTokenHolder(addresses.dex, tokenIds.X);
let dexTokenHolderY = new DexTokenHolder(addresses.dex, tokenIds.Y);

tic('deploy & init token contracts');
tx = await Mina.transaction(feePayerAddress, () => {
  // pay fees for creating 2 token contract accounts, and fund them so each can create 1 account themselves
  let feePayerUpdate = AccountUpdate.createSigned(feePayerAddress);
  feePayerUpdate.balance.subInPlace(accountFee.mul(2));
  feePayerUpdate.send({ to: addresses.tokenX, amount: accountFee });
  feePayerUpdate.send({ to: addresses.tokenY, amount: accountFee });
  tokenX.deploy();
  tokenY.deploy();
});
await tx.prove();
await tx.sign([feePayerKey, keys.tokenX, keys.tokenY]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);

tic('deploy dex contracts');
tx = await Mina.transaction(feePayerAddress, () => {
  // pay fees for creating 3 dex accounts
  AccountUpdate.createSigned(feePayerAddress).balance.subInPlace(
    accountFee.mul(3)
  );
  dex.deploy();
  dexTokenHolderX.deploy();
  tokenX.approveUpdate(dexTokenHolderX.self);
  dexTokenHolderY.deploy();
  tokenY.approveUpdate(dexTokenHolderY.self);
});
await tx.prove();
await tx.sign([feePayerKey, keys.dex]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);

tic('transfer tokens to user');
let USER_DX = 1_000n;
tx = await Mina.transaction(feePayerAddress, () => {
  // pay fees for creating 3 user accounts
  let feePayer = AccountUpdate.fundNewAccount(feePayerAddress, 3);
  feePayer.send({ to: addresses.user, amount: 20e9 }); // give users MINA to pay fees
  tokenX.transfer(addresses.tokenX, addresses.user, UInt64.from(USER_DX));
  tokenY.transfer(addresses.tokenY, addresses.user, UInt64.from(USER_DX));
});
await tx.prove();
await tx.sign([feePayerKey, keys.tokenX, keys.tokenY]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);

// this is done in advance to avoid account update limit in `supply`
tic("create user's lq token account");
tx = await Mina.transaction(addresses.user, () => {
  AccountUpdate.fundNewAccount(addresses.user);
  dex.createAccount();
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);

[oldBalances, balances] = [balances, getTokenBalances()];
expect(balances.user.X).toEqual(USER_DX);
console.log(balances);

tic('supply liquidity');
tx = await Mina.transaction(addresses.user, () => {
  dex.supplyLiquidityBase(UInt64.from(USER_DX), UInt64.from(USER_DX));
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);
[oldBalances, balances] = [balances, getTokenBalances()];
expect(balances.user.X).toEqual(0n);
console.log(balances);

tic('redeem liquidity, step 1');
let USER_DL = 100n;
tx = await Mina.transaction(addresses.user, () => {
  dex.redeemInitialize(UInt64.from(USER_DL));
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);
console.log(getTokenBalances());

tic('redeem liquidity, step 2a (get back token X)');
tx = await Mina.transaction(addresses.user, () => {
  dexTokenHolderX.redeemLiquidityFinalize();
  tokenX.approveAny(dexTokenHolderX.self);
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);
console.log(getTokenBalances());

tic('redeem liquidity, step 2b (get back token Y)');
tx = await Mina.transaction(addresses.user, () => {
  dexTokenHolderY.redeemLiquidityFinalize();
  tokenY.approveAny(dexTokenHolderY.self);
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);
console.log(getTokenBalances());

[oldBalances, balances] = [balances, getTokenBalances()];
expect(balances.user.X).toEqual(USER_DL / 2n);

tic('swap 10 X for Y');
USER_DX = 10n;
tx = await Mina.transaction(addresses.user, () => {
  dex.swapX(UInt64.from(USER_DX));
});
await tx.prove();
await tx.sign([keys.user]).send();
toc();
console.log('account updates length', tx.transaction.accountUpdates.length);

[oldBalances, balances] = [balances, getTokenBalances()];
expect(balances.user.X).toEqual(oldBalances.user.X - USER_DX);
console.log(balances);

toc();
console.log('dex happy path with actions was successful! 🎉');
