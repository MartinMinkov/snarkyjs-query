import {
  AccountUpdate,
  Mina,
  isReady,
  Permissions,
  PrivateKey,
  UInt64,
} from 'snarkyjs';
import { createDex, TokenContract, addresses, keys, tokenIds } from './dex.js';
import { expect } from 'expect';
import { getProfiler } from '../../profiler.js';

await isReady;

let proofsEnabled = false;

console.log('starting upgradeability tests');

await upgradeabilityTests({
  withVesting: false,
});
console.log('all upgradeability tests were successful! 🎉');

console.log('starting atomic actions tests');

await atomicActionsTest({
  withVesting: false,
});

console.log('all atomic actions tests were successful!');

async function atomicActionsTest({ withVesting }: { withVesting: boolean }) {
  const DexProfiler = getProfiler('DEX profiler atomic actions');
  DexProfiler.start('DEX test flow');
  let Local = Mina.LocalBlockchain({
    proofsEnabled,
    enforceTransactionLimits: false,
  });
  Mina.setActiveInstance(Local);
  let accountFee = Mina.accountCreationFee();
  let [{ privateKey: feePayerKey, publicKey: feePayerAddress }] =
    Local.testAccounts;
  let tx, balances;

  let options = withVesting ? { lockedLiquiditySlots: 2 } : undefined;
  let { Dex, DexTokenHolder, getTokenBalances } = createDex(options);

  // analyze methods for quick error feedback
  DexTokenHolder.analyzeMethods();
  Dex.analyzeMethods();

  if (proofsEnabled) {
    // compile & deploy all zkApps
    console.log('compile (dex token holder)...');
    await DexTokenHolder.compile();
    console.log('compile (dex main contract)...');
    await Dex.compile();
  }

  let tokenX = new TokenContract(addresses.tokenX);
  let tokenY = new TokenContract(addresses.tokenY);
  let dex = new Dex(addresses.dex);
  let dexTokenHolderX = new DexTokenHolder(addresses.dex, tokenIds.X);
  let dexTokenHolderY = new DexTokenHolder(addresses.dex, tokenIds.Y);

  console.log('deploy & init token contracts...');
  tx = await Mina.transaction(feePayerAddress, () => {
    // pay fees for creating 2 token contract accounts, and fund them so each can create 2 accounts themselves
    let feePayerUpdate = AccountUpdate.fundNewAccount(feePayerAddress, 2);
    feePayerUpdate.send({ to: addresses.tokenX, amount: accountFee.mul(2) });
    feePayerUpdate.send({ to: addresses.tokenY, amount: accountFee.mul(2) });
    tokenX.deploy();
    tokenY.deploy();
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.tokenX, keys.tokenY]);
  await tx.send();
  balances = getTokenBalances();
  console.log(
    'Token contract tokens (X, Y):',
    balances.tokenContract.X,
    balances.tokenContract.Y
  );

  /**
   * # Atomic Actions 1
   *
   * Preconditions:
   *  - SC deployed with a non-writable delegate field (impossible permission)
   *
   * Actions:
   *  - User sets permissions for delegate to be edible
   *  - User changes delegate field to something
   *
   * Expected:
   *  - delegate now holds a new address
   */

  console.log('deploy dex contracts...');
  tx = await Mina.transaction(feePayerAddress, () => {
    // pay fees for creating 3 dex accounts
    AccountUpdate.fundNewAccount(feePayerAddress, 3);
    dex.deploy();
    dexTokenHolderX.deploy();
    tokenX.approveUpdate(dexTokenHolderX.self);
    dexTokenHolderY.deploy();
    tokenY.approveUpdate(dexTokenHolderY.self);
    console.log('manipulating setDelegate field to impossible...');
    // setting the setDelegate permission field to impossible
    let dexAccount = AccountUpdate.create(addresses.dex);
    dexAccount.account.permissions.set({
      ...Permissions.initial(),
      setDelegate: Permissions.impossible(),
    });
    dexAccount.requireSignature();
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.dex]);
  await tx.send();

  console.log(
    'trying to change delegate (setDelegate=impossible, should fail)'
  );
  tx = await Mina.transaction(feePayerAddress, () => {
    // setting the delegate field to something, although permissions forbid it
    let dexAccount = AccountUpdate.create(addresses.dex);
    dexAccount.account.delegate.set(PrivateKey.random().toPublicKey());
    dexAccount.requireSignature();
  });
  await tx.prove();

  await expect(tx.sign([feePayerKey, keys.dex]).send()).rejects.toThrow(
    /Cannot update field 'delegate'/
  );

  console.log('changing delegate permission back to normal');

  tx = await Mina.transaction(feePayerAddress, () => {
    let dexAccount = AccountUpdate.create(addresses.dex);
    dexAccount.account.permissions.set({
      ...Permissions.initial(),
      setDelegate: Permissions.proofOrSignature(),
    });
    dexAccount.requireSignature();
  });
  await tx.prove();
  await tx.sign([feePayerKey, keys.dex]).send();

  console.log('changing delegate field to a new address');

  let newDelegate = PrivateKey.random().toPublicKey();
  tx = await Mina.transaction(feePayerAddress, () => {
    let dexAccount = AccountUpdate.create(addresses.dex);
    dexAccount.account.delegate.set(newDelegate);
    dexAccount.requireSignature();
  });
  await tx.prove();
  await tx.sign([feePayerKey, keys.dex]).send();

  Mina.getAccount(addresses.dex).delegate?.assertEquals(newDelegate);

  /**
   * # Atomic Actions 2
   *
   * Preconditions:
   *  - Similar to happy path (SC deployed), but changing order of transaction and updates (within one transaction)
   *
   * Actions:
   *  - Include multiple actions of different order in the same transaction
   *
   * Expected:
   *  - tx fails if the order of actions is not valid
   */

  console.log(
    'changing permission to impossible and then trying to change delegate field - in one transaction'
  );

  tx = await Mina.transaction(feePayerAddress, () => {
    // changing the permission to impossible and then trying to change the delegate field

    let permissionUpdate = AccountUpdate.create(addresses.dex);
    permissionUpdate.account.permissions.set({
      ...Permissions.initial(),
      setDelegate: Permissions.impossible(),
    });
    permissionUpdate.requireSignature();

    let fieldUpdate = AccountUpdate.create(addresses.dex);
    fieldUpdate.account.delegate.set(PrivateKey.random().toPublicKey());
    fieldUpdate.requireSignature();
  });
  await tx.prove();
  await expect(tx.sign([feePayerKey, keys.dex]).send()).rejects.toThrow(
    /Update_not_permitted_delegate/
  );

  /**
   * # Atomic Actions 3
   *
   * Preconditions:
   *  - Similar to happy path (SC deployed) and the test before, but editing fields and changing permissions will be successful
   *
   * Actions:
   *  - Include multiple actions in one transaction
   *    edit field -> change permission back -> successful state transition
   *
   * Expected:
   *  - tx is successful and state updated
   */

  console.log('creating multiple valid account updates in one transaction');

  newDelegate = PrivateKey.random().toPublicKey();
  tx = await Mina.transaction(feePayerAddress, () => {
    // changing field
    let fieldUpdate = AccountUpdate.create(addresses.dex);
    fieldUpdate.account.delegate.set(newDelegate);
    fieldUpdate.requireSignature();

    // changing permissions back to impossible
    let permissionUpdate2 = AccountUpdate.create(addresses.dex);
    permissionUpdate2.account.permissions.set({
      ...Permissions.initial(),
      setDelegate: Permissions.impossible(),
    });
    permissionUpdate2.requireSignature();
  });
  await tx.prove();
  await tx.sign([feePayerKey, keys.dex]).send();

  Mina.getAccount(addresses.dex).delegate?.assertEquals(newDelegate);
  DexProfiler.stop().store();
}

async function upgradeabilityTests({ withVesting }: { withVesting: boolean }) {
  const DexProfiler = getProfiler('DEX profiler upgradeability tests');
  DexProfiler.start('DEX test flow');
  let Local = Mina.LocalBlockchain({
    proofsEnabled: proofsEnabled,
    enforceTransactionLimits: false,
  });
  Mina.setActiveInstance(Local);
  let accountFee = Mina.accountCreationFee();
  let [{ privateKey: feePayerKey, publicKey: feePayerAddress }] =
    Local.testAccounts;
  let tx, balances, oldBalances;

  let options = withVesting ? { lockedLiquiditySlots: 2 } : undefined;
  let {
    Dex,
    DexTokenHolder,
    ModifiedDexTokenHolder,
    ModifiedDex,
    getTokenBalances,
  } = createDex(options);

  // analyze methods for quick error feedback
  DexTokenHolder.analyzeMethods();
  Dex.analyzeMethods();

  // compile & deploy all zkApps
  console.log('compile (token contract)...');
  await TokenContract.compile();
  console.log('compile (dex token holder)...');
  await DexTokenHolder.compile();
  console.log('compile (dex main contract)...');
  await Dex.compile();

  let tokenX = new TokenContract(addresses.tokenX);
  let tokenY = new TokenContract(addresses.tokenY);
  let dex = new Dex(addresses.dex);

  console.log('deploy & init token contracts...');
  tx = await Mina.transaction(feePayerAddress, () => {
    // pay fees for creating 2 token contract accounts, and fund them so each can create 2 accounts themselves
    let feePayerUpdate = AccountUpdate.createSigned(feePayerAddress);
    feePayerUpdate.balance.subInPlace(accountFee.mul(2));
    feePayerUpdate.send({ to: addresses.tokenX, amount: accountFee.mul(2) });
    feePayerUpdate.send({ to: addresses.tokenY, amount: accountFee.mul(2) });
    tokenX.deploy();
    tokenY.deploy();
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.tokenX, keys.tokenY]);
  await tx.send();
  balances = getTokenBalances();
  console.log(
    'Token contract tokens (X, Y):',
    balances.tokenContract.X,
    balances.tokenContract.Y
  );

  /**
   * # Upgradeability 1 - Happy Path
   *
   * Preconditions:
   *  - Initially the SC was deployed with the ability to be upgradable
   *
   * Actions:
   *  - deploy valid SC with upgradeable permissions
   *  - compile and upgrade new contract with different source code
   *  - set permissions to be non upgradeable
   *
   * Expected:
   *  - upgrade is successful
   *  - updates to the source code and methods are recognized
   *    (e.g. new formula applies to the swap)
   */

  console.log('deploy dex contracts...');

  tx = await Mina.transaction(feePayerKey, () => {
    // pay fees for creating 3 dex accounts
    AccountUpdate.fundNewAccount(feePayerAddress, 3);
    dex.deploy();
    tokenX.deployZkapp(addresses.dex, DexTokenHolder._verificationKey!);
    tokenY.deployZkapp(addresses.dex, DexTokenHolder._verificationKey!);
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.dex]);
  await tx.send();

  console.log('transfer tokens to user');
  tx = await Mina.transaction(
    { sender: feePayerAddress, fee: accountFee.mul(1) },
    () => {
      let feePayer = AccountUpdate.createSigned(feePayerAddress);
      feePayer.balance.subInPlace(Mina.accountCreationFee().mul(4));
      feePayer.send({ to: addresses.user, amount: 20e9 }); // give users MINA to pay fees
      feePayer.send({ to: addresses.user2, amount: 20e9 });
      // transfer to fee payer so they can provide initial liquidity
      tokenX.transfer(addresses.tokenX, feePayerAddress, UInt64.from(10_000));
      tokenY.transfer(addresses.tokenY, feePayerAddress, UInt64.from(10_000));
      // mint tokens to the user (this is additional to the tokens minted at the beginning, so we can overflow the balance
      tokenX.init2();
      tokenY.init2();
    }
  );
  await tx.prove();
  tx.sign([feePayerKey, keys.tokenX, keys.tokenY]);
  await tx.send();
  [oldBalances, balances] = [balances, getTokenBalances()];
  console.log('User tokens (X, Y):', balances.user.X, balances.user.Y);
  console.log('User MINA:', balances.user.MINA);

  console.log(
    'deploying an upgraded DexTokenHolder contract (adjusted swap method) and Dex contract'
  );

  console.log('compiling modified DexTokenHolder contract...');
  await ModifiedDexTokenHolder.compile();

  console.log('compiling modified Dex contract...');
  await ModifiedDex.compile();
  let modifiedDex = new ModifiedDex(addresses.dex);

  tx = await Mina.transaction(feePayerAddress, () => {
    modifiedDex.deploy();
    tokenX.deployZkapp(addresses.dex, ModifiedDexTokenHolder._verificationKey!);
    tokenY.deployZkapp(addresses.dex, ModifiedDexTokenHolder._verificationKey!);
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.dex]);
  await tx.send();

  // Making sure that both token holder accounts have been updated with the new modified verification key
  expect(
    Mina.getAccount(addresses.dex, tokenX.token.id).zkapp?.verificationKey?.data
  ).toEqual(ModifiedDexTokenHolder._verificationKey?.data);

  expect(
    Mina.getAccount(addresses.dex, tokenY.token.id).zkapp?.verificationKey?.data
  ).toEqual(ModifiedDexTokenHolder._verificationKey?.data);

  // this is important; we have to re-enable proof production (and verification) to make sure the proofs are valid against the newly deployed VK
  Local.setProofsEnabled(true);

  console.log('supply liquidity -- base');
  tx = await Mina.transaction(
    { sender: feePayerAddress, fee: accountFee.mul(1) },
    () => {
      AccountUpdate.fundNewAccount(feePayerAddress);
      modifiedDex.supplyLiquidityBase(UInt64.from(10_000), UInt64.from(10_000));
    }
  );
  await tx.prove();
  tx.sign([feePayerKey]);
  await tx.send();
  [oldBalances, balances] = [balances, getTokenBalances()];
  console.log('DEX liquidity (X, Y):', balances.dex.X, balances.dex.Y);

  let USER_DX = 10n;
  console.log('swap 10 X for Y');
  tx = await Mina.transaction(addresses.user, () => {
    modifiedDex.swapX(UInt64.from(USER_DX));
  });
  await tx.prove();
  await tx.sign([keys.user]).send();
  [oldBalances, balances] = [balances, getTokenBalances()];
  console.log('User tokens (X, Y):', balances.user.X, balances.user.Y);

  // according to the newly modified formula `dy = y.mul(dx).div(x.add(dx)).add(15)`;
  // the user should have a balance of 1_000_024 Y
  expect(oldBalances.user.Y).toEqual(1_000_000n);
  expect(balances.user.Y).toEqual(1_000_024n);

  /**
   * # Upgradeability 2 and 3 - Upgrading forbidden, previous methods should still be valid
   *
   * Preconditions:
   *  - DEX contract deployed, but upgrading forbidden
   *
   * Actions:
   *  - setVerificationKey permission to impossible
   *  - try upgrading contract
   *
   * Expected:
   *  - tx fails and contract cannot be upgraded
   *  - methods from the previous contract should still be valid
   */

  console.log('changing upgrade permissions to impossible');

  tx = await Mina.transaction(feePayerAddress, () => {
    // pay fees for creating 3 dex accounts
    let update = AccountUpdate.createSigned(addresses.dex);
    update.account.permissions.set({
      ...Permissions.initial(),
      setVerificationKey: Permissions.impossible(),
    });
  });
  await tx.prove();
  tx.sign([feePayerKey, keys.dex]);
  await tx.send();

  console.log('trying to upgrade contract - should fail');

  tx = await Mina.transaction(feePayerAddress, () => {
    modifiedDex.deploy(); // cannot deploy new VK because its forbidden
  });
  await tx.prove();
  await expect(tx.sign([feePayerKey, keys.dex]).send()).rejects.toThrow(
    /Cannot update field 'verificationKey'/
  );

  console.log('trying to invoke modified swap method');
  // method should still be valid since the upgrade was forbidden
  USER_DX = 10n;
  console.log('swap 10 X for Y');
  tx = await Mina.transaction(addresses.user, () => {
    modifiedDex.swapX(UInt64.from(USER_DX));
  });
  await tx.prove();
  await tx.sign([keys.user]).send();
  DexProfiler.stop().store();
}
