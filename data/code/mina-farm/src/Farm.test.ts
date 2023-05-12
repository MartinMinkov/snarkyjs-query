import {
  AccountUpdate,
  Field,
  PrivateKey,
  Signature,
  UInt32,
  UInt64,
} from 'snarkyjs';

import { Farm } from './Farm.js';
import describeContract, {
  getEventByType,
  getLatestEvent,
} from './describeContract.js';

import { Program, ProgramInput } from './zkProgram.js';
import { Key } from '@zkfs/contract-api';

const fee = 1e8;

describeContract<Farm>('farm', Farm, Program, (context) => {
  async function deploy(mintBalance: UInt64) {
    const {
      deployerAccount,
      deployerKey,
      zkAppPrivateKey,
      zkApp,
      contractApi,
      token,
      senderAccount,
      fetchAccounts,
    } = context();

    Farm.tokenSmartContractAddress = token.address;
    await fetchAccounts([token.address]);
    const tx = await contractApi.transaction(
      zkApp,
      { sender: deployerAccount, fee: 2e8 },
      () => {
        AccountUpdate.fundNewAccount(deployerAccount, 2);
        zkApp.deploy();
        token.approveAccountUpdate(zkApp.self);
        token.mint(senderAccount, UInt64.from(mintBalance));
      }
    );
    await tx.prove();

    await tx.sign([deployerKey, zkAppPrivateKey]).send();
    return tx;
  }

  // successful run https://berkeley.minaexplorer.com/wallet/B62qrSJj9c4R9ctkLn5hw3T9atZDD3Sem6LCKHFW7ZLPGnGtVfo6gMm/zkapp-transactions
  it('deploys token contract with initial balance', async () => {
    expect.assertions(1);

    const mintBalance = UInt64.from(32);
    await deploy(mintBalance);

    const { token, waitForNextBlock, fetchAccounts, senderAccount } = context();

    await waitForNextBlock();

    await fetchAccounts([token.address]);
    await fetchAccounts([senderAccount], token.token.id);

    const balance = token.balanceOf(senderAccount);

    expect(balance).toStrictEqual(mintBalance);
  }, 2_000_000);

  /**
   * block 1 | block 2 | block 3    | block 4  | block 5   | block 6
   * deploy  | deposit | rollup d.  | claim    | wait      | rollup c.
   *         |         | rew. start | reward 5 | reward 10 | reward 15
   *
   * successful run https://berkeley.minaexplorer.com/wallet/B62qn1pTUmftJL179Pjn6QsUtVEsFtUajfYz516JivpUvBuvcTf7V1K/zkapp-transactions
   */
  it('dispatches 1 deposit action & calls rollup, then dispatches 1 claim action & calls rollup on `Farm` smart contract', async () => {
    expect.assertions(6);

    const {
      senderAccount,
      senderKey,
      zkApp,
      contractApi,
      waitForNextBlock,
      fetchAccounts,
      token,
    } = context();

    const mintBalance = UInt64.from(32);
    const tx0 = await deploy(mintBalance);
    contractApi.restoreLatest(zkApp);

    await waitForNextBlock();

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    await fetchAccounts([senderAccount], token.token.id);

    console.log('Farm.deploy() successful, initial offchain state:', {
      offchainStateRootHash: zkApp.offchainStateRootHash.get().toString(),
      data: zkApp.virtualStorage?.data[zkApp.address.toBase58()],
      tx: tx0.toPretty(),
    });

    console.log('Farm.deposit(), dispatching an action...');

    const depositAmount = UInt64.from(30);
    const dispatchDepositTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        AccountUpdate.fundNewAccount(senderAccount);
        zkApp.deposit(senderAccount, depositAmount);
      }
    );
    await dispatchDepositTx.prove();
    await dispatchDepositTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log('Farm.deposit() successful', dispatchDepositTx.toPretty());

    await waitForNextBlock();

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    await fetchAccounts([senderAccount], token.token.id);
    await fetchAccounts([zkApp.address], token.token.id);

    const senderBalanceAfterDeposit = token.balanceOf(senderAccount);
    expect(senderBalanceAfterDeposit).toStrictEqual(
      mintBalance.sub(depositAmount)
    );

    const balanceZkAppAfterDeposit = token.balanceOf(zkApp.address);
    expect(balanceZkAppAfterDeposit).toStrictEqual(depositAmount);

    console.log('Farm.rollup(), rolling up actions...');

    const rollupTx1 = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.rollup();
        token.approveAccountUpdate(zkApp.self);
      }
    );

    await rollupTx1.prove();
    await rollupTx1.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    await waitForNextBlock();
    // wait for 100 seconds before fetching account state
    await new Promise((resolve) => setTimeout(resolve, 100_000));

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    console.log(
      'events after deposit rollup',
      JSON.stringify(await zkApp.fetchEvents(), null, 2)
    );

    console.log('Farm.rollup() successful, new offchain state:', {
      offchainStateRootHash: zkApp.offchainStateRootHash.get().toString(),
      data: zkApp.virtualStorage?.data[zkApp.address.toBase58()],
      deposit: zkApp.virtualStorage?.getSerializedValue(
        zkApp.address.toBase58(),
        Key.fromString('root').toString(),
        Farm.addressToKey(senderAccount).toString()
      ),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      tx: rollupTx1.toPretty(),
    });

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    const farmData = zkApp.farmData.get();
    expect(farmData.totalStakedBalance).toStrictEqual(depositAmount);

    const dispatchClaimTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.claim(senderAccount);
      }
    );
    await dispatchClaimTx.prove();
    await dispatchClaimTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log('Farm.claim() successful');

    await waitForNextBlock();
    await waitForNextBlock();

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    const rollupTx2 = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.rollup();
        token.approveAccountUpdate(zkApp.self);
      }
    );
    await rollupTx2.prove();
    const sentRollupTx = await rollupTx2.sign([senderKey]).send();
    console.log('sent rollup tx2', sentRollupTx.isSuccess);

    console.log('rolluptx2', rollupTx2.toPretty());

    contractApi.restoreLatest(zkApp);

    await waitForNextBlock();
    // wait for 30 seconds before fetching events
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    const events = await zkApp.fetchEvents();

    console.log('all events', JSON.stringify(events, null, 2));
    const userRewardEvents = getEventByType(events, 'userReward');
    const userReward = getLatestEvent(userRewardEvents);
    expect(userReward?.event.data.toString()).toBe('15'); // 3 blocks * 5 reward per block = 15 reward

    const totalStakedBalances = getEventByType(events, 'totalStakedBalance');
    const totalStakedBalance = getLatestEvent(totalStakedBalances);
    expect(totalStakedBalance?.event.data.toString()).toBe(
      depositAmount.toString() // deposit amount is 30
    );

    const accumulatedRewardPerShares = getEventByType(
      events,
      'accumulatedRewardsPerShare'
    );
    const accumulatedRewardsPerShare = getLatestEvent(
      accumulatedRewardPerShares
    );
    expect(accumulatedRewardsPerShare?.event.data.toString()).toBe('500000'); // 5 reward per block * 10^6 (precision)
  }, 60_000_000);

  /**
   * slightly different from the previous test case,
   * because we want to force precision loss in the reward calculation
   *
   * block 1 | block 2 | block 3    | block 4  | block 5
   * deploy  | deposit | rollup d.  | withdraw | rollup w.
   *         |         | rew. start | 5 reward | 10 reward
   *
   * successful run https://berkeley.minaexplorer.com/wallet/B62qnE3BoCZ5zSmXWjkHVmtL4hvhJvJjgEHshRD85EgsBNwPpc2gywS/zkapp-transactions
   */
  it('dispatches 1 deposit action & calls rollup, then dispatches 1 withdraw action & calls rollup on `Farm` smart contract', async () => {
    expect.assertions(6);

    const {
      senderAccount,
      senderKey,
      zkApp,
      contractApi,
      waitForNextBlock,
      fetchAccounts,
      token,
    } = context();

    const mintBalance = UInt64.from(32);
    const tx0 = await deploy(mintBalance);
    contractApi.restoreLatest(zkApp);

    await waitForNextBlock();

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    await fetchAccounts([senderAccount], token.token.id);

    console.log('Farm.deploy() successful, initial offchain state:', {
      offchainStateRootHash: zkApp.offchainStateRootHash.get().toString(),
      data: zkApp.virtualStorage?.data[zkApp.address.toBase58()],
      tx: tx0.toPretty(),
    });

    console.log('Farm.deposit(), dispatching an action...');

    const depositAmount = UInt64.from(30);
    const dispatchDepositTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        AccountUpdate.fundNewAccount(senderAccount);
        zkApp.deposit(senderAccount, depositAmount);
      }
    );
    await dispatchDepositTx.prove();
    await dispatchDepositTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log('Farm.deposit() successful', dispatchDepositTx.toPretty());

    await waitForNextBlock();

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    await fetchAccounts([senderAccount], token.token.id);
    await fetchAccounts([zkApp.address], token.token.id);

    const senderBalanceAfterDeposit = token.balanceOf(senderAccount);
    expect(senderBalanceAfterDeposit).toStrictEqual(
      mintBalance.sub(depositAmount)
    );

    const balanceZkAppAfterDeposit = token.balanceOf(zkApp.address);
    expect(balanceZkAppAfterDeposit).toStrictEqual(depositAmount);

    console.log('Farm.rollup(), rolling up actions...');

    const rollupTx1 = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.rollup();
        token.approveAccountUpdate(zkApp.self);
      }
    );

    await rollupTx1.prove();
    await rollupTx1.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    await waitForNextBlock();
    // wait for 60 seconds before fetching account state
    await new Promise((resolve) => setTimeout(resolve, 60_000));

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    console.log('Farm.rollup() successful, new offchain state:', {
      offchainStateRootHash: zkApp.offchainStateRootHash.get().toString(),
      data: zkApp.virtualStorage?.data[zkApp.address.toBase58()],
      deposit: zkApp.virtualStorage?.getSerializedValue(
        zkApp.address.toBase58(),
        Key.fromString('root').toString(),
        Farm.addressToKey(senderAccount).toString()
      ),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      tx: rollupTx1.toPretty(),
    });

    await fetchAccounts([senderAccount, zkApp.address, token.address]);
    const farmData = zkApp.farmData.get();
    expect(farmData.totalStakedBalance).toStrictEqual(depositAmount);

    const dispatchWithdrawTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.withdraw(senderAccount);
      }
    );
    await dispatchWithdrawTx.prove();
    await dispatchWithdrawTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log('Farm.withdraw() successful');

    await waitForNextBlock();
    // wait for 60 seconds before fetching account state
    await new Promise((resolve) => setTimeout(resolve, 60_000));

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    const rollupTx2 = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.rollup();
        token.approveAccountUpdate(zkApp.self);
      }
    );
    await rollupTx2.prove();
    await rollupTx2.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log('Second rollup successful', rollupTx2.toPretty());

    await waitForNextBlock();
    // wait for 60 seconds before fetching account state
    await new Promise((resolve) => setTimeout(resolve, 60_000));

    await fetchAccounts([senderAccount, zkApp.address, token.address]);

    const events = await zkApp.fetchEvents();
    console.log('all withdraw events', JSON.stringify(events, null, 2));

    const totalStakedBalances = getEventByType(events, 'totalStakedBalance');
    const totalStakedBalance = getLatestEvent(totalStakedBalances);
    expect(totalStakedBalance?.event.data.toString()).toBe('0');

    const accumulatedRewardPerShares = getEventByType(
      events,
      'accumulatedRewardsPerShare'
    );
    const accumulatedRewardsPerShare = getLatestEvent(
      accumulatedRewardPerShares
    );
    expect(accumulatedRewardsPerShare?.event.data.toString()).toBe('333333'); // 2 blocks * 5 reward/block / 30 (total stake) * 10^6 (precision)

    const userRewardEvents = getEventByType(events, 'userReward');
    const userReward = getLatestEvent(userRewardEvents);

    // 2 blocks * 5 reward per block = 10 reward, but due to precision loss,
    // internal value is 9 instead of 10 (floating point representation would be 9.9999..)
    // please note that this loss is not a "whole" custom token, but 1/10^9 = 1e-9,
    // which is negligible in practice
    expect(userReward?.event.data.toString()).toBe('9');
  }, 60_000_000);

  // successful run https://berkeley.minaexplorer.com/wallet/B62qpAk2Fn34AzoiLnoHedwk1cuAxYS8xfrfrSC9gR7gTfitfbLhXX8/zkapp-transactions
  it('can update rewards per block with a proof', async () => {
    expect.assertions(4);

    const {
      senderAccount,
      senderKey,
      zkProgram,
      contractApi,
      zkApp,
      token,
      waitForNextBlock,
      fetchAccounts,
    } = context();

    const mintBalance = UInt64.from(32);
    await deploy(mintBalance);

    await waitForNextBlock();
    await fetchAccounts([zkApp.address, senderAccount]);

    const initialAdmin = zkApp.admin.get();
    expect(initialAdmin.toBase58()).toBe(zkApp.defaultAdmin.toBase58());

    // this sets admin to sender account, which is needed for updateRewardsPerBlock()
    const setAdminTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.setAdmin(senderAccount);
        token.approveAccountUpdate(zkApp.self);
      }
    );
    await setAdminTx.prove();
    await setAdminTx.sign([senderKey]).send();
    console.log('Farm.setAdmin() successful', setAdminTx.toPretty());

    contractApi.restoreLatest(zkApp);
    await waitForNextBlock();
    await fetchAccounts([zkApp.address, senderAccount]);

    // assert that the admin has changed
    const admin = zkApp.admin.get();
    expect(admin.toBase58()).toBe(senderAccount.toBase58());

    await zkProgram.compile();
    const programInput = new ProgramInput({
      permissionUntilBlockHeight: UInt32.from(10_000),
      publicKey: senderAccount,
      signature: Signature.create(senderKey, Field(0).toFields()),
    });
    const proof = await zkProgram.run(programInput);

    const previousRewardsPerBlock = zkApp.rewardPerBlock.get();
    const newRewardPerBlock = UInt64.from(100);

    const updateRewardsPerBlockTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.updateRewardsPerBlock(proof, newRewardPerBlock);
        token.approveAccountUpdate(zkApp.self);
      }
    );
    await updateRewardsPerBlockTx.prove();
    await updateRewardsPerBlockTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);

    console.log(
      'Farm.updateRewardsPerBlock() successful',
      updateRewardsPerBlockTx.toPretty()
    );

    await waitForNextBlock();
    await fetchAccounts([zkApp.address]);

    expect(zkApp.rewardPerBlock.get()).toStrictEqual(newRewardPerBlock);
    expect(zkApp.rewardPerBlock.get()).not.toStrictEqual(
      previousRewardsPerBlock
    );
  }, 60_000_000);

  // successful run https://berkeley.minaexplorer.com/wallet/B62qk8gFnuZQZoKwea5HxaYbSJeudVVVkYJe1wgT7pBEFeEDQpKex5c/zkapp-transactions
  it('fails to update rewards per block with a proof done by an account other than the admin', async () => {
    expect.assertions(3);

    const {
      senderAccount,
      senderKey,
      zkProgram,
      contractApi,
      zkApp,
      token,
      waitForNextBlock,
      fetchAccounts,
    } = context();

    const mintBalance = UInt64.from(32);
    await deploy(mintBalance);

    await waitForNextBlock();
    await fetchAccounts([zkApp.address, senderAccount]);

    const initialAdmin = zkApp.admin.get();
    expect(initialAdmin.toBase58()).toBe(zkApp.defaultAdmin.toBase58());

    // this sets admin to sender account, which is needed for updateRewardsPerBlock()
    const setAdminTx = await contractApi.transaction(
      zkApp,
      { sender: senderAccount, fee },
      () => {
        zkApp.setAdmin(senderAccount);
        token.approveAccountUpdate(zkApp.self);
      }
    );
    await setAdminTx.prove();
    await setAdminTx.sign([senderKey]).send();

    contractApi.restoreLatest(zkApp);
    await waitForNextBlock();
    await fetchAccounts([zkApp.address, senderAccount]);

    // assert that the admin has changed
    const admin = zkApp.admin.get();
    expect(admin.toBase58()).toBe(senderAccount.toBase58());

    await zkProgram.compile();
    const chuckKey = PrivateKey.random();
    const chuckAccount = chuckKey.toPublicKey();
    const programInput = new ProgramInput({
      permissionUntilBlockHeight: UInt32.from(10_000),
      publicKey: chuckAccount,
      signature: Signature.create(chuckKey, Field(0).toFields()),
    });
    const proof = await zkProgram.run(programInput);

    try {
      const newRewardPerBlock = UInt64.from(100);
      const updateRewardsPerBlockTx = await contractApi.transaction(
        zkApp,
        { sender: senderAccount, fee },
        () => {
          zkApp.updateRewardsPerBlock(proof, newRewardPerBlock);
          token.approveAccountUpdate(zkApp.self);
        }
      );
      await updateRewardsPerBlockTx.prove();
      await updateRewardsPerBlockTx.sign([senderKey]).send();
    } catch (error) {
      expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).toMatch(
        /(Error: assert_equal)/i
      );
    }
  }, 60_000_000);
});
