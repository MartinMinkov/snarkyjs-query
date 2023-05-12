// proxy for the recursion zkApp

import {
  SmartContract,
  State,
  UInt64,
  state,
  method,
  PublicKey,
  Permissions,
} from 'snarkyjs';
import { SmartSnarkyNet } from './snarkyNet/smartSnarkyNet';
import { NeuralNetProof } from './snarkyNet/recursionProof';

export class ProxyRecursionZkApp extends SmartContract {
  @state(UInt64) onChainState = State<UInt64>();

  init() {
    super.init();
    this.onChainState.set(UInt64.from(0));
    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey: Permissions.signature(),
    });
  }

  @method callPredict(proof: NeuralNetProof, smartSnarkyNetAddress: PublicKey) {
    const smartSnarkyNet = new SmartSnarkyNet(smartSnarkyNetAddress);
    smartSnarkyNet.predict(proof);
  }
}
