// Description:

import {
  UInt64,
  Field,
  SmartContract,
  method,
  state,
  State,
  Circuit,
  Permissions,
  Poseidon,
  UInt32,
} from 'snarkyjs';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
import { NeuralNetProof } from './recursionProof.js';
import { preprocessWeights } from './utils/preprocess.js';
import { weights_l1_8x8 } from './assets/weights_l1_8x8.js';
import { weights_l2_8x8 } from './assets/weights_l2_8x8.js';

let snarkyLayer1s = new SnarkyLayer1(preprocessWeights(weights_l1_8x8), 'relu');

let snarkyLayer2s = new SnarkyLayer2(
  preprocessWeights(weights_l2_8x8),
  'softmax'
);

export class SmartSnarkyNet extends SmartContract {
  events = {
    'set-layer1': Field,
    'set-layer2': Field,
    'set-classification': Field,
  };
  // The layer states are used to fix the architecture of the network
  // We use the classification to store the result of the prediction
  @state(Field) classification = State<Field>(); // stored state for classification
  @state(Field) layer1Hash = State<Field>(); // stored state for Layer1
  @state(Field) layer2Hash = State<Field>(); // stored state for Layer2

  init() {
    super.init();
    this.classification.set(Field(0));
    this.layer1Hash.set(Poseidon.hash(snarkyLayer1s.toFields()));
    this.layer2Hash.set(Poseidon.hash(snarkyLayer2s.toFields()));
    this.account.zkappUri.set('www.neuralNetSnarky.com');
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      access: Permissions.proofOrSignature(),
      setZkappUri: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setTokenSymbol: Permissions.impossible(),
    });
  }

  @method setLayerHashes(layer1DummyHash: Field, layer2DummyHash: Field) {
    this.layer1Hash.set(layer1DummyHash);
    this.layer2Hash.set(layer2DummyHash);
    this.requireSignature();
  }

  @method predict(neuralNetProof: NeuralNetProof) {
    // generating the hash of layers that were used in the proof generation
    let actualLayer1Hash = Poseidon.hash(
      neuralNetProof.publicInput.layer1.toFields()
    );
    let actualLayer2Hash = Poseidon.hash(
      neuralNetProof.publicInput.layer2.toFields()
    );

    // fetch layer1Hash from contract state
    let layerState = this.layer1Hash.get();
    this.layer1Hash.assertEquals(layerState); // require that the layerState is correct

    // fetch layers2Hash from contract state
    let layerState2 = this.layer2Hash.get();
    this.layer2Hash.assertEquals(layerState2);

    // check that the onChain layer1Hash and layer2Hash are equal to the layer1Hash / layer2Hash used in the proof generation
    this.layer1Hash.assertEquals(actualLayer1Hash);
    this.layer2Hash.assertEquals(actualLayer2Hash);

    //obtain the predictions
    let prediction = neuralNetProof.publicInput.precomputedOutputLayer2;

    // finding the max value of the prediction array
    // and returning the index of the max value
    let max = Field(0);
    let classificationTest = Field(0);
    for (let i = 0; i < prediction.length; i++) {
      [max, classificationTest] = Circuit.if(
        // commented out because of bug in snarkyjs 0.9.8
        // max.greaterThan(prediction[i]),
        UInt32.from(max).greaterThan(UInt32.from(prediction[i])),

        [max, classificationTest],
        [prediction[i], Field(i)]
      );
    }

    // ---------------------------- set the classification ----------------------------
    let classification = this.classification.get();
    this.classification.assertEquals(classification);
    // this.classification.set(classification89);
    this.classification.set(classificationTest);
    this.emitEvent('set-classification', classificationTest);
  }
}
