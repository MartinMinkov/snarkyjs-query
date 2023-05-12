import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Bool,
  PublicKey,
  Circuit,
  Reducer,
  provablePure,
  AccountUpdate,
} from 'snarkyjs';
import { Member } from './member.js';
import { ParticipantPreconditions } from './preconditions.js';

let participantPreconditions = ParticipantPreconditions.default;

interface MembershipParams {
  participantPreconditions: ParticipantPreconditions;
  contractAddress: PublicKey;
  doProofs: boolean;
}

/**
 * Returns a new contract instance that based on a set of preconditions.
 * @param params {@link MembershipParams}
 */
export async function Membership(
  params: MembershipParams
): Promise<Membership_> {
  participantPreconditions = params.participantPreconditions;

  let contract = new Membership_(params.contractAddress);

  params.doProofs = true;
  if (params.doProofs) {
    await Membership_.compile();
  }

  return contract;
}

/**
 * The Membership contract keeps track of a set of members.
 * The contract can either be of type Voter or Candidate.
 */
export class Membership_ extends SmartContract {
  /**
   * Root of the merkle tree that stores all committed members.
   */
  @state(Field) committedMembers = State<Field>();

  /**
   * Accumulator of all emitted members.
   */
  @state(Field) accumulatedMembers = State<Field>();

  reducer = Reducer({ actionType: Member });

  events = {
    newMemberState: provablePure({
      committedMembersRoot: Field,
      accumulatedMembersRoot: Field,
    }),
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      editActionState: Permissions.proofOrSignature(),
      setPermissions: Permissions.proofOrSignature(),
      setVerificationKey: Permissions.proofOrSignature(),
      incrementNonce: Permissions.proofOrSignature(),
    });
  }

  /**
   * Method used to add a new member.
   * Dispatches a new member sequence event.
   * @param member
   */
  @method addEntry(member: Member): Bool {
    // Emit event that indicates adding this item
    // Preconditions: Restrict who can vote or who can be a candidate

    // since we need to keep this contract "generic", we always assert within a range
    // even tho voters cant have a maximum balance, only candidates
    // but for a voter we simply use UInt64.MAXINT() as the maximum

    let accountUpdate = AccountUpdate.create(member.publicKey);

    accountUpdate.account.balance.assertEquals(
      accountUpdate.account.balance.get()
    );

    let balance = accountUpdate.account.balance.get();

    balance.assertGreaterThanOrEqual(
      participantPreconditions.minMina,
      'Balance not high enough!'
    );
    balance.assertLessThanOrEqual(
      participantPreconditions.maxMina,
      'Balance too high!'
    );

    let accumulatedMembers = this.accumulatedMembers.get();
    this.accumulatedMembers.assertEquals(accumulatedMembers);

    // checking if the member already exists within the accumulator
    let { state: exists } = this.reducer.reduce(
      this.reducer.getActions({
        fromActionState: accumulatedMembers,
      }),
      Bool,
      (state: Bool, action: Member) => {
        return action.equals(member).or(state);
      },
      // initial state
      { state: Bool(false), actionState: accumulatedMembers }
    );

    /*
    we cant really branch the control flow - we will always have to emit an event no matter what, 
    so we emit an empty event if the member already exists
    it the member doesn't exist, emit the "real" member
    */

    let toEmit = Circuit.if(exists, Member.empty(), member);

    this.reducer.dispatch(toEmit);

    return exists;
  }

  /**
   * Method used to check whether a member exists within the committed storage.
   * @param accountId
   * @returns true if member exists
   */
  @method isMember(member: Member): Bool {
    // Verify membership (voter or candidate) with the accountId via merkle tree committed to by the sequence events and returns a boolean
    // Preconditions: Item exists in committed storage

    let committedMembers = this.committedMembers.get();
    this.committedMembers.assertEquals(committedMembers);

    return member.witness
      .calculateRootSlow(member.getHash())
      .equals(committedMembers);
  }

  /**
   * Method used to commit to the accumulated list of members.
   */
  @method publish() {
    // Commit to the items accumulated so far. This is a periodic update

    let accumulatedMembers = this.accumulatedMembers.get();
    this.accumulatedMembers.assertEquals(accumulatedMembers);

    let committedMembers = this.committedMembers.get();
    this.committedMembers.assertEquals(committedMembers);

    let pendingActions = this.reducer.getActions({
      fromActionState: accumulatedMembers,
    });

    let { state: newCommittedMembers, actionState: newAccumulatedMembers } =
      this.reducer.reduce(
        pendingActions,
        Field,
        (state: Field, action: Member) => {
          // because we inserted empty members, we need to check if a member is empty or "real"
          let isRealMember = Circuit.if(
            action.publicKey.equals(PublicKey.empty()),
            Bool(false),
            Bool(true)
          );

          // if the member is real and not empty, we calculate and return the new merkle root
          // otherwise, we simply return the unmodified state - this is our way of branching
          return Circuit.if(
            isRealMember,
            action.witness.calculateRootSlow(action.getHash()),
            state
          );
        },
        // initial state
        { state: committedMembers, actionState: accumulatedMembers },
        { maxTransactionsWithActions: 2 }
      );

    this.committedMembers.set(newCommittedMembers);
    this.accumulatedMembers.set(newAccumulatedMembers);

    this.emitEvent('newMemberState', {
      committedMembersRoot: newCommittedMembers,
      accumulatedMembersRoot: newAccumulatedMembers,
    });
  }
}
