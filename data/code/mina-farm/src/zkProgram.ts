import {
  Experimental,
  Field,
  PublicKey,
  Signature,
  Struct,
  UInt32,
} from 'snarkyjs';

class ProgramInput extends Struct({
  signature: Signature,
  publicKey: PublicKey,
  permissionUntilBlockHeight: UInt32,
}) {}

const Program = Experimental.ZkProgram({
  publicInput: ProgramInput,

  methods: {
    run: {
      privateInputs: [],
      method(publicInput: ProgramInput) {
        publicInput.signature
          .verify(publicInput.publicKey, Field(0).toFields())
          .assertTrue();
      },
    },
  },
});

const ProgramProof_ = Experimental.ZkProgram.Proof(Program);
class ProgramProof extends ProgramProof_ {}

export { ProgramProof, Program, ProgramInput };
