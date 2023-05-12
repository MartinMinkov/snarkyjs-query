Question:
This may be a silly question, I guess it's not quite clear to me what the circuit is. Where does the proof system get involved and how does snarkjs talk to the proof system?

Answer:
well, it's not quite R1CS but yeah, as @Las said, think of the circuit as some internal structure that represents the computation you are doing, in a way that can be turned to a list of PLONK gates at the end.

at a high level, here's what happens with a SmartContract @method or other provable function, when you do prove():

- SnarkyJS sets up a new, empty structure that we call "circuit". It then runs the @method that you wrote, like you run any JS function.
- During running your function, every time you call certain library methods, like Circuit.if() or Field.mul() , they add something to that internal circuit
- After running your function, SnarkyJS has this circuit structure which somehow represents the library functions you called together with the variables involved.
  Somewhere inside the OCaml part of snarky, it will turn that "internal circuit representation" into an instance of PLONK -- a list of gates and (if this is the prover running) witness columns. It then uses the proof system to create a zk proof for that PLONK instance.

If you're curious, this file is where the translation between "snarky-internal circuit representation" and "plonk instance" happens: https://github.com/MinaProtocol/mina/blob/develop/src/lib/crypto/kimchi_backend/common/plonk_constraint_system.ml

Question:
What is the difference between the events obtained by await zkApp.fetchEvenets() and await Local.fetchEvents(zkAppPubKey)?

Answer:
Local.fetchEvents or more generally Mina.fetchEvents gives you the raw list of field elements that events end up as when sent to the network
zkApp.fetchEvents serializes the events back into the rich provable types that you declared on your smart contract, like, Bool or UInt32 or PublicKey or sompositions of those using Struct. It also gives you the event type (the string key you declared on your smart contract)

Question:
What is the "best" way to make provable types over arrays?

Answer:
Provable types need to be statically sized, and we have Circuit.array as a helper to make a static size arrayr type, eg. Circuit.array(Field, 10); which doesn't really help you but might explain why the initial things you tried didn't work.

Question:
How to fix Fee_payer_not_permitted_to_send

Fee_payer_not_permitted_to_send error happens if the Send permission in fee payer account account is set to Proof and the fee payment is authorized using signatures (all fee payments currently are authorized using signatures)

Qusetion:
why cant you use a zkapp as a fee payer?

- when transactions are accepted into the mempool, the fee is deducted from the fee payer account. Regardless of whether the transaction eventually makes it into a block. this is important to defend against DDoS -- there has to be a cost to spamming the network with transactions, and you can't bypass that cost by making the tx invalid
- to make this clear: when an invalid txs get into the mempool, the fee will be lost for the fee paying account, but the rest of the tx will not be applied
- the mempool can't check preconditions validity on incoming tx. that's because the value of these preconditions only gets decided when the tx is put into a block. so, you can make txs invalid and their invalidity can't be detected at the point when txs are accepted & the fee is deducted

- now assume you have a zkApp that allows to pay fees with proofs. given the two points above, there is no way you can prevent the following attack: - someone sends a large number of txs with your zkApp as fee payer. the txs have valid proofs but are invalid because of failing preconditions - each of those txs will drain the fee from your zkApp account, but since the rest of the tx is not applied, there is no way for you to "get something back" in return for the fee within the body of the tx (which would have been a common pattern of fee paying zkApps) - so, someone who doesn't like you will definitely be able to burn all the funds in your zkApp account, 0.1 MINA by 0.1 MINA
  I was challenged to provide use cases for fee paying zkApps that would justify implementing a half-baked version, with those vulnerabilities. In the end we all agreed that the most important use cases can't be implemented with this limitation and we decided that it doesn't make the hard fork

Question:
What’s the proof system’s prover speed, proof size & verifier speed in terms of big O notation? How does compare against alternatives like Groth16?

Answer:
it's a bit of a different model than groth16, because it uses bulletproofs with O(n) full verifier, but an accumulation scheme to combine multiple partially verified proofs into a new partially verified proof, where the partial verification + accumulation is O(log(n))
So, in practice you can say

- prover: O(n), like all proof systems
- verification O(log(n))
- proof size O(log(n))

It's superior to groth16 in that it supports fancier operations in a circuit, like lookups, without blowing up in constraint size, so in practice, our "n" will be much smaller than in groth16

The main advantage over groth16 is that you can write arbitrary circuits, without having a trusted setup to deploy each of them

Question:
Can snapps or zkapps as the new name. Be used to enable a third party (ie email) as a “log in” instead of a private key for “log in”. Giving the wallet perhaps a token as a verifier to sign contracts?

Answer:
es, this is possible - zkApps enable you to authorize a transaction with something else than a signature, freeing you from the constraint that you have to own some specific private key to interact with the network.
There's the issue of who pays the fees, because right now zkApps can't pay fees (so we need a fee payer with a signature). I think for now we will have a workaround where you can send your transaction to a relayer, which signs and pays the fees if the tx pays them back. There's no trust assumptions that you have to make in this model, because the relayer can't alter the transaction. They could only censor it (not send it), but being a relayer is permissionless, anyone can do it, so it's censorship-resistant as well

Question:
Is there a way to 'reconstruct' a contract from a verification key for the purposes of proving a 'transaction' against the contract/verification key itself?

Answer:
You can't generate a proof against the verification key at all. For creating a proof, you'll always need two things:

- the prover key, which in the future we'll be able to store / export but right now is buried in Pickles and has to be recreated by compiling every time
- the JS code for the SmartContract
  the JS code is needed because fundamentally, a prover needs a function that tells him how to create the witness. And this isn#t compiled to anything, it's just directly the JS you write

Question:
What is the typical size of a proof and is it fixed in size or variable ?

Answer:
I think you can model it basically as fixed size, because the proof for the user circuit is log(N), that gets wrapped in another proof before sent to the network, and also the protocol limits the circuit size to 2^16 currently. So, I'd expect that the size you're seeing should be typical. You should probably account for base64 encoding overhead, so if you're seeing 22kB of the base64 encoded thing then the actual size is 22 \* 3/4 = 16.5 kB

Question:
I see proof creation using mina.transaction semantics and as you clarified before, the transaction need not be submitted to the chain. What about verify function. I see examples where it is just called locally as well as when it is sent to the chain.. What is the significance or usecase of when to call locally vs submitting to the chain ?
Answer:
Submitting to the chain means you update an account on the ledger that others can interact with! And of course on chain the proofs are verified

- Verifying locally on the same machine that creates the proof will not be very useful, maybe for testing
- Verifying locally on a different machine than the one which created the proof, may allow you to build your own off chain system which leverages zk in some way. But if this sounds confusing or not something you want to do, just use the Mina chain

Question:

- If the app only requires method reads for assertions, does it still still update the account and therefore it is required to submit them for tracking the proof counts on chain ? And verify function to be called on chain requires a mina trransaction with transaction fees vs when done locally ?

Answer:
No, if there's only reads, it wouldn't update the account. But the reads need to be verified as well, and this would also happen on chain (whoever verifies them needs to check that the values match the on-chain ones)

Question:
How to check if account is new in SnarkyJS?
Answer:
To check that the account is new, there is this.account.isNew
fundNewAccount() isn't proving that the account is new, as far as I can tell, because you can offset the balance reduction it does in the same transaction, but outside the proof
here's how to assert it's true:
accountUpdate.account.isNew.assertEquals(Bool(true))
it is only true if the account didn't exist in the ledger before applying this account update

Question:
The tutorial says that the assertions must pass "in order to generate the zero knowledge proof". But you (and the docs you refer to) say that the precondition is checked by the verifier.

Does that mean that both assertions in the example are run in the user's browser, while generating the proof, and that the same two assertions are also run by the verifier on-chain? Or is the on-chain check implicit, in the fact that Mina confirms " the integrity of both the proof and the associated events"? Or it the answer something else entirely?
Answer:
The answer is, those two assertEquals are doing two different things. The one on this.num adds a precondition, that is actually, directly checked by the verifier. The square.assertEquals, on the other hand, is doing what the tutorial says: it adds a constraint to the proof, so it is only directly checked in the users browser. On chain it's only checked implicitly, as you say, by verifying the proof. The actual inputs in that proof, like square, are not visible to the verifier, so couldn't be checked directly by them

Question:
if a smart contract function contains 2 child transactions, does it still cost the same as if it contains 1 transaction?
In other words: can someone send Mina or a custom token to 2 people within the same transaction?
Answer:
I don't think so - Mina doesn't have a gas model, tx fees are almost completely left to the market. But there'll be a minimum fee AFAIK that depends on the number of account updates (~what you call "child transactions")
That said -- more account updates cause more snark work. So it would be actually good if you could be charged depending on that. But I don't think that's possible in the current model because a block producer adds snark work for earlier txs, not for the txs in the new block. So there's no incentive to charge the submitter of the current txs for their tx size

Question:
will the fromAccountUpdate fail, if the from account is a non-zkApp account , therefore has permisssions.send = signature, and a signature for that account update is missing (.requireSignature() is omitted?)
Reasoning behind this is that the 'fromAccountUpdate' can be issued with a signature, or a proof in case the user is a zkApp, assuming permissions.send = proof.
I am unsure if the Token owner approval of a ill-authorized fromAccountUpdate will override the signature permission or not, i hope not

Answer:
No, token owner approval doesn't override any permissions.
The token owner is always needed in addition to any authorization required by an account's permissions

Question:
Is it possible to use MerkleMap as a state variable?
Answer:
No, a merkle map is too big to use as a state variable.

Question:
@gregor what are the exact limits for ZkProgram? How big can the public input be? How big can the private input be? How many proofs can we recursively verify? How many 'gates' or rows can we occupy?

Answer:
It's all the same as for smart contract. Proof size is 2^16 rows. You can recursively verify 0, 1 or 2 proofs. Public and private inputs are not limited except for some stack overflow bugs that we could fix. Public inputs each take up one gate / half a row (I think), so they're ultimately also limited by proof size

Question:
Is there any way to implement access control in Mina? What I would like to do is create an encrypted secret in IPFS and give access only to the members that the user has assigned in their contacts. Would that be possible? Is there any way to share the key privately

Answer:
You can use asymmetric encryption - you don't have to share the key then, just encrypt it to the public keys of people who should be able to decrypt it
well, I guess for this you'd also need to handle decryption keys / have your own PKI, probably can't use the public keys that equal the user's addresses

Question:
n the ZkProgram tutorial, there is one public input called publicInput of type Field. If I change that line to say myPublicState: Field I get a type error with the message:

Argument of type '{ myPublicState: typeof Field; methods: { baseCase: { privateInputs: []; method(myPublicState: Field): void; }; inductiveCase: { privateInputs: [typeof SelfProof]; method(myPublicState: Field, earlierProof: SelfProof<...>): void; }; }; }' is not assignable to parameter of type '{ publicInput: FlexibleProvablePure<any>; methods: { [x: string]: Method<any, Tuple<PrivateInput>>; }; }'.

So if I wanted to track multiple items of state, could I create a new struct class with properties like myPublicState? I'm not that familiar with the concept of FlexibleProvablePure<any>

Answer:
yeah, provable makes a type usable in a circuit. in a circuit, everything ends up being field elements
the Flexible\* was added to work around some issues when using Struct with instance methods. It is a slightly more flexible interface than Provable which allows for those Structs.
Pure means that the type only consists of field elements, and nothing else. If it's not pure, it can also hold auxiliary data, which don't play any role within the circuit but can be useful in other respects.

Question:
If I want to connect the wallet and just read from the contract state, do I still need to compile the contract?

Answer:
No, reading the state can be done without any compilation, also through simply using a block explorer and/or fetching the account by its address. However, the on-chain state will just be 8 elements serialized, some contracts might consist of relatively complex data structures for which it would be nice to have the original source code to get a better understanding of the on-chain values.
