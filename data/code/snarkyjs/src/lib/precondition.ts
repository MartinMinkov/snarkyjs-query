import { Provable, Bool, Field } from '../snarky.js';
import { circuitValueEquals } from './circuit_value.js';
import { Circuit } from './circuit.js';
import * as Mina from './mina.js';
import { Actions, AccountUpdate, Preconditions } from './account_update.js';
import { Int64, UInt32, UInt64 } from './int.js';
import { Layout } from '../bindings/mina-transaction/gen/transaction.js';
import { jsLayout } from '../bindings/mina-transaction/gen/js-layout.js';
import { emptyReceiptChainHash, TokenSymbol } from './hash.js';
import { PublicKey } from './signature.js';
import { ZkappUri } from '../bindings/mina-transaction/transaction-leaves.js';

export {
  preconditions,
  Account,
  Network,
  CurrentSlot,
  assertPreconditionInvariants,
  cleanPreconditionsCache,
  AccountValue,
  NetworkValue,
  getAccountPreconditions,
};

function preconditions(accountUpdate: AccountUpdate, isSelf: boolean) {
  initializePreconditions(accountUpdate, isSelf);
  return {
    account: Account(accountUpdate),
    network: Network(accountUpdate),
    currentSlot: CurrentSlot(accountUpdate),
  };
}

// note: please keep the two precondition implementations separate
// so we can add customized fields easily

function Network(accountUpdate: AccountUpdate): Network {
  let layout =
    jsLayout.AccountUpdate.entries.body.entries.preconditions.entries.network;
  let context = getPreconditionContextExn(accountUpdate);
  let network: RawNetwork = preconditionClass(
    layout as Layout,
    'network',
    accountUpdate,
    context
  );
  let timestamp = {
    get() {
      let slot = network.globalSlotSinceGenesis.get();
      return globalSlotToTimestamp(slot);
    },
    getAndAssertEquals() {
      let slot = network.globalSlotSinceGenesis.getAndAssertEquals();
      return globalSlotToTimestamp(slot);
    },
    assertEquals(value: UInt64) {
      let { genesisTimestamp, slotTime } =
        Mina.activeInstance.getNetworkConstants();
      let slot = timestampToGlobalSlot(
        value,
        `Timestamp precondition unsatisfied: the timestamp can only equal numbers of the form ${genesisTimestamp} + k*${slotTime},\n` +
          `i.e., the genesis timestamp plus an integer number of slots.`
      );
      return network.globalSlotSinceGenesis.assertEquals(slot);
    },
    assertBetween(lower: UInt64, upper: UInt64) {
      let [slotLower, slotUpper] = timestampToGlobalSlotRange(lower, upper);
      return network.globalSlotSinceGenesis.assertBetween(slotLower, slotUpper);
    },
    assertNothing() {
      return network.globalSlotSinceGenesis.assertNothing();
    },
  };
  return { ...network, timestamp };
}

function Account(accountUpdate: AccountUpdate): Account {
  let layout =
    jsLayout.AccountUpdate.entries.body.entries.preconditions.entries.account;
  let context = getPreconditionContextExn(accountUpdate);
  let identity = (x: any) => x;
  let update: Update = {
    delegate: {
      ...preconditionSubclass(
        accountUpdate,
        'account.delegate',
        PublicKey,
        context
      ),
      ...updateSubclass(accountUpdate, 'delegate', identity),
    },
    verificationKey: updateSubclass(accountUpdate, 'verificationKey', identity),
    permissions: updateSubclass(accountUpdate, 'permissions', identity),
    zkappUri: updateSubclass(accountUpdate, 'zkappUri', ZkappUri.fromJSON),
    tokenSymbol: updateSubclass(accountUpdate, 'tokenSymbol', TokenSymbol.from),
    timing: updateSubclass(accountUpdate, 'timing', identity),
    votingFor: updateSubclass(accountUpdate, 'votingFor', identity),
  };
  return {
    ...preconditionClass(layout as Layout, 'account', accountUpdate, context),
    ...update,
  };
}

function updateSubclass<K extends keyof Update>(
  accountUpdate: AccountUpdate,
  key: K,
  transform: (value: UpdateValue[K]) => UpdateValueOriginal[K]
) {
  return {
    set(value: UpdateValue[K]) {
      accountUpdate.body.update[key].isSome = Bool(true);
      accountUpdate.body.update[key].value = transform(value);
    },
  };
}

function CurrentSlot(accountUpdate: AccountUpdate): CurrentSlot {
  let context = getPreconditionContextExn(accountUpdate);
  return {
    assertBetween(lower: UInt32, upper: UInt32) {
      context.constrained.add('validWhile');
      let property: RangeCondition<UInt32> =
        accountUpdate.body.preconditions.validWhile;
      property.isSome = Bool(true);
      property.value.lower = lower;
      property.value.upper = upper;
    },
  };
}

let unimplementedPreconditions: LongKey[] = [
  // unimplemented because its not checked in the protocol
  'network.stakingEpochData.seed',
  'network.nextEpochData.seed',
];

type BaseType = 'UInt64' | 'UInt32' | 'Field' | 'Bool' | 'PublicKey';
let baseMap = { UInt64, UInt32, Field, Bool, PublicKey };

function preconditionClass(
  layout: Layout,
  baseKey: any,
  accountUpdate: AccountUpdate,
  context: PreconditionContext
): any {
  if (layout.type === 'option') {
    // range condition
    if (layout.optionType === 'closedInterval') {
      let lower = layout.inner.entries.lower.type as BaseType;
      let baseType = baseMap[lower];
      return preconditionSubClassWithRange(
        accountUpdate,
        baseKey,
        baseType as any,
        context
      );
    }
    // value condition
    else if (layout.optionType === 'flaggedOption') {
      let baseType = baseMap[layout.inner.type as BaseType];
      return preconditionSubclass(
        accountUpdate,
        baseKey,
        baseType as any,
        context
      );
    }
  } else if (layout.type === 'array') {
    return {}; // not applicable yet, TODO if we implement state
  } else if (layout.type === 'object') {
    // for each field, create a recursive object
    return Object.fromEntries(
      layout.keys.map((key) => {
        let value = layout.entries[key];
        return [
          key,
          preconditionClass(value, `${baseKey}.${key}`, accountUpdate, context),
        ];
      })
    );
  } else throw Error('bug');
}

function preconditionSubClassWithRange<
  K extends LongKey,
  U extends FlatPreconditionValue[K]
>(
  accountUpdate: AccountUpdate,
  longKey: K,
  fieldType: Provable<U>,
  context: PreconditionContext
) {
  return {
    ...preconditionSubclass(accountUpdate, longKey, fieldType as any, context),
    assertBetween(lower: any, upper: any) {
      context.constrained.add(longKey);
      let property: RangeCondition<any> = getPath(
        accountUpdate.body.preconditions,
        longKey
      );
      property.isSome = Bool(true);
      property.value.lower = lower;
      property.value.upper = upper;
    },
  };
}

function preconditionSubclass<
  K extends LongKey,
  U extends FlatPreconditionValue[K]
>(
  accountUpdate: AccountUpdate,
  longKey: K,
  fieldType: Provable<U>,
  context: PreconditionContext
) {
  if (fieldType === undefined) {
    throw Error(`this.${longKey}: fieldType undefined`);
  }
  let obj = {
    get() {
      if (unimplementedPreconditions.includes(longKey)) {
        let self = context.isSelf ? 'this' : 'accountUpdate';
        throw Error(`${self}.${longKey}.get() is not implemented yet.`);
      }
      let { read, vars } = context;
      read.add(longKey);
      return (vars[longKey] ??= getVariable(
        accountUpdate,
        longKey,
        fieldType
      )) as U;
    },
    getAndAssertEquals() {
      let value = obj.get();
      obj.assertEquals(value);
      return value;
    },
    assertEquals(value: U) {
      context.constrained.add(longKey);
      let property = getPath(
        accountUpdate.body.preconditions,
        longKey
      ) as AnyCondition<U>;
      if ('isSome' in property) {
        property.isSome = Bool(true);
        if ('lower' in property.value && 'upper' in property.value) {
          property.value.lower = value;
          property.value.upper = value;
        } else {
          property.value = value;
        }
      } else {
        setPath(accountUpdate.body.preconditions, longKey, value);
      }
    },
    assertNothing() {
      context.constrained.add(longKey);
    },
  };
  return obj;
}

function getVariable<K extends LongKey, U extends FlatPreconditionValue[K]>(
  accountUpdate: AccountUpdate,
  longKey: K,
  fieldType: Provable<U>
): U {
  return Circuit.witness(fieldType, () => {
    let [accountOrNetwork, ...rest] = longKey.split('.');
    let key = rest.join('.');
    let value: U;
    if (accountOrNetwork === 'account') {
      let account = getAccountPreconditions(accountUpdate.body);
      value = account[key as keyof AccountValue] as U;
    } else if (accountOrNetwork === 'network') {
      let networkState = Mina.getNetworkState();
      value = getPath(networkState, key);
    } else if (accountOrNetwork === 'validWhile') {
      let networkState = Mina.getNetworkState();
      value = networkState.globalSlotSinceGenesis as U;
    } else {
      throw Error('impossible');
    }
    return value;
  });
}

function globalSlotToTimestamp(slot: UInt32) {
  let { genesisTimestamp, slotTime } =
    Mina.activeInstance.getNetworkConstants();
  return UInt64.from(slot).mul(slotTime).add(genesisTimestamp);
}
function timestampToGlobalSlot(timestamp: UInt64, message: string) {
  let { genesisTimestamp, slotTime } =
    Mina.activeInstance.getNetworkConstants();
  let { quotient: slot, rest } = timestamp
    .sub(genesisTimestamp)
    .divMod(slotTime);
  rest.value.assertEquals(Field(0), message);
  return slot.toUInt32();
}

function timestampToGlobalSlotRange(
  tsLower: UInt64,
  tsUpper: UInt64
): [lower: UInt32, upper: UInt32] {
  // we need `slotLower <= current slot <= slotUpper` to imply `tsLower <= current timestamp <= tsUpper`
  // so we have to make the range smaller -- round up `tsLower` and round down `tsUpper`
  // also, we should clamp to the UInt32 max range [0, 2**32-1]
  let { genesisTimestamp, slotTime } =
    Mina.activeInstance.getNetworkConstants();
  let tsLowerInt = Int64.from(tsLower)
    .sub(genesisTimestamp)
    .add(slotTime)
    .sub(1);
  let lowerCapped = Circuit.if<UInt64>(
    tsLowerInt.isPositive(),
    UInt64,
    tsLowerInt.magnitude,
    UInt64.from(0)
  );
  let slotLower = lowerCapped.div(slotTime).toUInt32Clamped();
  // unsafe `sub` means the error in case tsUpper underflows slot 0 is ugly, but should not be relevant in practice
  let slotUpper = tsUpper.sub(genesisTimestamp).div(slotTime).toUInt32Clamped();
  return [slotLower, slotUpper];
}

function getAccountPreconditions(body: {
  publicKey: PublicKey;
  tokenId?: Field;
}): AccountValue {
  let { publicKey, tokenId } = body;
  let hasAccount = Mina.hasAccount(publicKey, tokenId);
  if (!hasAccount) {
    return {
      balance: UInt64.zero,
      nonce: UInt32.zero,
      receiptChainHash: emptyReceiptChainHash(),
      actionState: Actions.emptyActionState(),
      delegate: publicKey,
      provedState: Bool(false),
      isNew: Bool(true),
    };
  }
  let account = Mina.getAccount(publicKey, tokenId);
  return {
    balance: account.balance,
    nonce: account.nonce,
    receiptChainHash: account.receiptChainHash,
    actionState: account.zkapp?.actionState?.[0] ?? Actions.emptyActionState(),
    delegate: account.delegate ?? account.publicKey,
    provedState: account.zkapp?.provedState ?? Bool(false),
    isNew: Bool(false),
  };
}

// per account update context for checking invariants on precondition construction
type PreconditionContext = {
  isSelf: boolean;
  vars: Partial<FlatPreconditionValue>;
  read: Set<LongKey>;
  constrained: Set<LongKey>;
};

function initializePreconditions(
  accountUpdate: AccountUpdate,
  isSelf: boolean
) {
  preconditionContexts.set(accountUpdate, {
    read: new Set(),
    constrained: new Set(),
    vars: {},
    isSelf,
  });
}

function cleanPreconditionsCache(accountUpdate: AccountUpdate) {
  let context = preconditionContexts.get(accountUpdate);
  if (context !== undefined) context.vars = {};
}

function assertPreconditionInvariants(accountUpdate: AccountUpdate) {
  let context = getPreconditionContextExn(accountUpdate);
  let self = context.isSelf ? 'this' : 'accountUpdate';
  let dummyPreconditions = Preconditions.ignoreAll();
  for (let preconditionPath of context.read) {
    // check if every precondition that was read was also contrained
    if (context.constrained.has(preconditionPath)) continue;

    // check if the precondition was modified manually, which is also a valid way of avoiding an error
    let precondition = getPath(
      accountUpdate.body.preconditions,
      preconditionPath
    );
    let dummy = getPath(dummyPreconditions, preconditionPath);
    if (!circuitValueEquals(precondition, dummy)) continue;

    // we accessed a precondition field but not constrained it explicitly - throw an error
    let hasAssertBetween = isRangeCondition(precondition);
    let shortPath = preconditionPath.split('.').pop();
    let errorMessage = `You used \`${self}.${preconditionPath}.get()\` without adding a precondition that links it to the actual ${shortPath}.
Consider adding this line to your code:
${self}.${preconditionPath}.assertEquals(${self}.${preconditionPath}.get());${
      hasAssertBetween
        ? `
You can also add more flexible preconditions with \`${self}.${preconditionPath}.assertBetween(...)\`.`
        : ''
    }`;
    throw Error(errorMessage);
  }
}

function getPreconditionContextExn(accountUpdate: AccountUpdate) {
  let c = preconditionContexts.get(accountUpdate);
  if (c === undefined) throw Error('bug: precondition context not found');
  return c;
}

const preconditionContexts = new WeakMap<AccountUpdate, PreconditionContext>();

// exported types

type NetworkPrecondition = Preconditions['network'];
type NetworkValue = PreconditionBaseTypes<NetworkPrecondition>;
type RawNetwork = PreconditionClassType<NetworkPrecondition>;
type Network = RawNetwork & {
  timestamp: PreconditionSubclassRangeType<UInt64>;
};

// TODO: should we add account.state?
// then can just use circuitArray(Field, 8) as the type
type AccountPrecondition = Omit<Preconditions['account'], 'state'>;
type AccountValue = PreconditionBaseTypes<AccountPrecondition>;
type Account = PreconditionClassType<AccountPrecondition> & Update;

type CurrentSlotPrecondition = Preconditions['validWhile'];
type CurrentSlot = {
  assertBetween(lower: UInt32, upper: UInt32): void;
};

type PreconditionBaseTypes<T> = {
  [K in keyof T]: T[K] extends RangeCondition<infer U>
    ? U
    : T[K] extends FlaggedOptionCondition<infer U>
    ? U
    : T[K] extends Field
    ? Field
    : PreconditionBaseTypes<T[K]>;
};

type PreconditionSubclassType<U> = {
  get(): U;
  getAndAssertEquals(): U;
  assertEquals(value: U): void;
  assertNothing(): void;
};
type PreconditionSubclassRangeType<U> = PreconditionSubclassType<U> & {
  assertBetween(lower: U, upper: U): void;
};

type PreconditionClassType<T> = {
  [K in keyof T]: T[K] extends RangeCondition<infer U>
    ? PreconditionSubclassRangeType<U>
    : T[K] extends FlaggedOptionCondition<infer U>
    ? PreconditionSubclassType<U>
    : T[K] extends Field
    ? PreconditionSubclassType<Field>
    : PreconditionClassType<T[K]>;
};

// update

type Update_ = Omit<AccountUpdate['body']['update'], 'appState'>;
type Update = {
  [K in keyof Update_]: { set(value: UpdateValue[K]): void };
};
type UpdateValueOriginal = {
  [K in keyof Update_]: Update_[K]['value'];
};
type UpdateValue = {
  [K in keyof Update_]: K extends 'zkappUri' | 'tokenSymbol'
    ? string
    : Update_[K]['value'];
};

// TS magic for computing flattened precondition types

type JoinEntries<K, P> = K extends string
  ? P extends [string, unknown, unknown]
    ? [`${K}${P[0] extends '' ? '' : '.'}${P[0]}`, P[1], P[2]]
    : never
  : never;

type PreconditionFlatEntry<T> = T extends RangeCondition<infer V>
  ? ['', T, V]
  : T extends FlaggedOptionCondition<infer U>
  ? ['', T, U]
  : { [K in keyof T]: JoinEntries<K, PreconditionFlatEntry<T[K]>> }[keyof T];

type FlatPreconditionValue = {
  [S in PreconditionFlatEntry<NetworkPrecondition> as `network.${S[0]}`]: S[2];
} & {
  [S in PreconditionFlatEntry<AccountPrecondition> as `account.${S[0]}`]: S[2];
} & { validWhile: PreconditionFlatEntry<CurrentSlotPrecondition>[2] };

type LongKey = keyof FlatPreconditionValue;

// types for the two kinds of conditions
type RangeCondition<T> = { isSome: Bool; value: { lower: T; upper: T } };
type FlaggedOptionCondition<T> = { isSome: Bool; value: T };
type AnyCondition<T> = RangeCondition<T> | FlaggedOptionCondition<T>;

function isRangeCondition<T extends object>(
  condition: AnyCondition<T>
): condition is RangeCondition<T> {
  return 'isSome' in condition && 'lower' in condition.value;
}

// helper. getPath({a: {b: 'x'}}, 'a.b') === 'x'
// TODO: would be awesome to type this
function getPath(obj: any, path: string) {
  let pathArray = path.split('.').reverse();
  while (pathArray.length > 0) {
    let key = pathArray.pop();
    obj = obj[key as any];
  }
  return obj;
}
function setPath(obj: any, path: string, value: any) {
  let pathArray = path.split('.');
  let key = pathArray.pop()!;
  getPath(obj, pathArray.join('.'))[key] = value;
}
