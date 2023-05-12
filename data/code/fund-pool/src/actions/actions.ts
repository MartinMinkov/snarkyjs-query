import { Struct, Field, PublicKey, UInt64 } from 'snarkyjs';

export class Action extends Struct({
  type: Field,

  payload: {
    address: PublicKey,
    amount: UInt64,
  },
}) {
  public static get types() {
    return {
      deposit: Field(0),
      claim: Field(1),
      withdraw: Field(2),
    };
  }

  public static deposit(address: PublicKey, amount: UInt64): Action {
    return new Action({
      type: Action.types.deposit,
      payload: { address, amount },
    });
  }

  public static claim(address: PublicKey): Action {
    return new Action({
      type: Action.types.claim,
      payload: { address, amount: UInt64.from(0) },
    });
  }

  public static withdraw(address: PublicKey): Action {
    return new Action({
      type: Action.types.withdraw,
      payload: { address, amount: UInt64.from(0) },
    });
  }
}
