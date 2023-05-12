/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  isReady,
  Mina,
  PrivateKey,
  type PublicKey,
  fetchAccount,
  AccountUpdate,
  Field,
  SmartContract,
} from 'snarkyjs';
import { ContractApi, type OffchainStateContract } from '@zkfs/contract-api';
import { CustomToken } from './Farm.js';

import * as dotenv from 'dotenv';
dotenv.config();

import config from '../config.json';
import berkeleyAccount from '../keys/berkeley.json';
import { waitUntilNextBlock } from './network';
import { type Program } from './zkProgram';

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
  fetchAccounts: (publicKeys: PublicKey[], tokenId?: Field) => Promise<void>;
  zkProgram: typeof Program;
  token: CustomToken;
  localBlockchain: any;
}

let hasProofsEnabled = false;
const deployToBerkeley = process.env.TEST_ON_BERKELEY?.toLowerCase() === 'true';
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
  zkProgram: typeof Program,
  testCallback: (context: () => ContractTestContext<ZkApp>) => void
) {
  describe(name, () => {
    beforeAll(async () => {
      await isReady;

      console.time(name);
      // eslint-disable-next-line max-len
      if (hasProofsEnabled) {
        // eslint-disable-next-line @typescript-eslint/require-await
        const analyzedMethods = await withTimer('analyzeMethods', async () =>
          Contract.analyzeMethods()
        );

        console.log('analyzed methods', analyzedMethods);

        await withTimer('compile', async () => {
          await zkProgram.compile();
          await CustomToken.compile();
          (Contract as any).tokenSmartContractAddress = tokenAccount;
          await Contract.compile();
        });
      }
    });

    afterAll(() => {
      console.timeEnd(name);
    });

    // eslint-disable-next-line @typescript-eslint/init-declarations
    let context: ContractTestContext<ZkApp>;

    beforeEach(async () => {
      let localBlockchain = Mina.LocalBlockchain({
        proofsEnabled: hasProofsEnabled,
        enforceTransactionLimits: true,
      });

      setupNetwork(localBlockchain);

      let {
        senderAccount,
        senderKey,
        deployerAccount,
        deployerKey,
      }: {
        senderAccount: PublicKey;
        senderKey: PrivateKey;
        deployerAccount: PublicKey;
        deployerKey: PrivateKey;
      } = setupAccounts(localBlockchain);

      /**
       * Waits until next block on Berkeley by polling the network state
       * or mocks the next block on local blockchain by increasing block length by 1.
       */
      async function waitForNextBlock() {
        if (deployToBerkeley) {
          // provide parameters to overwrite defaults for number of retries and polling interval
          await waitUntilNextBlock();
        } else {
          localBlockchain.setBlockchainLength(
            localBlockchain.getNetworkState().blockchainLength.add(1)
          );
        }
      }

      /**
       * Fetches account state for multiple accounts on Berkeley or skips for local blockchain.
       */
      async function fetchAccounts(publicKeys: PublicKey[], tokenId?: Field) {
        if (deployToBerkeley) {
          await Promise.all(
            publicKeys.map((publicKey) => fetchAccount({ publicKey, tokenId }))
          );
        }
      }

      const token = new CustomToken(tokenAccount);
      await deployTokenContract(
        senderAccount,
        token,
        senderKey,
        waitForNextBlock
      );

      const zkAppPrivateKey = PrivateKey.random();
      const zkAppAddress = zkAppPrivateKey.toPublicKey();
      console.log('ZkApp address', zkAppAddress.toBase58());

      const zkApp = new Contract(zkAppAddress) as ZkApp;

      const contractApi = new ContractApi();

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
        zkProgram,
        token,
        localBlockchain,
      };
    }, 50_000_000);

    testCallback(() => context);
  });

  async function deployTokenContract(
    senderAccount: PublicKey,
    token: CustomToken,
    senderKey: PrivateKey,
    waitForNextBlock: () => Promise<void>
  ) {
    const deployTokenTx = await Mina.transaction(
      { sender: senderAccount, fee: 2e8 },
      () => {
        AccountUpdate.fundNewAccount(senderAccount);
        token.deploy();
      }
    );
    deployTokenTx.sign([senderKey, tokenKey]);
    await deployTokenTx.prove();
    await deployTokenTx.send();
    console.log('Token contract deployed', token.address.toBase58());
    await waitForNextBlock();
  }

  function setupAccounts(
    localBlockchain: ReturnType<typeof Mina.LocalBlockchain>
  ) {
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
    return { senderAccount, senderKey, deployerAccount, deployerKey };
  }

  function setupNetwork(
    localBlockchain: ReturnType<typeof Mina.LocalBlockchain>
  ) {
    if (deployToBerkeley) {
      const berkeley = Mina.Network({
        mina: config.networks.berkeley.mina,
        archive: config.networks.berkeley.archive,
      });
      Mina.setActiveInstance(berkeley);
    } else {
      Mina.setActiveInstance(localBlockchain);
    }
  }
}

type ZkAppEvents = Awaited<ReturnType<SmartContract['fetchEvents']>>;

function getEventByType(events: ZkAppEvents, targetType: string): ZkAppEvents {
  return events.filter((event) => event.type === targetType);
}

type ArrayElementType<T extends ReadonlyArray<any>> = T extends ReadonlyArray<
  infer ElementType
>
  ? ElementType
  : never;
type ZkAppEvent = ArrayElementType<ZkAppEvents>;

function getLatestEvent(events: ZkAppEvents): ZkAppEvent | undefined {
  let maxBlockHeightEvent: ZkAppEvent | undefined = undefined;
  events.forEach((event) => {
    if (
      !maxBlockHeightEvent ||
      event.blockHeight.greaterThan(maxBlockHeightEvent.blockHeight).toBoolean()
    ) {
      maxBlockHeightEvent = event;
    }
  });
  return maxBlockHeightEvent;
}

export default describeContract;
export { withTimer, getEventByType, getLatestEvent, ZkAppEvents };
