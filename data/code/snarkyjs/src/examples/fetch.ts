import {
  fetchAccount,
  isReady,
  setGraphqlEndpoints,
  shutdown,
  fetchLastBlock,
  PublicKey,
  Types,
} from 'snarkyjs';

await isReady;
setGraphqlEndpoints([
  'https://proxy.berkeley.minaexplorer.com/graphql',
  'https://berkeley.minascan.io/graphql',
]);

let zkappAddress = PublicKey.fromBase58(
  'B62qpRzFVjd56FiHnNfxokVbcHMQLT119My1FEdSq8ss7KomLiSZcan'
);
let { account, error } = await fetchAccount({
  publicKey: zkappAddress,
});
console.log('error', error);
console.log('account', Types.Account.toJSON(account!));

let block = await fetchLastBlock();
console.log('last block', JSON.stringify(block, null, 2));

await shutdown();
