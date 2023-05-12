import {
  Experimental,
  Field,
  isReady,
  MerkleMapWitness,
  Poseidon,
  PrivateKey,
  PublicKey,
  Signature,
  Struct,
  UInt32,
  UInt64,
} from 'snarkyjs';

await isReady;

const errors = {
  notInWhitelist: 'The provided private key is not whitelisted',
};

class WhitelistProgramInput extends Struct({
  whitelistRoot: Field,
  validUntilBlock: UInt64,
}) {}

/**
 * It takes a private key and returns the hash of the public key
 * @param {PrivateKey} privateKey - The private key of the account that you want to whitelist.
 */
const toWhitelistEntry = (privateKey: PrivateKey) =>
  Poseidon.hash(privateKey.toPublicKey().toFields());

/**
 * This is a very naive implementation of a 'whitelist proof'. It only
 * verifies that you have access to a private key, and that private key's public key
 * is part of a whitelist.
 *
 * As an additional layer of 'replay' protection we attach an expiry date
 * as `validUntilBlock`. The verifier is responsible for comparing the current
 * block height with the whitelist proof's `validUntilBlock`
 */
const WhitelistProgram = Experimental.ZkProgram({
  publicInput: WhitelistProgramInput,

  methods: {
    isWhitelisted: {
      privateInputs: [PrivateKey, MerkleMapWitness],
      /**
       * "If the private key is in the whitelist, then the public input is the root of the whitelist."
       *
       * The first line of the function is the function signature. It specifies the function name, the
       * types of the arguments, and the return type
       * @param {Field} publicInput - Field
       * @param {PrivateKey} privateKey - The private key of the account that is being whitelisted.
       * @param {MerkleMapWitness} whitelistWitness - MerkleMapWitness
       */
      method(
        { whitelistRoot }: WhitelistProgramInput,
        privateKey: PrivateKey,
        whitelistWitness: MerkleMapWitness
      ) {
        const whitelistEntry = toWhitelistEntry(privateKey);
        const [computedRoot] =
          whitelistWitness.computeRootAndKey(whitelistEntry);

        whitelistRoot.assertEquals(computedRoot, errors.notInWhitelist);
      },
    },
  },
});

const WhitelistProgramProof_ = Experimental.ZkProgram.Proof(WhitelistProgram);
class WhitelistProgramProof extends WhitelistProgramProof_ {}

export {
  WhitelistProgramProof,
  WhitelistProgram,
  WhitelistProgramInput,
  toWhitelistEntry,
};
