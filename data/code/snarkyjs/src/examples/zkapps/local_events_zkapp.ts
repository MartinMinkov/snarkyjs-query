import {
  Field,
  state,
  State,
  method,
  UInt64,
  PrivateKey,
  SmartContract,
  Mina,
  AccountUpdate,
  isReady,
  UInt32,
  PublicKey,
  Struct,
} from 'snarkyjs';

const doProofs = false;

await isReady;

class Event extends Struct({ pub: PublicKey, value: Field }) {}

class SimpleZkapp extends SmartContract {
  @state(Field) x = State<Field>();

  events = {
    complexEvent: Event,
    simpleEvent: Field,
  };

  init() {
    super.init();
    this.x.set(initialState);
  }

  @method update(y: Field) {
    this.emitEvent('complexEvent', {
      pub: PrivateKey.random().toPublicKey(),
      value: y,
    });
    this.emitEvent('simpleEvent', y);
    let x = this.x.get();
    this.x.assertEquals(x);
    this.x.set(x.add(y));
  }
}

let Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);

// a test account that pays all the fees, and puts additional funds into the zkapp
let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

// the zkapp account
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let initialState = Field(1);
let zkapp = new SimpleZkapp(zkappAddress);

if (doProofs) {
  console.log('compile');
  await SimpleZkapp.compile();
}

console.log('deploy');
let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer);
  zkapp.deploy();
});
await tx.sign([feePayerKey, zkappKey]).send();

console.log('call update');
tx = await Mina.transaction(feePayer, () => {
  zkapp.update(Field(1));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('call update');
tx = await Mina.transaction(feePayer, () => {
  zkapp.update(Field(2));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('---- emitted events: ----');
// fetches all events from zkapp starting block height 0
let events = await zkapp.fetchEvents(UInt32.from(0));
console.log(events);
console.log('---- emitted events: ----');
// fetches all events from zkapp starting block height 0 and ending at block height 10
events = await zkapp.fetchEvents(UInt32.from(0), UInt64.from(10));
console.log(events);
console.log('---- emitted events: ----');
// fetches all events
events = await zkapp.fetchEvents();
console.log(events);
