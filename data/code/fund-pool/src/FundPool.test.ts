import {
  AccountUpdate,
  Circuit,
  Field,
  MerkleMap,
  Mina,
  PrivateKey,
  Signature,
  UInt32,
  UInt64,
} from 'snarkyjs';

import FundPool from './FundPool.js';
import describeContract, {
  deployToBerkeley,
  hasProofsEnabled,
} from './describeContract.js';
import OffchainStateBackup from '@zkfs/contract-api/dist/offchainStateBackup.js';
import {
  toWhitelistEntry,
  WhitelistProgram,
  WhitelistProgramInput,
  WhitelistProgramProof,
} from './WhitelistProgram.js';
import { whitelistProgramTestData } from './WhitelistProgram.test.js';
import { Bool, Pickles, isReady } from 'snarkyjs/dist/node/snarky.js';

await isReady;

describeContract<FundPool>(
  'FundPool',
  FundPool,
  WhitelistProgram,
  (context) => {
    async function localDeploy() {
      const {
        deployerAccount,
        deployerKey,
        zkAppPrivateKey,
        zkApp,
        contractApi,
        token,
        senderAccount,
        whitelistData,
        waitForNextBlock,
        fetchAccounts,
      } = context();

      console.log('deploying fund pool');
      const tx = await contractApi.transaction(
        zkApp,
        { sender: deployerAccount, fee: 2e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount, 1);
          zkApp.deploy();
          console.log(
            'set whitelist root',
            whitelistData.whitelistRoot.toString()
          );
          zkApp.setWhitelistRoot(whitelistData.whitelistRoot);
        }
      );

      await tx.prove();
      await tx.sign([deployerKey, zkAppPrivateKey]).send();
      await waitForNextBlock();
      await fetchAccounts([zkApp.address]);
      console.log('done deploying fund pool', tx.toPretty());
      return tx;
    }

    const depositAmount = UInt64.from(1000);

    it('should deploy the fund pool', async () => {
      expect.assertions(1);

      const { senderAccount, zkApp, waitForNextBlock, fetchAccounts, token } =
        context();

      await localDeploy();

      await waitForNextBlock();
      OffchainStateBackup.restoreLatest(zkApp);
      await fetchAccounts([senderAccount, zkApp.address]);

      console.log('FundPool.deploy() successful');
      console.log('account addresses', {
        zkApp: zkApp.address.toBase58(),
        token: token.address.toBase58(),
        sender: senderAccount.toBase58(),
      });

      const zkAppTokenBalance = token.balanceOf(zkApp.address);
      console.log('zkAppTokenBalance', zkAppTokenBalance.toString());
      expect(zkAppTokenBalance.toString()).toEqual('0');
    }, 60_000_000);

    it('should mint for the sender', async () => {
      expect.assertions(1);
      const {
        senderAccount,
        senderKey,
        token,
        waitForNextBlock,
        fetchAccounts,
        zkApp,
      } = context();

      await fetchAccounts([senderAccount, token.address]);

      console.log('minting');
      const tx = await Mina.transaction(
        { sender: senderAccount, fee: 1e9 },
        () => {
          AccountUpdate.fundNewAccount(senderAccount, 1);
          token.mint(senderAccount, depositAmount);
        }
      );

      tx.sign([senderKey]);
      await tx.prove();
      await tx.send();
      console.log('minting done');

      await waitForNextBlock();
      await fetchAccounts([token.address]);
      await fetchAccounts([senderAccount], token.token.id);

      const senderTokenBalance = token.balanceOf(senderAccount);
      console.log('senderTokenBalance', senderTokenBalance.toString());
      expect(senderTokenBalance.toString()).toEqual(depositAmount.toString());
    }, 60_000_000);

    it('should deposit, if the user is whitelisted', async () => {
      expect.assertions(1);

      const {
        zkApp,
        senderAccount,
        senderKey,
        token,
        waitForNextBlock,
        fetchAccounts,
        whitelistData,
      } = context();

      const witness = whitelistData.whitelist.getWitness(Field(1));
      const publicInput = new WhitelistProgramInput({
        whitelistRoot: whitelistData.whitelistRoot,
        validUntilBlock: UInt64.from(10000),
      });

      const [, proof] = Pickles.proofOfBase64(Pickles.dummyBase64Proof(), 2);
      let isWhitelisted = new WhitelistProgramProof({
        proof,
        publicInput,
        maxProofsVerified: 2,
      });

      if (hasProofsEnabled) {
        console.log('proving isWhitelisted', 'root hash', {
          publicInput: publicInput.whitelistRoot.toString(),
          zkApp: zkApp.whitelistRoot.get().toString(),
        });
        isWhitelisted = await WhitelistProgram.isWhitelisted(
          publicInput,
          whitelistData.alice,
          witness
        );
      }

      const tx = await Mina.transaction(
        { sender: senderAccount, fee: 1e9 },
        () => {
          AccountUpdate.fundNewAccount(senderAccount, 1);
          zkApp.deposit(isWhitelisted, depositAmount);
        }
      );

      await tx.prove();
      tx.sign([senderKey]);
      await tx.send();

      await waitForNextBlock();
      await fetchAccounts([senderAccount, zkApp.address, token.address]);
      await fetchAccounts(
        [senderAccount, zkApp.address, token.address],
        token.token.id
      );

      const zkAppTokenBalance = token.balanceOf(zkApp.address);
      expect(zkAppTokenBalance.toString()).toEqual(depositAmount.toString());
    }, 60_000_000);

    it('should rollup all pending deposits', async () => {
      expect.assertions(1);

      const {
        zkApp,
        senderAccount,
        senderKey,
        token,
        waitForNextBlock,
        contractApi,
        fetchAccounts,
        fetchEventsZkApp,
        whitelistData,
      } = context();

      await fetchAccounts([senderAccount, zkApp.address]);
      const oldRootHash = zkApp.offchainStateRootHash.get();
      const tx = await contractApi.transaction(
        zkApp,
        { sender: senderAccount, fee: 1e9 },
        () => {
          zkApp.rollup();
        }
      );

      tx.sign([senderKey]);
      await tx.prove();
      await tx.send();
      await waitForNextBlock();
      await fetchAccounts([senderAccount, zkApp.address]);

      if (deployToBerkeley) {
        await zkApp.offchainStateRootHash.fetch();
      }

      const offchainStateRootHash = zkApp.offchainStateRootHash.get();
      Circuit.log('offchainStateRootHash', offchainStateRootHash);
      expect(offchainStateRootHash.toString()).not.toEqual(
        oldRootHash.toString()
      );
    }, 60_000_000);

    // This test does not work on berkley
    it.skip('should not allow update of the whitelist root without a proof', async () => {
      expect.assertions(1);

      const {
        zkApp,
        senderAccount,
        senderKey,
        zkAppPrivateKey,
        contractApi,
        fetchAccounts,
      } = context();

      await fetchAccounts([senderAccount, zkApp.address]);
      const tx = await contractApi.transaction(
        zkApp,
        { sender: senderAccount, fee: 1e9 },
        () => {
          zkApp.setWhitelistRootSigned(Field(0));
          zkApp.self.requireSignature();
          AccountUpdate.attachToTransaction(zkApp.self);
        }
      );
      await tx.prove();
      tx.sign([senderKey, zkAppPrivateKey]);
      const send = tx.send();
      expect(send).rejects.toBeTruthy();
    }, 60_000_000);
  }
);
