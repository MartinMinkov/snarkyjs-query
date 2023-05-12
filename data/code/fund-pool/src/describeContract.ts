/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  isReady,
  Mina,
  PrivateKey,
  type PublicKey,
  fetchAccount,
  AccountUpdate,
  MerkleMap,
  Field,
  UInt32,
} from 'snarkyjs';
import { ContractApi, type OffchainStateContract } from '@zkfs/contract-api';
import { Token } from '@stove-labs/mip-token-standard/packages/token';

import * as dotenv from 'dotenv';
dotenv.config();

import config from '../config.json';
import berkeleyAccount from '../keys/berkeley.json';
import { waitUntilNextBlock } from './network';
import { toWhitelistEntry, type WhitelistProgram } from './WhitelistProgram';
import FundPool from './FundPool';
import { ZkProgram } from 'snarkyjs/dist/node/lib/proof_system';

interface ContractTestContext<ZkApp extends OffchainStateContract> {
  deployerAccount: PublicKey;
  deployerKey: PrivateKey;
  senderAccount: PublicKey;
  senderKey: PrivateKey;
  zkAppAddress: PublicKey;
  zkAppPrivateKey: PrivateKey;
  zkApp: ZkApp;
  contractApi: ContractApi;
  waitForNextBlock: () => Promise<void>;
  fetchAccounts: (publicKey: PublicKey[], tokenId?: Field) => Promise<void>;
  fetchEventsZkApp: () => Promise<any>;
  zkProgram: typeof WhitelistProgram;
  token: Token;
  localBlockchain: any;
  whitelistData: {
    alice: PrivateKey;
    charlie: PrivateKey;
    whitelist: MerkleMap;
    whitelistRoot: Field;
  };
}

let hasProofsEnabled = true;
const deployToBerkeley = Boolean(process.env.TEST_ON_BERKELEY?.toLowerCase());

if (deployToBerkeley) {
  hasProofsEnabled = true;
}

async function withTimer<Result>(
  name: string,
  callback: () => Promise<Result>
): Promise<Result> {
  console.log(`Starting ${name}`);
  console.time(name);
  const result = await callback();
  console.timeEnd(name);
  return result;
}

await isReady;

const tokenKey = PrivateKey.random();
const tokenAccount = tokenKey.toPublicKey();

function describeContract<ZkApp extends OffchainStateContract>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  Contract: typeof OffchainStateContract,
  zkProgram: typeof WhitelistProgram,
  testCallback: (context: () => ContractTestContext<ZkApp>) => void
) {
  describe(name, () => {
    beforeAll(async () => {
      await isReady;
      (Contract as any).tokenSmartContractAddress = tokenAccount;
      (Contract as any).startFromBlockchainLength = UInt32.from(0);
      (Contract as any).endAtBlockchainLength = UInt32.from(20000);

      console.time(name);
      // eslint-disable-next-line max-len
      if (hasProofsEnabled) {
        // eslint-disable-next-line @typescript-eslint/require-await
        const analyzedMethods = await withTimer('analyzeMethods', async () =>
          Contract.analyzeMethods()
        );

        console.log('analyzed methods', analyzedMethods);

        await withTimer('compile', async () => {
          await withTimer('zkProgram', async () => {
            await zkProgram.compile();
          });

          await withTimer('Token', async () => {
            await Token.compile();
          });

          await withTimer('Contract', async () => {
            await Contract.compile();
          });
        });
      }
    }, 60_000_000);

    afterAll(() => {
      console.timeEnd(name);
    });

    // eslint-disable-next-line @typescript-eslint/init-declarations
    let context: ContractTestContext<ZkApp>;

    beforeAll(async () => {
      let localBlockchain = Mina.LocalBlockchain({
        proofsEnabled: hasProofsEnabled,
        enforceTransactionLimits: true,
      });

      if (deployToBerkeley) {
        const berkeley = Mina.Network({
          mina: config.networks.berkeley.mina,
          archive: config.networks.berkeley.archive,
        });
        Mina.setActiveInstance(berkeley);
      } else {
        Mina.setActiveInstance(localBlockchain);
      }

      let deployerKey: PrivateKey;
      let deployerAccount: PublicKey;
      if (deployToBerkeley) {
        deployerKey = PrivateKey.fromBase58(berkeleyAccount.privateKey);
      } else {
        // First test account is the deployer
        const { privateKey } = localBlockchain.testAccounts[0];
        deployerKey = privateKey;
      }
      deployerAccount = deployerKey.toPublicKey();

      let senderKey: PrivateKey;
      let senderAccount: PublicKey;
      if (deployToBerkeley) {
        // todo: use a different account for the sender
        senderKey = PrivateKey.fromBase58(berkeleyAccount.privateKey);
      } else {
        // Second test account is the deployer
        const { privateKey } = localBlockchain.testAccounts[1];
        senderKey = privateKey;
      }
      senderAccount = senderKey.toPublicKey();

      async function waitForNextBlock() {
        console.log('waiting for next block...');
        if (deployToBerkeley) {
          // provide parameters to overwrite defaults for number of retries and polling interval
          await waitUntilNextBlock();
        } else {
          localBlockchain.setBlockchainLength(
            localBlockchain.getNetworkState().blockchainLength.add(1)
          );
        }
        console.log('done waiting for next block');
      }

      async function fetchAccounts(publicKeys: PublicKey[], tokenId?: Field) {
        if (deployToBerkeley) {
          await Promise.all(
            publicKeys.map((publicKey) => fetchAccount({ publicKey, tokenId }))
          );
        }
      }

      const token = new Token(tokenAccount);

      console.log('deploying token');
      const deployTokenTx = await Mina.transaction(
        { sender: senderAccount, fee: 1e9 },
        () => {
          AccountUpdate.fundNewAccount(senderAccount);
          token.deploy();
        }
      );
      deployTokenTx.sign([senderKey, tokenKey]);
      await deployTokenTx.prove();
      await deployTokenTx.send();
      await waitForNextBlock();
      console.log('done deploying token', token.address.toBase58());

      await fetchAccounts([token.address]);

      const zkAppPrivateKey = PrivateKey.random();
      const zkAppAddress = zkAppPrivateKey.toPublicKey();

      const zkApp = new Contract(zkAppAddress) as ZkApp;

      const contractApi = new ContractApi();

      async function fetchEventsZkApp() {
        if (deployToBerkeley) {
          return await zkApp.fetchEvents();
        } else {
          return localBlockchain.fetchEvents(zkAppAddress) as ReturnType<
            typeof zkApp.fetchEvents
          >;
        }
      }

      // prepare testing keys
      const alice = senderKey;
      const charlie = PrivateKey.random();

      // prepare testing whitelist tree
      const whitelist = new MerkleMap();
      // only alice is whitelisted, charlie is not whitelisted
      whitelist.set(Field(1), toWhitelistEntry(alice));

      const whitelistRoot = whitelist.getRoot();

      const whitelistData = { alice, charlie, whitelist, whitelistRoot };

      context = {
        deployerAccount,
        deployerKey,
        senderAccount,
        senderKey,
        zkApp,
        zkAppAddress,
        zkAppPrivateKey,
        contractApi,
        waitForNextBlock,
        fetchAccounts,
        fetchEventsZkApp,
        zkProgram,
        token,
        localBlockchain,
        whitelistData,
      };
    }, 60_000_000);

    testCallback(() => context);
  });
}

export default describeContract;
export { withTimer, hasProofsEnabled, deployToBerkeley };
