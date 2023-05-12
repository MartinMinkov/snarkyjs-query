import {
  SelfProof,
  Field,
  Experimental,
  verify,
  isReady,
  Proof,
  JsonProof,
  Provable,
  Empty,
} from 'snarkyjs';

await isReady;

let MyProgram = Experimental.ZkProgram({
  publicOutput: Field,

  methods: {
    baseCase: {
      privateInputs: [],
      method() {
        return Field(0);
      },
    },

    inductiveCase: {
      privateInputs: [SelfProof],
      method(earlierProof: SelfProof<Empty, Field>) {
        earlierProof.verify();
        return earlierProof.publicOutput.add(1);
      },
    },
  },
});
// type sanity checks
MyProgram.publicInputType satisfies Provable<Empty>;
MyProgram.publicOutputType satisfies typeof Field;

let MyProof = Experimental.ZkProgram.Proof(MyProgram);

console.log('program digest', MyProgram.digest());

console.log('compiling MyProgram...');
let { verificationKey } = await MyProgram.compile();
console.log('verification key', verificationKey.slice(0, 10) + '..');

console.log('proving base case...');
let proof = await MyProgram.baseCase();
proof = testJsonRoundtrip(MyProof, proof);

// type sanity check
proof satisfies Proof<undefined, Field>;

console.log('verify...');
let ok = await verify(proof.toJSON(), verificationKey);
console.log('ok?', ok);

console.log('verify alternative...');
ok = await MyProgram.verify(proof);
console.log('ok (alternative)?', ok);

console.log('proving step 1...');
proof = await MyProgram.inductiveCase(proof);
proof = testJsonRoundtrip(MyProof, proof);

console.log('verify...');
ok = await verify(proof, verificationKey);
console.log('ok?', ok);

console.log('verify alternative...');
ok = await MyProgram.verify(proof);
console.log('ok (alternative)?', ok);

console.log('proving step 2...');
proof = await MyProgram.inductiveCase(proof);
proof = testJsonRoundtrip(MyProof, proof);

console.log('verify...');
ok = await verify(proof.toJSON(), verificationKey);

console.log('ok?', ok && proof.publicOutput.toString() === '2');

function testJsonRoundtrip<
  P extends Proof<any, any>,
  MyProof extends { fromJSON(jsonProof: JsonProof): P }
>(MyProof: MyProof, proof: P) {
  let jsonProof = proof.toJSON();
  console.log(
    'json proof',
    JSON.stringify({
      ...jsonProof,
      proof: jsonProof.proof.slice(0, 10) + '..',
    })
  );
  return MyProof.fromJSON(jsonProof);
}
