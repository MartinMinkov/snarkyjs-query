import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  SelfProof,
  Experimental,
  Struct,
  Bool,
  Circuit,
  Poseidon,
  MerkleMap,
  MerkleTree,
  MerkleWitness,
  MerkleMapWitness,
  verify
} from 'snarkyjs';

export class VoteState extends Struct({
  voteFor: Field,
  voteAgainst: Field,
  tokenMemberTreeRoot: Field,
  nullifierMapRoot: Field,
}) {

  static newVote(tokenMemberTreeRoot: Field) {
    const emptyMap = new MerkleMap();

    return new VoteState({
      voteFor: Field(0),
      voteAgainst: Field(0),
      tokenMemberTreeRoot,
      nullifierMapRoot: emptyMap.getRoot()
    });
  }

  static applyVote(
    state: VoteState,
    voteFor: Bool,
    privateKey: PrivateKey,
    voterWitness: MerkleMapWitness,
    nullifierWitness: MerkleMapWitness,
  ) {
    const publicKey = privateKey.toPublicKey()

    const [voterRoot, tmpPubKey] = voterWitness.computeRootAndKey(Field(1));
    voterRoot.assertEquals(state.tokenMemberTreeRoot)
    Poseidon.hash(publicKey.toFields()).assertEquals(tmpPubKey);

    let nullifier = Poseidon.hash(privateKey.toFields());

    const [nullifierRootBefore, key] = nullifierWitness.computeRootAndKey(Field(0));
    key.assertEquals(nullifier);
    nullifierRootBefore.assertEquals(state.nullifierMapRoot);

    const [nullifierRootAfter, _] = nullifierWitness.computeRootAndKey(Field(1));

    return new VoteState({
      voteFor: state.voteFor.add(Circuit.if(voteFor, Field(1), Field(0))),
      voteAgainst: state.voteAgainst.add(Circuit.if(voteFor, Field(0), Field(1))),
      tokenMemberTreeRoot: state.tokenMemberTreeRoot,
      nullifierMapRoot: nullifierRootAfter,
    });
  }

  static assertInitialState(state: VoteState) {
    state.voteFor.assertEquals(Field(0))
    state.voteAgainst.assertEquals(Field(0))

    const emptyMap = new MerkleMap();
    state.nullifierMapRoot.assertEquals(emptyMap.getRoot());
  }

  static assertEquals(state1: VoteState, state2: VoteState) {
    state1.voteFor.assertEquals(state2.voteFor);
    state1.voteAgainst.assertEquals(state2.voteAgainst);
    state1.voteAgainst.assertEquals(state2.voteAgainst);
    state1.tokenMemberTreeRoot.assertEquals(state2.tokenMemberTreeRoot);
    state1.nullifierMapRoot.assertEquals(state2.nullifierMapRoot);

  }
}

export const VoteZkProgram = Experimental.ZkProgram({
  publicInput: VoteState,

  methods: {
    create: {
      privateInputs: [],

      method(state: VoteState) {
        VoteState.assertInitialState(state);
      },
    },

    applyVote: {
      privateInputs: [SelfProof, Bool, PrivateKey, MerkleMapWitness, MerkleMapWitness],

      method(newState: VoteState,
        earlierProof: SelfProof<VoteState>,
        voteFor: Bool,
        voter: PrivateKey,
        tokenMembersWitness: MerkleMapWitness,
        nullifierWitness: MerkleMapWitness
      ) {
        earlierProof.verify();
        const computedState = VoteState.applyVote(earlierProof.publicInput,
          voteFor,
          voter,
          tokenMembersWitness,
          nullifierWitness);
        VoteState.assertEquals(computedState, newState);
      },
    },
  },
});

let VoteProof_ = Experimental.ZkProgram.Proof(VoteZkProgram);
export class VoteProof extends VoteProof_ {}