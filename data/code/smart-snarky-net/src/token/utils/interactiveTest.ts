import { NoobToken } from '../noobToken.js';
import {
  AccountUpdate,
  isReady,
  Mina,
  PrivateKey,
  PublicKey,
  shutdown,
  UInt64,
} from 'snarkyjs';
import fs from 'fs/promises';

const proofsEnabled = true;
const deployToBerkeley = false;
let Blockchain;

await isReady;
console.log('compiling zkapp');
if (proofsEnabled) await NoobToken.compile();

let deployerAccount: PublicKey,
  deployerKey: PrivateKey,
  senderAccount: PublicKey,
  senderKey: PrivateKey,
  zkAppAddress: PublicKey,
  zkAppPrivateKey: PrivateKey,
  zkApp: NoobToken;

// choosing which Blockchain to use
console.log('choosing blockchain');
Blockchain = deployToBerkeley
  ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql')
  : Mina.LocalBlockchain({ proofsEnabled });

Mina.setActiveInstance(Blockchain);

// choosing deployer account
if (deployToBerkeley) {
  type Config = {
    deployAliases: Record<string, { url: string; keyPath: string }>;
  };
  let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
  // berkeley key hardcoded here
  let config = configJson.deployAliases['berkeley'];
  let key: { privateKey: string } = JSON.parse(
    await fs.readFile(config.keyPath, 'utf8')
  );
  deployerKey = PrivateKey.fromBase58(key.privateKey);
  deployerAccount = deployerKey.toPublicKey();

  zkAppPrivateKey = PrivateKey.random();
  zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkApp = new NoobToken(zkAppAddress);
} else {
  const Local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(Local);
  ({
    privateKey: deployerKey,
    publicKey: deployerAccount,
  } = Local.testAccounts[0]);
  // ({
  //   privateKey: senderKey,
  //   publicKey: senderAccount,
  // } = Local.testAccounts[1]);
  zkAppPrivateKey = PrivateKey.random();
  zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkApp = new NoobToken(zkAppAddress);
}

async function localDeploy() {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkApp.deploy({});
  });
  await txn.prove();
  // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
  await txn.sign([deployerKey, zkAppPrivateKey]).send();
}

async function berkeleyDeploy() {
  console.log('generating deploy transaction');
  const txn = await Mina.transaction(
    { sender: deployerAccount, fee: 1.1e9 },
    () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({});
    }
  );
  console.log('generating proof');
  await txn.prove();
  // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
  console.log('signing transaction');
  await txn.sign([deployerKey, zkAppPrivateKey]).send();
}

async function printBalances() {
  try {
    console.log(
      `deployerAccount balance:    ${Mina.getBalance(deployerAccount).div(
        1e9
      )} MINA`
    );
    console.log(
      `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
    );
  } catch (e) {
    console.log('error', e);
  }
}

async function deployTest() {
  //   await printBalances();
  deployToBerkeley ? await berkeleyDeploy() : await localDeploy();
  const tokenAmount = zkApp.totalAmountInCirculation.get();
  await printBalances();
}

async function mintTest() {
  const txn = await Mina.transaction(
    { sender: deployerAccount, fee: 1.1e9 },
    () => {
      zkApp.mint(zkAppAddress, UInt64.from(100));
    }
  );
  await txn.prove();
  await txn.sign([deployerKey]).send();
  const tokenAmount = zkApp.totalAmountInCirculation.get();
  console.log('tokenAmount', tokenAmount);
}

await deployTest();

// shutdown();
