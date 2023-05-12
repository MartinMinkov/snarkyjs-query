import {
  SmartContract,
  state,
  State,
  method,
  Permissions,
  UInt64,
  PublicKey,
  Field,
  Circuit,
  Bool,
  Reducer,
  isReady,
  AccountUpdate,
} from 'snarkyjs';

await isReady;
const tokenSymbol = 'NOOB';

export class NoobToken extends SmartContract {
  reducer = Reducer({ actionType: Field });

  events = {
    'increase-totalAmountInCirculation-to': UInt64,
    'tokens-sent-to': PublicKey,
    'tokens-minted-to': PublicKey,
    'is-Paused': Bool,
    'action-state-update': Field,
  };

  @state(UInt64) totalAmountInCirculation = State<UInt64>();
  @state(UInt64) dummy = State<UInt64>();
  @state(UInt64) isPaused = State<Bool>();
  // used for actions
  @state(Field) actionsHash = State<Field>();
  @state(Field) actionCounter = State<Field>();
  // used for timestamp testing
  @state(UInt64) startDate = State<UInt64>();

  // init is a method that initializes the contract.
  init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.from(0));
    this.dummy.set(UInt64.from(0));
    this.account.zkappUri.set('www.zkapp.com');
    this.isPaused.set(new Bool(false));
    this.actionsHash.set(Reducer.initialActionsHash);
    this.actionCounter.set(Field(0));
    this.account.permissions.set({
      ...Permissions.default(),
      access: Permissions.proofOrSignature(),
      setVerificationKey: Permissions.impossible(),
      editState: Permissions.proofOrSignature(),
      receive: Permissions.none(),
    });
  }

  /**
   * Deposits the specified amount from the sender's account to the contract.
   *
   * @method deposit
   * @param {UInt64} amount - The amount to be deposited from the sender's account to the contract.
   */
  @method deposit(amount: UInt64) {
    // Create a signed AccountUpdate object for the sender's account.
    let senderUpdate = AccountUpdate.createSigned(this.sender);

    // Call the 'send' method of the senderUpdate object to transfer the specified amount
    // from the sender's account to the contract's address.
    senderUpdate.send({ to: this, amount });
  }

  /**
   * Increments the action counter by the specified amount using the reducer.
   *
   * @method incrementCounter
   * @param {Field} amount - The amount by which the action counter should be incremented.
   */
  @method incrementCounter(amount: Field) {
    // Call the 'dispatch' method of the 'reducer' object with the specified amount.
    // This will add the amount to the list of pending actions that will be processed later.
    this.reducer.dispatch(amount);
  }

  /**
   * Reduces the list of pending actions to compute and update the action counter and actions hash.
   *
   * @method reduceActions
   */
  @method reduceActions() {
    // Get the current actions hash.
    let actionsHash = this.actionsHash.get();

    // Assert that the current actions hash is as expected.
    this.actionsHash.assertEquals(actionsHash);

    // Get the current action counter value.
    let currentActionCounter = this.actionCounter.get();

    // Assert that the current action counter value is as expected.
    this.actionCounter.assertEquals(currentActionCounter);

    // Retrieve the list of pending actions using the 'reducer' object and the current actions hash.
    let pendingActions = this.reducer.getActions({
      fromActionState: actionsHash,
    });

    // Call the 'reduce' method of the 'reducer' object to process the pending actions.
    // It returns a new state and a new actions hash.
    let { state: newState, actionsHash: newActionsHash } = this.reducer.reduce(
      pendingActions,
      Field,
      (state: Field, _action: Field) => {
        // Define the reduction function that adds the action to the current state.
        return state.add(_action);
      },
      { state: currentActionCounter, actionsHash: actionsHash }
      // { maxTransactionsWithActions: 10 }
    );

    // Update the actions hash with the new value.
    this.actionsHash.set(newActionsHash);

    // Log the new state value.
    // Circuit.log('newState is', newState);

    // Update the action counter with the new state value.
    this.actionCounter.set(newState);
    this.emitEvent('action-state-update', newState);
  }

  /**
   * Pauses or unpauses the contract based on the given boolean value.
   * This method can only be called by the contract owner.
   *
   * @method pause
   * @param {Bool} isPaused - A boolean value indicating whether the contract should be paused (true) or unpaused (false).
   */
  @method pause(isPaused: Bool) {
    // Get the current pause status of the contract.
    let currentIsPaused = this.isPaused.get();

    // Assert that the current pause status is as expected.
    this.isPaused.assertEquals(currentIsPaused);

    // Set the new pause status for the contract.
    this.isPaused.set(isPaused);

    // Require that the function is called by the contract owner.
    this.requireSignature();

    // Emit an event with the name 'is-Paused', passing the new pause status as the payload.
    this.emitEvent('is-Paused', isPaused);
  }

  /**
   * Mints tokens and sends them to the specified receiver address.
   * The minting process can only proceed if the contract is not paused.
   *
   * @method mint
   * @param {PublicKey} receiverAddress - The public key of the receiver's address.
   * @param {UInt64} amount - The amount of tokens to be minted and sent.
   */
  @method mint(receiverAddress: PublicKey, amount: UInt64) {
    // Get the current pause status of the contract.
    let currentisPaused = this.isPaused.get();

    // Assert that the pause status is as expected.
    this.isPaused.assertEquals(currentisPaused);

    // Assert that the contract is not paused.
    currentisPaused.assertEquals(new Bool(false));

    // Get the current total amount of tokens in circulation.
    let totalAmountInCirculation = this.totalAmountInCirculation.get();

    // Assert that the total amount in circulation is as expected.
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);

    // Calculate the new total amount of tokens in circulation.
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    // Mint the tokens using the 'token' object by calling its 'mint' method.
    // The 'mint' method takes an object with 'address' and 'amount' properties.
    this.token.mint({
      address: receiverAddress,
      amount,
    });

    // Update the total amount of tokens in circulation.
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);

    // Emit an event with the name 'tokens-minted-to', passing the receiver's address as the payload.
    this.emitEvent('tokens-minted-to', receiverAddress);

    // Emit an event with the name 'increase-totalAmountInCirculation-to', passing the new total amount in circulation as the payload.
    this.emitEvent(
      'increase-totalAmountInCirculation-to',
      newTotalAmountInCirculation
    );
  }

  /**
   * Sends tokens from one account to another and emits an event after the transfer.
   *
   * @method sendTokens
   * @param {PublicKey} senderAddress - The public key of the sender's address.
   * @param {PublicKey} receiverAddress - The public key of the receiver's address.
   * @param {UInt64} amount - The amount of tokens to be sent.
   */
  @method sendTokens(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64
  ) {
    // Send the tokens using the 'token' object by calling its 'send' method.
    // The 'send' method takes an object with 'from', 'to', and 'amount' properties.
    this.token.send({
      from: senderAddress,
      to: receiverAddress,
      amount: amount,
    });

    // Emit an event with the name 'tokens-sent-to', passing the receiver's address as the payload.
    this.emitEvent('tokens-sent-to', receiverAddress);
  }

  /**
   * Mints new tokens with Mina and sends them to the specified receiver address.
   * It also updates the total amount of tokens in circulation and emits relevant events.
   *
   * @method mintWithMina
   * @param {PublicKey} receiverAddress - The public key of the receiver's address.
   * @param {UInt64} amount - The amount of tokens to be minted and sent.
   */
  @method mintWithMina(receiverAddress: PublicKey, amount: UInt64) {
    // Get the current total amount of tokens in circulation.
    let totalAmountInCirculation = this.totalAmountInCirculation.get();

    // Assert that the total amount in circulation is as expected.
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);

    // Get the account balance.
    let balance = this.account.balance.get();

    // Log the balance in the zkApp.
    Circuit.log('balance in zkApp is, mintwithMina', balance);

    // Assert that the account balance is as expected.
    this.account.balance.assertEquals(balance);

    // Assert that the balance is greater than or equal to the minting amount.
    balance.assertGreaterThanOrEqual(amount);

    // Mint the tokens using the 'token' object by calling its 'mint' method.
    // The 'mint' method takes an object with 'address' and 'amount' properties.
    this.token.mint({
      address: receiverAddress,
      amount,
    });

    // Calculate the new total amount of tokens in circulation.
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    // Update the total amount of tokens in circulation.
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);

    // Emit an event with the name 'tokens-minted-to', passing the receiver's address as the payload.
    this.emitEvent('tokens-minted-to', receiverAddress);

    // Emit an event with the name 'increase-totalAmountInCirculation-to', passing the minted amount as the payload.
    this.emitEvent('increase-totalAmountInCirculation-to', amount);
  }

  /**
   * Sends NOOB tokens to the specified receiver address if the current timestamp is within a valid time range.
   *
   * @method sendNOOBIfCorrectTime
   * @param {PublicKey} receiverAddress - The public key of the receiver's address.
   * @param {UInt64} amount - The amount of NOOB tokens to be sent.
   * @param {UInt64} endDate - The end date (timestamp) of the valid time range for sending tokens.
   */
  @method sendNOOBIfCorrectTime(
    receiverAddress: PublicKey,
    amount: UInt64,
    endDate: UInt64
  ) {
    // Get the start date from the contract's state.
    let currentStartDate = this.startDate.get(); // UInt64.from(Date.UTC(2023, 0, 1)) => 1.Jan.2023

    // Assert that the start date is as expected.
    this.startDate.assertEquals(currentStartDate);

    // Check that the current timestamp is between the start and end dates.
    this.network.timestamp.assertBetween(currentStartDate, endDate);

    // Send the NOOB tokens using the 'token' object by calling its 'send' method.
    // The 'send' method takes an object with 'from', 'to', and 'amount' properties.
    this.token.send({
      from: this.address,
      to: receiverAddress,
      amount: amount,
    });

    // Emit an event with the name 'tokens-sent-to', passing the receiver's address as the payload.
    this.emitEvent('tokens-sent-to', receiverAddress);
  }
}
