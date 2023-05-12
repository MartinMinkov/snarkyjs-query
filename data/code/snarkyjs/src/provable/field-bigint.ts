import { randomBytes } from '../bindings/crypto/random.js';
import { Fp, mod } from '../bindings/crypto/finite_field.js';
import {
  BinableBigint,
  HashInput,
  ProvableBigint,
} from '../bindings/lib/provable-bigint.js';

export { Field, Bool, UInt32, UInt64, Sign };
export { pseudoClass, sizeInBits, checkRange, checkField };

type Field = bigint;
type Bool = 0n | 1n;
type UInt32 = bigint;
type UInt64 = bigint;

const sizeInBits = Fp.sizeInBits;

type minusOne =
  0x40000000000000000000000000000000224698fc094cf91b992d30ed00000000n;
const minusOne: minusOne =
  0x40000000000000000000000000000000224698fc094cf91b992d30ed00000000n;
type Sign = 1n | minusOne;

const checkField = checkRange(0n, Fp.modulus, 'Field');
const checkBool = checkAllowList(new Set([0n, 1n]), 'Bool');
const checkSign = checkAllowList(new Set([1n, minusOne]), 'Sign');

/**
 * The base field of the Pallas curve
 */
const Field = pseudoClass(
  function Field(value: bigint | number | string): Field {
    return mod(BigInt(value), Fp.modulus);
  },
  {
    ...ProvableBigint(checkField),
    ...BinableBigint(Fp.sizeInBits, checkField),
    ...Fp,
  }
);

/**
 * A field element which is either 0 or 1
 */
const Bool = pseudoClass(
  function Bool(value: boolean): Bool {
    return BigInt(value) as Bool;
  },
  {
    ...ProvableBigint<Bool>(checkBool),
    ...BinableBigint<Bool>(1, checkBool),
    toInput(x: Bool): HashInput {
      return { fields: [], packed: [[x, 1]] };
    },
    toBoolean(x: Bool) {
      return !!x;
    },
    toJSON(x: Bool) {
      return !!x;
    },
    fromJSON(b: boolean) {
      let x = BigInt(b) as Bool;
      checkBool(x);
      return x;
    },
    sizeInBytes() {
      return 1;
    },
    fromField(x: Field) {
      checkBool(x);
      return x as 0n | 1n;
    },
  }
);

function Unsigned(bits: number) {
  let maxValue = (1n << BigInt(bits)) - 1n;
  let checkUnsigned = checkRange(0n, 1n << BigInt(bits), `UInt${bits}`);
  let binable = BinableBigint(bits, checkUnsigned);
  let bytes = Math.ceil(bits / 8);

  return pseudoClass(
    function Unsigned(value: bigint | number | string) {
      let x = BigInt(value);
      checkUnsigned(x);
      return x;
    },
    {
      ...ProvableBigint(checkUnsigned),
      ...binable,
      toInput(x: bigint): HashInput {
        return { fields: [], packed: [[x, bits]] };
      },
      maxValue,
      random() {
        return binable.fromBytes([...randomBytes(bytes)]);
      },
    }
  );
}
const UInt32 = Unsigned(32);
const UInt64 = Unsigned(64);

const Sign = pseudoClass(
  function Sign(value: 1 | -1): Sign {
    if (value !== 1 && value !== -1)
      throw Error('Sign: input must be 1 or -1.');
    return mod(BigInt(value), Fp.modulus) as Sign;
  },
  {
    ...ProvableBigint<Sign, 'Positive' | 'Negative'>(checkSign),
    ...BinableBigint<Sign>(1, checkSign),
    emptyValue() {
      return 1n;
    },
    toInput(x: Sign): HashInput {
      return { fields: [], packed: [[x === 1n ? 1n : 0n, 1]] };
    },
    fromFields([x]: Field[]): Sign {
      if (x === 0n) return 1n;
      checkSign(x);
      return x as Sign;
    },
    toJSON(x: Sign) {
      return x === 1n ? 'Positive' : 'Negative';
    },
    fromJSON(x: 'Positive' | 'Negative'): Sign {
      if (x !== 'Positive' && x !== 'Negative')
        throw Error('Sign: invalid input');
      return x === 'Positive' ? 1n : minusOne;
    },
  }
);

// helper

function pseudoClass<
  F extends (...args: any) => any,
  M
  // M extends Provable<ReturnType<F>>
>(constructor: F, module: M) {
  return Object.assign<F, M>(constructor, module);
}

// validity checks

function checkRange(lower: bigint, upper: bigint, name: string) {
  return (x: bigint) => {
    if (x < lower)
      throw Error(
        `${name}: inputs smaller than ${lower} are not allowed, got ${x}`
      );
    if (x >= upper)
      throw Error(
        `${name}: inputs larger than ${upper - 1n} are not allowed, got ${x}`
      );
  };
}

function checkAllowList(valid: Set<bigint>, name: string) {
  return (x: bigint) => {
    if (!valid.has(x)) {
      throw Error(
        `${name}: input must be one of ${[...valid].join(', ')}, got ${x}`
      );
    }
  };
}
