It's important to get your mental model right about this. The JS you write as your circuit isn't compiled/transpiled. It's normal JS that is executed and creates the circuit by calling library functions like Circuit.if.
Since Circuit.if is a normal JS function, it can't be short-circuiting like a native if statement. All arguments are evaluated before calling the function (that's how function calls work)

SmartContract is for zkApps. It allows you specifically to create proofs which construct account updates to Mina accounts -- exactly the kind of proofs Mina accepts. In technical terms, SmartContract proofs have a very particular public input which is connected to the Mina transaction they are producing. This public input will be passed in by the verifier on Mina, thereby asserting that really the zkApp logic was run to construct the transaction (i.e., you constrain the kinds of transactions your zkApp accepts by writing certain methods).

ZkProgram is more low-level and general. It's like SmartContract, but with any public input, and with all the Mina-related stuff stripped away.

We imagined that ZkProgram would be used to produce second-tier proofs, which would be verified inside SmartContracts. For example, this could be used to build app-specific rollups
But you can also use ZkProgram whenever you don't want to interact with Mina at all

he "pasta" curves (pallas & vesta) are two different elliptic curves. an elliptic curve has a base field and a scalar field.
Field represents the base field of the vesta curve, Scalar its scalar field
Vice versa, for pallas, Scalar is the base field and Field the scalar field
Scalar can be slightly larger than Field, so we have to be careful when converting it to a single field (for the important case of random Scalars though, it works, because a Scalar is overwhelmingly likely to fit in a Field). Th other way, Field to Scalar, always works

The canonical Field representation of Scalar is 255 Fields, each of which is boolean. That's what Scalar.ofFields() expects. But Field.toFields returns a single Field. so they're not interoperable in the way you tried to do it; they have different meanings

Nice! Yeah this is not documented well yet, it works like this: every @ method call becomes its own account update with its own proof (if you don't want a separate account update for some logic, just remove method decorator)
Same if you call methods from a different method - you can call your own contract's methods, but also other contracts, but they all become their own separate proof / account update

a nonce only increases for certain transactions, not all of them.
incrementNonce is actually a boolean property of any account update, that you can set yourself:
this.self.body.incrementNonce = Bool(true);

there is a rule in the protocol, concerned with replay protection, which specifies when an account update has to do that. To conform with this rule, the commands this.sign() and AccountUpdate.createSigned() set incrementNonce=true. Otherwise it's false, and the nonce is not incremented. These commands, at the same time, set a precondition on the current nonce, and since that nonce is incremented, it means you can't ever send that same tx again (or the precondition would fail). So this protects you again replays.

The rough idea is: You usually only need replay protection when you do signature authorization, because only then is the signature specific to your private key. For smart contracts, authorized with a proof, the whole idea is that everyone can run them, so we don't care about reply protection.

However, there might be cases where you actually want replay protection for running smart contracts!! For example, a smart contract method which takes in your private key, and checks it against a certain public key to authorize you. In those cases, its on the zkApp developer to build in the replay protection, for example by incrementing the nonce.

Final note: we have a separate replay protection mechanism, which is also a boolean flag on the account update, called useFullCommitment. This means that a hash of the entire transaction becomes part of the public input (for proof auth) / the message that is signed (for signature auth). This protects you against replays as well, because the fee payer of a tx always increases its nonce.

Circuit size in snarkyjs

I'll try to give you some ideas about cost of different operations. The unit I'm using here is 1 row in the PLONK constraint system. We have 2^15 (30k) of them available, AFAIR. Some of the operations only take half a row (0.5), because we can fit two generic gates in one row.

The following list is to the best of my knowledge, but I don't know all the details. I found confirmed/found many of the numbers by trying out different circuits in the contraint system example above. x and y are variables.

- x.assertEquals(constant): 0.5 if the constant is used the first time, 0 after that (because equality is represented with a wire)
- x.assertEquals(y): similar to the last one
- x.equals(x): 1.5
- x.add(y): 0.5
- x.mul(y): 0.5
- Circuit.if(bool, x, y): 1
- Poseidon.hash([x]): 12
- Poseidon.hash([x, y]): 12
- Poseidon.hash(...fields): 12 \* Math.ceil(fields.length / 2)
- x.assertGreaterThan(y): 509 (damn, general comparisons are expensive)
- u.assertGreaterThan(t), where u and t are UInt64: 28
- u.assertGreaterThan(t), where u and t are UInt32: 20
- privateKey.toPublicKey(): 359

Under the hood, a smart contract / Pickles "proof" is actually two proofs:

1. a "step" proof which invokes the prover of one of the method circuits
   - scales with the size of the method that's currently proven, because it's different ofr every method
2. a "wrap" proof which takes as input any of the different method proofs, verifies it recursively, and outputs a proof that's always for the same circuit (the wrap circuit)

- this has basically constant cost, or, conceptually, logarithmic in the size of the method circuits

The verification key that's deployed on chain is just the verification key of the wrap circuit.

It's important to understand that there are two, fundamentally different kinds of values in a circuit: constants and variables.

Constants are created when you create Field etc directly from JS values, like numbers or strings:
let x = Field(0); // x is a constant
let b = Bool(false); // b is a constant

Variables are created either

- by using Circuit.witness()
- by passing values to a @method (which uses Circuit.witness under the hood)
  @method myMethod(x: Field) {
  // x is a variable
  let b = Circuit.witness(Bool, () => Bool(true)); // b is a variable
  }

A circuit is formed by creating constraints on variables. That's what a circuit fundamentally is: A list of constraints on variables.
If something never affects any constraint on any variable, then it won't become part of the circuit. (It can't, since by definition the circuit is a list of constraints on variables.)

The code in your example does assertEquals between two constants:
const field = Field(0); // field is a constant
field.assertEquals(Field(0)); // assertEqals with another constant

So, this doesn't create a constraint on any variable. Therefore, it doesn't affect the circuit. Therefore, changing parts of it doesn't affect the verification key,

This would be similar code where you create a constraint between a variable and a constant. Here, changing the constant does affect the VK:
@method assert(field: Field) {
field.assertEquals(Field(0));
}

One field can't hold 255 arbitrary bits. The max field element is slightly larger than 2^254. So, the following statements are true:

- 1 field can hold 254 arbitrary bits
- 1 arbitrary field might take up 255 bits
  zkApp limits

* no limit on number of methods
* no limit on number of private inputs (but there's currently a bug that prevents more than a couple of 1000 afair)
* max account updates in a transaction: about 7-12 depending on the type of authorization on the account update.
* max field elements contained in all events/actions: 16 (counted separately for events/actions)
* max circuit size: 2^15 (I'll post more about what this means soon)

The CircuitString allows you to make statements about individual characters, because each character is represented as a full field element. This comes at the cost of much worse encoding efficiency compared to the Encoding functions
