# Class: AccountUpdate

An [AccountUpdate](AccountUpdate.md) is a set of instructions for the Mina network.
It includes Preconditions and a list of state updates, which need to
be authorized by either a [Signature](Signature.md) or [Proof](Proof.md).

## Implements

- [`AccountUpdate`](../modules/Types.md#accountupdate-1)

## Table of contents

### Constructors

- [constructor](AccountUpdate.md#constructor)

### Properties

- [account](AccountUpdate.md#account)
- [authorization](AccountUpdate.md#authorization)
- [body](AccountUpdate.md#body)
- [children](AccountUpdate.md#children)
- [currentSlot](AccountUpdate.md#currentslot)
- [id](AccountUpdate.md#id)
- [isSelf](AccountUpdate.md#isself)
- [label](AccountUpdate.md#label)
- [lazyAuthorization](AccountUpdate.md#lazyauthorization)
- [network](AccountUpdate.md#network)
- [parent](AccountUpdate.md#parent)
- [Actions](AccountUpdate.md#actions)
- [Layout](AccountUpdate.md#layout)
- [check](AccountUpdate.md#check)
- [signingInfo](AccountUpdate.md#signinginfo)
- [sizeInFields](AccountUpdate.md#sizeinfields)
- [toFields](AccountUpdate.md#tofields)
- [toInput](AccountUpdate.md#toinput)

### Accessors

- [balance](AccountUpdate.md#balance)
- [publicKey](AccountUpdate.md#publickey)
- [tokenId](AccountUpdate.md#tokenid)
- [tokenSymbol](AccountUpdate.md#tokensymbol)
- [update](AccountUpdate.md#update)
- [MayUseToken](AccountUpdate.md#mayusetoken)

### Methods

- [approve](AccountUpdate.md#approve)
- [hash](AccountUpdate.md#hash)
- [isDummy](AccountUpdate.md#isdummy)
- [requireSignature](AccountUpdate.md#requiresignature)
- [send](AccountUpdate.md#send)
- [sign](AccountUpdate.md#sign)
- [toJSON](AccountUpdate.md#tojson)
- [toPretty](AccountUpdate.md#topretty)
- [toPublicInput](AccountUpdate.md#topublicinput)
- [token](AccountUpdate.md#token)
- [assertBetween](AccountUpdate.md#assertbetween)
- [assertEquals](AccountUpdate.md#assertequals)
- [attachToTransaction](AccountUpdate.md#attachtotransaction)
- [clone](AccountUpdate.md#clone)
- [create](AccountUpdate.md#create)
- [createSigned](AccountUpdate.md#createsigned)
- [defaultAccountUpdate](AccountUpdate.md#defaultaccountupdate)
- [defaultFeePayer](AccountUpdate.md#defaultfeepayer)
- [dummy](AccountUpdate.md#dummy)
- [dummyFeePayer](AccountUpdate.md#dummyfeepayer)
- [fromFields](AccountUpdate.md#fromfields)
- [fromJSON](AccountUpdate.md#fromjson)
- [fundNewAccount](AccountUpdate.md#fundnewaccount)
- [getNonce](AccountUpdate.md#getnonce)
- [getSigningInfo](AccountUpdate.md#getsigninginfo)
- [getSigningInfoUnchecked](AccountUpdate.md#getsigninginfounchecked)
- [setValue](AccountUpdate.md#setvalue)
- [signFeePayerInPlace](AccountUpdate.md#signfeepayerinplace)
- [toAuxiliary](AccountUpdate.md#toauxiliary)
- [toJSON](AccountUpdate.md#tojson-1)
- [unlink](AccountUpdate.md#unlink)
- [witness](AccountUpdate.md#witness)
- [witnessChildren](AccountUpdate.md#witnesschildren)
- [witnessTree](AccountUpdate.md#witnesstree)

## Constructors

### constructor

• **new AccountUpdate**(`body`, `authorization?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `body` | `Body` |
| `authorization?` | `Object` |
| `authorization.proof?` | `string` |
| `authorization.signature?` | `string` |

#### Defined in

[lib/account_update.ts:684](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L684)

## Properties

### account

• **account**: `Account`

#### Defined in

[lib/account_update.ts:665](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L665)

___

### authorization

• **authorization**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `proof?` | `string` |
| `signature?` | `string` |

#### Implementation of

Types.AccountUpdate.authorization

#### Defined in

[lib/account_update.ts:662](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L662)

___

### body

• **body**: `Body`

#### Implementation of

Types.AccountUpdate.body

#### Defined in

[lib/account_update.ts:661](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L661)

___

### children

• **children**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `accountUpdates` | [`AccountUpdate`](AccountUpdate.md)[] |
| `callsType` | { `type`: ``"None"``  } \| { `type`: ``"Witness"``  } \| { `type`: ``"Equals"`` ; `value`: [`Field`](Field.md)  } |

#### Defined in

[lib/account_update.ts:668](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L668)

___

### currentSlot

• **currentSlot**: `CurrentSlot`

#### Defined in

[lib/account_update.ts:667](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L667)

___

### id

• **id**: `number`

#### Defined in

[lib/account_update.ts:655](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L655)

___

### isSelf

• `Private` **isSelf**: `boolean`

#### Defined in

[lib/account_update.ts:680](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L680)

___

### label

• **label**: `string` = `''`

A human-readable label for the account update, indicating how that update
was created. Can be modified by applications to add richer information.

#### Defined in

[lib/account_update.ts:660](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L660)

___

### lazyAuthorization

• **lazyAuthorization**: `undefined` \| `LazySignature` \| `LazyProof` \| `LazyNone` = `undefined`

#### Defined in

[lib/account_update.ts:663](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L663)

___

### network

• **network**: `Network`

#### Defined in

[lib/account_update.ts:666](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L666)

___

### parent

• **parent**: `undefined` \| [`AccountUpdate`](AccountUpdate.md) = `undefined`

#### Defined in

[lib/account_update.ts:678](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L678)

___

### Actions

▪ `Static` **Actions**: `Object` = `Actions`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `check` | (`x`: { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  }) => `void` |
| `emptyValue` | () => { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  } & () => { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  } |
| `fromFields` | (`x`: [`Field`](Field.md)[], `aux`: `any`[]) => { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  } |
| `fromJSON` | (`x`: `string`[][]) => { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  } |
| `toAuxiliary` | (`x?`: { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  }) => `any`[] |
| `toFields` | (`x`: { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  }) => [`Field`](Field.md)[] |
| `toInput` | (`x`: { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  }) => { `fields?`: [`Field`](Field.md)[] ; `packed?`: [[`Field`](Field.md), `number`][]  } |
| `toJSON` | (`x`: { `data`: [`Field`](Field.md)[][] ; `hash`: [`Field`](Field.md)  }) => `string`[][] |
| `empty` | () => `Events` |
| `emptyActionState` | () => [`Field`](Field.md) |
| `fromList` | (`events`: `Event`[]) => `Events` |
| `hash` | (`events`: `Event`[]) => [`Field`](Field.md) |
| `pushEvent` | (`actions`: `Events`, `event`: `Event`) => `Events` |
| `sizeInFields` | () => `number` |
| `updateSequenceState` | (`state`: [`Field`](Field.md), `sequenceEventsHash`: [`Field`](Field.md)) => [`Field`](Field.md) |

#### Defined in

[lib/account_update.ts:682](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L682)

___

### Layout

▪ `Static` **Layout**: `Object`

Describes the children of an account update, which are laid out in a tree.

The tree layout is described recursively by using a combination of `AccountUpdate.Layout.NoChildren`, `AccountUpdate.Layout.StaticChildren(...)` and `AccountUpdate.Layout.AnyChildren`.
- `NoChildren` means an account update that can't have children
- `AnyChildren` means an account update can have an arbitrary amount of children, which means you can't access those children in your circuit (because the circuit is static).
- `StaticChildren` means the account update must have a certain static amount of children and expects as arguments a description of each of those children.
  As a shortcut, you can also pass `StaticChildren` a number, which means it has that amount of children but no grandchildren.

This is best understood by examples:

```ts
let { NoChildren, AnyChildren, StaticChildren } = AccounUpdate.Layout;

NoChildren                 // an account update with no children
AnyChildren                // an account update with arbitrary children
StaticChildren(NoChildren) // an account update with 1 child, which doesn't have children itself
StaticChildren(1)          // shortcut for StaticChildren(NoChildren)
StaticChildren(2)          // shortcut for StaticChildren(NoChildren, NoChildren)
StaticChildren(0)          // equivalent to NoChildren

// an update with 2 children, of which one has arbitrary children and the other has exactly 1 descendant
StaticChildren(AnyChildren, StaticChildren(1))
```

#### Type declaration

| Name | Type |
| :------ | :------ |
| `AnyChildren` | ``"AnyChildren"`` |
| `NoChildren` | `number` |
| `NoDelegation` | ``"NoDelegation"`` |
| `StaticChildren` | (`n`: `number`) => `AccountUpdatesLayout`(...`args`: `AccountUpdatesLayout`[]) => `AccountUpdatesLayout` |

#### Defined in

[lib/account_update.ts:1393](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1393)

___

### check

▪ `Static` **check**: (`value`: [`AccountUpdate`](../modules/Types.md#accountupdate-1)) => `void` = `Types.AccountUpdate.check`

#### Type declaration

▸ (`value`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | [`AccountUpdate`](../modules/Types.md#accountupdate-1) |

##### Returns

`void`

#### Defined in

[lib/account_update.ts:1278](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1278)

___

### signingInfo

▪ `Static` `Private` **signingInfo**: `ProvableExtended`<{ `isSameAsFeePayer`: [`Bool`](Bool.md) = Bool; `nonce`: [`UInt32`](UInt32.md) = UInt32 }, { `isSameAsFeePayer`: `boolean` = Bool; `nonce`: `string` = UInt32 }\>

#### Defined in

[lib/account_update.ts:1014](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1014)

___

### sizeInFields

▪ `Static` **sizeInFields**: () => `number` = `Types.AccountUpdate.sizeInFields`

#### Type declaration

▸ (): `number`

##### Returns

`number`

#### Defined in

[lib/account_update.ts:1257](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1257)

___

### toFields

▪ `Static` **toFields**: (`value`: [`AccountUpdate`](../modules/Types.md#accountupdate-1)) => [`Field`](Field.md)[] = `Types.AccountUpdate.toFields`

#### Type declaration

▸ (`value`): [`Field`](Field.md)[]

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | [`AccountUpdate`](../modules/Types.md#accountupdate-1) |

##### Returns

[`Field`](Field.md)[]

#### Defined in

[lib/account_update.ts:1258](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1258)

___

### toInput

▪ `Static` **toInput**: (`value`: [`AccountUpdate`](../modules/Types.md#accountupdate-1)) => `HashInput` = `Types.AccountUpdate.toInput`

#### Type declaration

▸ (`value`): `HashInput`

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | [`AccountUpdate`](../modules/Types.md#accountupdate-1) |

##### Returns

`HashInput`

#### Defined in

[lib/account_update.ts:1277](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1277)

## Accessors

### balance

• `get` **balance**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `addInPlace` | (`x`: `string` \| `number` \| `bigint` \| [`UInt64`](UInt64.md) \| [`UInt32`](UInt32.md) \| [`Int64`](Int64.md)) => `void` |
| `subInPlace` | (`x`: `string` \| `number` \| `bigint` \| [`UInt64`](UInt64.md) \| [`UInt32`](UInt32.md) \| [`Int64`](Int64.md)) => `void` |

#### Defined in

[lib/account_update.ts:875](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L875)

___

### publicKey

• `get` **publicKey**(): [`PublicKey`](Types.PublicKey.md)

#### Returns

[`PublicKey`](Types.PublicKey.md)

#### Defined in

[lib/account_update.ts:958](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L958)

___

### tokenId

• `get` **tokenId**(): [`Field`](Field.md)

#### Returns

[`Field`](Field.md)

#### Defined in

[lib/account_update.ts:815](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L815)

___

### tokenSymbol

• `get` **tokenSymbol**(): `Object`

**`Deprecated`**

use `this.account.tokenSymbol`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `set` | (`tokenSymbol`: `string`) => `void` |

#### Defined in

[lib/account_update.ts:822](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L822)

___

### update

• `get` **update**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `appState` | { `isSome`: [`Bool`](Bool.md) ; `value`: [`Field`](Field.md)  }[] |
| `delegate` | { `isSome`: [`Bool`](Bool.md) ; `value`: [`PublicKey`](Types.PublicKey.md)  } |
| `delegate.isSome` | [`Bool`](Bool.md) |
| `delegate.value` | [`PublicKey`](Types.PublicKey.md) |
| `permissions` | { `isSome`: [`Bool`](Bool.md) ; `value`: { `access`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `editActionState`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `editState`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `incrementNonce`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `receive`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `send`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setDelegate`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setPermissions`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setTiming`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setTokenSymbol`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setVerificationKey`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setVotingFor`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setZkappUri`: [`AuthRequired`](../modules/Types.md#authrequired-1)  }  } |
| `permissions.isSome` | [`Bool`](Bool.md) |
| `permissions.value` | { `access`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `editActionState`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `editState`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `incrementNonce`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `receive`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `send`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setDelegate`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setPermissions`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setTiming`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setTokenSymbol`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setVerificationKey`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setVotingFor`: [`AuthRequired`](../modules/Types.md#authrequired-1) ; `setZkappUri`: [`AuthRequired`](../modules/Types.md#authrequired-1)  } |
| `permissions.value.access` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.editActionState` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.editState` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.incrementNonce` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.receive` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.send` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setDelegate` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setPermissions` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setTiming` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setTokenSymbol` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setVerificationKey` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setVotingFor` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `permissions.value.setZkappUri` | [`AuthRequired`](../modules/Types.md#authrequired-1) |
| `timing` | { `isSome`: [`Bool`](Bool.md) ; `value`: { `cliffAmount`: [`UInt64`](UInt64.md) ; `cliffTime`: [`UInt32`](UInt32.md) ; `initialMinimumBalance`: [`UInt64`](UInt64.md) ; `vestingIncrement`: [`UInt64`](UInt64.md) ; `vestingPeriod`: [`UInt32`](UInt32.md)  }  } |
| `timing.isSome` | [`Bool`](Bool.md) |
| `timing.value` | { `cliffAmount`: [`UInt64`](UInt64.md) ; `cliffTime`: [`UInt32`](UInt32.md) ; `initialMinimumBalance`: [`UInt64`](UInt64.md) ; `vestingIncrement`: [`UInt64`](UInt64.md) ; `vestingPeriod`: [`UInt32`](UInt32.md)  } |
| `timing.value.cliffAmount` | [`UInt64`](UInt64.md) |
| `timing.value.cliffTime` | [`UInt32`](UInt32.md) |
| `timing.value.initialMinimumBalance` | [`UInt64`](UInt64.md) |
| `timing.value.vestingIncrement` | [`UInt64`](UInt64.md) |
| `timing.value.vestingPeriod` | [`UInt32`](UInt32.md) |
| `tokenSymbol` | { `isSome`: [`Bool`](Bool.md) ; `value`: { `field`: [`Field`](Field.md) ; `symbol`: `string`  }  } |
| `tokenSymbol.isSome` | [`Bool`](Bool.md) |
| `tokenSymbol.value` | { `field`: [`Field`](Field.md) ; `symbol`: `string`  } |
| `tokenSymbol.value.field` | [`Field`](Field.md) |
| `tokenSymbol.value.symbol` | `string` |
| `verificationKey` | { `isSome`: [`Bool`](Bool.md) ; `value`: { `data`: `string` ; `hash`: [`Field`](Field.md)  }  } |
| `verificationKey.isSome` | [`Bool`](Bool.md) |
| `verificationKey.value` | { `data`: `string` ; `hash`: [`Field`](Field.md)  } |
| `verificationKey.value.data` | `string` |
| `verificationKey.value.hash` | [`Field`](Field.md) |
| `votingFor` | { `isSome`: [`Bool`](Bool.md) ; `value`: [`Field`](Field.md)  } |
| `votingFor.isSome` | [`Bool`](Bool.md) |
| `votingFor.value` | [`Field`](Field.md) |
| `zkappUri` | { `isSome`: [`Bool`](Bool.md) ; `value`: { `data`: `string` ; `hash`: [`Field`](Field.md)  }  } |
| `zkappUri.isSome` | [`Bool`](Bool.md) |
| `zkappUri.value` | { `data`: `string` ; `hash`: [`Field`](Field.md)  } |
| `zkappUri.value.data` | `string` |
| `zkappUri.value.hash` | [`Field`](Field.md) |

#### Defined in

[lib/account_update.ts:890](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L890)

___

### MayUseToken

• `Static` `get` **MayUseToken**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `InheritFromParent` | { `inheritFromParent`: [`Bool`](Bool.md) ; `parentsOwnToken`: [`Bool`](Bool.md)  } |
| `InheritFromParent.inheritFromParent` | [`Bool`](Bool.md) |
| `InheritFromParent.parentsOwnToken` | [`Bool`](Bool.md) |
| `No` | { `inheritFromParent`: [`Bool`](Bool.md) ; `parentsOwnToken`: [`Bool`](Bool.md)  } |
| `No.inheritFromParent` | [`Bool`](Bool.md) |
| `No.parentsOwnToken` | [`Bool`](Bool.md) |
| `ParentsOwnToken` | { `inheritFromParent`: [`Bool`](Bool.md) ; `parentsOwnToken`: [`Bool`](Bool.md)  } |
| `ParentsOwnToken.inheritFromParent` | [`Bool`](Bool.md) |
| `ParentsOwnToken.parentsOwnToken` | [`Bool`](Bool.md) |
| `type` | [`ProvablePure`](../interfaces/ProvablePure.md)<{ `inheritFromParent`: [`Bool`](Bool.md) = Bool; `parentsOwnToken`: [`Bool`](Bool.md) = Bool }\> & `ProvableExtension`<{ `inheritFromParent`: [`Bool`](Bool.md) = Bool; `parentsOwnToken`: [`Bool`](Bool.md) = Bool }, { `inheritFromParent`: `boolean` = Bool; `parentsOwnToken`: `boolean` = Bool }\> |
| `isInheritFromParent` | (`a`: [`AccountUpdate`](AccountUpdate.md)) => [`Bool`](Bool.md) |
| `isNo` | (`__namedParameters`: [`AccountUpdate`](AccountUpdate.md)) => [`Bool`](Bool.md) |
| `isParentsOwnToken` | (`a`: [`AccountUpdate`](AccountUpdate.md)) => [`Bool`](Bool.md) |

#### Defined in

[lib/account_update.ts:1407](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1407)

## Methods

### approve

▸ **approve**(`childUpdate`, `layout?`): `void`

Makes an [AccountUpdate](AccountUpdate.md) a child-[AccountUpdate](AccountUpdate.md) of this and
approves it.

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `childUpdate` | [`AccountUpdate`](AccountUpdate.md) | `undefined` |
| `layout` | `AccountUpdatesLayout` | `AccountUpdate.Layout.NoChildren` |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:867](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L867)

___

### hash

▸ **hash**(): [`Field`](Field.md)

#### Returns

[`Field`](Field.md)

#### Defined in

[lib/account_update.ts:1074](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1074)

___

### isDummy

▸ **isDummy**(): [`Bool`](Bool.md)

#### Returns

[`Bool`](Bool.md)

#### Defined in

[lib/account_update.ts:1103](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1103)

___

### requireSignature

▸ **requireSignature**(): `void`

Use this command if this account update should be signed by the account
owner, instead of not having any authorization.

If you use this and are not relying on a wallet to sign your transaction,
then you should use the following code before sending your transaction:

```ts
let tx = Mina.transaction(...); // create transaction as usual, using `requireSignature()` somewhere
tx.sign([privateKey]); // pass the private key of this account to `sign()`!
```

Note that an account's [Permissions](../README.md#permissions) determine which updates have to
be (can be) authorized by a signature.

#### Returns

`void`

#### Defined in

[lib/account_update.ts:977](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L977)

___

### send

▸ **send**(`«destructured»`): [`AccountUpdate`](AccountUpdate.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `amount` | `number` \| `bigint` \| [`UInt64`](UInt64.md) |
| › `to` | [`PublicKey`](Types.PublicKey.md) \| [`AccountUpdate`](AccountUpdate.md) \| [`SmartContract`](SmartContract.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:832](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L832)

___

### sign

▸ **sign**(`privateKey?`): `void`

**`Deprecated`**

`.sign()` is deprecated in favor of `.requireSignature()`

#### Parameters

| Name | Type |
| :------ | :------ |
| `privateKey?` | [`PrivateKey`](PrivateKey.md) |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:983](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L983)

___

### toJSON

▸ **toJSON**(): [`AccountUpdate`](../modules/Types.Json.md#accountupdate)

#### Returns

[`AccountUpdate`](../modules/Types.Json.md#accountupdate)

#### Defined in

[lib/account_update.ts:1063](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1063)

___

### toPretty

▸ **toPretty**(): `any`

Returns a JSON representation of only the fields that differ from the
default [AccountUpdate](AccountUpdate.md).

#### Returns

`any`

#### Defined in

[lib/account_update.ts:1442](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1442)

___

### toPublicInput

▸ **toPublicInput**(): [`ZkappPublicInput`](../README.md#zkapppublicinput-1)

#### Returns

[`ZkappPublicInput`](../README.md#zkapppublicinput-1)

#### Defined in

[lib/account_update.ts:1091](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1091)

___

### token

▸ **token**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `id` | [`Field`](Field.md) |
| `parentTokenId` | [`Field`](Field.md) |
| `tokenOwner` | [`PublicKey`](Types.PublicKey.md) |
| `burn` | (`__namedParameters`: { `address`: [`PublicKey`](Types.PublicKey.md) \| [`AccountUpdate`](AccountUpdate.md) \| [`SmartContract`](SmartContract.md) ; `amount`: `number` \| `bigint` \| [`UInt64`](UInt64.md)  }) => [`AccountUpdate`](AccountUpdate.md) |
| `mint` | (`__namedParameters`: { `address`: [`PublicKey`](Types.PublicKey.md) \| [`AccountUpdate`](AccountUpdate.md) \| [`SmartContract`](SmartContract.md) ; `amount`: `number` \| `bigint` \| [`UInt64`](UInt64.md)  }) => [`AccountUpdate`](AccountUpdate.md) |
| `send` | (`__namedParameters`: { `amount`: `number` \| `bigint` \| [`UInt64`](UInt64.md) ; `from`: [`PublicKey`](Types.PublicKey.md) \| [`AccountUpdate`](AccountUpdate.md) \| [`SmartContract`](SmartContract.md) ; `to`: [`PublicKey`](Types.PublicKey.md) \| [`AccountUpdate`](AccountUpdate.md) \| [`SmartContract`](SmartContract.md)  }) => [`AccountUpdate`](AccountUpdate.md) |

#### Defined in

[lib/account_update.ts:721](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L721)

___

### assertBetween

▸ `Static` **assertBetween**<`T`\>(`property`, `lower`, `upper`): `void`

Constrain a property to lie between lower and upper bounds.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `property` | `OrIgnore`<`ClosedInterval`<`T`\>\> | The property to constrain |
| `lower` | `T` | The lower bound |
| `upper` | `T` | The upper bound Example: To constrain the account balance of a SmartContract to lie between 0 and 20 MINA, you can use ```ts \@method onlyRunsWhenBalanceIsLow() { let lower = UInt64.zero; let upper = UInt64.from(20e9); AccountUpdate.assertBetween(this.self.body.preconditions.account.balance, lower, upper); // ... } ``` |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:918](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L918)

___

### assertEquals

▸ `Static` **assertEquals**<`T`\>(`property`, `value`): `void`

Fix a property to a certain value.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `property` | `OrIgnore`<`T` \| `ClosedInterval`<`T`\>\> | The property to constrain |
| `value` | `T` | The value it is fixed to Example: To fix the account nonce of a SmartContract to 0, you can use ```ts \@method onlyRunsWhenNonceIsZero() { AccountUpdate.assertEquals(this.self.body.preconditions.account.nonce, UInt32.zero); // ... } ``` |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:945](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L945)

___

### attachToTransaction

▸ `Static` **attachToTransaction**(`accountUpdate`): `void`

Attach account update to the current transaction
-- if in a smart contract, to its children

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:1147](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1147)

___

### clone

▸ `Static` **clone**(`accountUpdate`): [`AccountUpdate`](AccountUpdate.md)

Clones the [AccountUpdate](AccountUpdate.md).

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:702](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L702)

___

### create

▸ `Static` **create**(`publicKey`, `tokenId?`): [`AccountUpdate`](AccountUpdate.md)

Creates an account update. If this is inside a transaction, the account
update becomes part of the transaction. If this is inside a smart contract
method, the account update will not only become part of the transaction,
but also becomes available for the smart contract to modify, in a way that
becomes part of the proof.

#### Parameters

| Name | Type |
| :------ | :------ |
| `publicKey` | [`PublicKey`](Types.PublicKey.md) |
| `tokenId?` | [`Field`](Field.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1128](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1128)

___

### createSigned

▸ `Static` **createSigned**(`signer`, `tokenId?`): [`AccountUpdate`](AccountUpdate.md)

Creates an account update, like [create](AccountUpdate.md#create), but also
makes sure this account update will be authorized with a signature.

If you use this and are not relying on a wallet to sign your transaction,
then you should use the following code before sending your transaction:

```ts
let tx = Mina.transaction(...); // create transaction as usual, using `createSigned()` somewhere
tx.sign([privateKey]); // pass the private key of this account to `sign()`!
```

Note that an account's [Permissions](../README.md#permissions) determine which updates have to
be (can be) authorized by a signature.

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | [`PublicKey`](Types.PublicKey.md) |
| `tokenId?` | [`Field`](Field.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1194](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1194)

▸ `Static` **createSigned**(`signer`, `tokenId?`): [`AccountUpdate`](AccountUpdate.md)

**`Deprecated`**

in favor of calling this function with a `PublicKey` as `signer`

#### Parameters

| Name | Type |
| :------ | :------ |
| `signer` | [`PrivateKey`](PrivateKey.md) |
| `tokenId?` | [`Field`](Field.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1198](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1198)

___

### defaultAccountUpdate

▸ `Static` **defaultAccountUpdate**(`address`, `tokenId?`): [`AccountUpdate`](AccountUpdate.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | [`PublicKey`](Types.PublicKey.md) |
| `tokenId?` | [`Field`](Field.md) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1097](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1097)

___

### defaultFeePayer

▸ `Static` **defaultFeePayer**(`address`, `nonce`): `FeePayerUnsigned`

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | [`PublicKey`](Types.PublicKey.md) |
| `nonce` | [`UInt32`](UInt32.md) |

#### Returns

`FeePayerUnsigned`

#### Defined in

[lib/account_update.ts:1107](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1107)

___

### dummy

▸ `Static` **dummy**(): [`AccountUpdate`](AccountUpdate.md)

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1100](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1100)

___

### dummyFeePayer

▸ `Static` **dummyFeePayer**(): `FeePayerUnsigned`

#### Returns

`FeePayerUnsigned`

#### Defined in

[lib/account_update.ts:1116](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1116)

___

### fromFields

▸ `Static` **fromFields**(`fields`, `«destructured»`): [`AccountUpdate`](AccountUpdate.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | [`Field`](Field.md)[] |
| `«destructured»` | `any`[] |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1279](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1279)

___

### fromJSON

▸ `Static` **fromJSON**(`json`): [`AccountUpdate`](AccountUpdate.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `json` | [`AccountUpdate`](../modules/Types.Json.md#accountupdate) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1069](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1069)

___

### fundNewAccount

▸ `Static` **fundNewAccount**(`feePayer`, `numberOfAccounts?`): [`AccountUpdate`](AccountUpdate.md)

Use this method to pay the account creation fee for another account (or, multiple accounts using the optional second argument).

Beware that you _don't_ need to specify the account that is created!
Instead, the protocol will automatically identify that accounts need to be created,
and require that the net balance change of the transaction covers the account creation fee.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `feePayer` | [`PublicKey`](Types.PublicKey.md) | the address of the account that pays the fee |
| `numberOfAccounts?` | `number` | the number of new accounts to fund (default: 1) |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

they [AccountUpdate](AccountUpdate.md) for the account which pays the fee

#### Defined in

[lib/account_update.ts:1226](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1226)

▸ `Static` **fundNewAccount**(`feePayer`, `options?`): [`AccountUpdate`](AccountUpdate.md)

**`Deprecated`**

Call this function with a `PublicKey` as `feePayer`, and remove the `initialBalance` option.
To send an initial balance to the new account, you can use the returned account update:
```
let feePayerUpdate = AccountUpdate.fundNewAccount(feePayer);
feePayerUpdate.send({ to: receiverAddress, amount: initialBalance });
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `feePayer` | [`PrivateKey`](PrivateKey.md) \| [`PublicKey`](Types.PublicKey.md) |
| `options?` | `number` \| { `initialBalance`: `string` \| `number` \| [`UInt64`](UInt64.md)  } |

#### Returns

[`AccountUpdate`](AccountUpdate.md)

#### Defined in

[lib/account_update.ts:1238](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1238)

___

### getNonce

▸ `Static` **getNonce**(`accountUpdate`): [`UInt32`](UInt32.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) \| `FeePayerUnsigned` |

#### Returns

[`UInt32`](UInt32.md)

#### Defined in

[lib/account_update.ts:1010](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1010)

___

### getSigningInfo

▸ `Static` `Private` **getSigningInfo**(`accountUpdate`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) \| `FeePayerUnsigned` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `isSameAsFeePayer` | [`Bool`](Bool.md) |
| `nonce` | [`UInt32`](UInt32.md) |

#### Defined in

[lib/account_update.ts:1019](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1019)

___

### getSigningInfoUnchecked

▸ `Static` `Private` **getSigningInfoUnchecked**(`update`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `update` | [`AccountUpdate`](AccountUpdate.md) \| `FeePayerUnsigned` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `isSameAsFeePayer` | [`Bool`](Bool.md) |
| `nonce` | [`UInt32`](UInt32.md) |

#### Defined in

[lib/account_update.ts:1027](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1027)

___

### setValue

▸ `Static` **setValue**<`T`\>(`maybeValue`, `value`): `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `maybeValue` | `SetOrKeep`<`T`\> |
| `value` | `T` |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:894](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L894)

___

### signFeePayerInPlace

▸ `Static` **signFeePayerInPlace**(`feePayer`, `privateKey?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `feePayer` | `FeePayerUnsigned` |
| `privateKey?` | [`PrivateKey`](PrivateKey.md) |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:1001](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1001)

___

### toAuxiliary

▸ `Static` **toAuxiliary**(`a?`): (`any`[] \| { `children`: { `accountUpdates`: [`AccountUpdate`](AccountUpdate.md)[] ; `callsType`: { `type`: ``"None"``  } \| { `type`: ``"Witness"``  } \| { `type`: ``"Equals"`` ; `value`: [`Field`](Field.md)  }  } ; `id`: `number` ; `label`: `string` ; `lazyAuthorization`: `undefined` \| `LazySignature` \| `LazyProof` \| `LazyNone` ; `parent`: `undefined` \| [`AccountUpdate`](AccountUpdate.md)  })[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `a?` | [`AccountUpdate`](AccountUpdate.md) |

#### Returns

(`any`[] \| { `children`: { `accountUpdates`: [`AccountUpdate`](AccountUpdate.md)[] ; `callsType`: { `type`: ``"None"``  } \| { `type`: ``"Witness"``  } \| { `type`: ``"Equals"`` ; `value`: [`Field`](Field.md)  }  } ; `id`: `number` ; `label`: `string` ; `lazyAuthorization`: `undefined` \| `LazySignature` \| `LazyProof` \| `LazyNone` ; `parent`: `undefined` \| [`AccountUpdate`](AccountUpdate.md)  })[]

#### Defined in

[lib/account_update.ts:1259](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1259)

___

### toJSON

▸ `Static` **toJSON**(`a`): [`AccountUpdate`](../modules/Types.Json.md#accountupdate)

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | [`AccountUpdate`](AccountUpdate.md) |

#### Returns

[`AccountUpdate`](../modules/Types.Json.md#accountupdate)

#### Defined in

[lib/account_update.ts:1066](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1066)

___

### unlink

▸ `Static` **unlink**(`accountUpdate`): `void`

Disattach an account update from where it's currently located in the transaction

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:1167](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1167)

___

### witness

▸ `Static` **witness**<`T`\>(`type`, `compute`, `«destructured»?`): `Object`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | [`FlexibleProvable`](../README.md#flexibleprovable)<`T`\> |
| `compute` | () => { `accountUpdate`: [`AccountUpdate`](AccountUpdate.md) ; `result`: `T`  } |
| `«destructured»` | `Object` |
| › `skipCheck` | `undefined` \| `boolean` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |
| `result` | `T` |

#### Defined in

[lib/account_update.ts:1287](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1287)

___

### witnessChildren

▸ `Static` **witnessChildren**(`accountUpdate`, `childLayout`, `options?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |
| `childLayout` | `AccountUpdatesLayout` |
| `options?` | `Object` |
| `options.skipCheck` | `boolean` |

#### Returns

`void`

#### Defined in

[lib/account_update.ts:1303](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1303)

___

### witnessTree

▸ `Static` **witnessTree**<`T`\>(`resultType`, `childLayout`, `compute`, `options?`): `Object`

Like AccountUpdate.witness, but lets you specify a layout for the
accountUpdate's children, which also get witnessed

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resultType` | [`FlexibleProvable`](../README.md#flexibleprovable)<`T`\> |
| `childLayout` | `AccountUpdatesLayout` |
| `compute` | () => { `accountUpdate`: [`AccountUpdate`](AccountUpdate.md) ; `result`: `T`  } |
| `options?` | `Object` |
| `options.skipCheck` | `boolean` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `accountUpdate` | [`AccountUpdate`](AccountUpdate.md) |
| `result` | `T` |

#### Defined in

[lib/account_update.ts:1348](https://github.com/o1-labs/snarkyjs/blob/dcf69e2/src/lib/account_update.ts#L1348)
