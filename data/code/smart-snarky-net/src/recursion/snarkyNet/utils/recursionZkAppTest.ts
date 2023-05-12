// import {
//   SmartContract,
//   State,
//   UInt64,
//   state,
//   method,
//   Experimental,
//   Field,
//   SelfProof,
//   verify,
//   isReady,
//   Struct,
//   Circuit,
//   Poseidon,
// } from 'snarkyjs';
// await isReady;

// // these transitions are allowed
// let array1 = [
//   [Field(1), Field(1), Field(1)],
//   [Field(2), Field(2), Field(2)],
// ];
// // let array2 = [
// //   [Field(2), Field(2), Field(2)],
// //   [Field(3), Field(3), Field(3)],
// // ];
// // let array3 = [
// //   [Field(3), Field(3), Field(3)],
// //   [Field(4), Field(4), Field(4)],
// // ];

// // class for pixels to prove in zk program
// class PixelChange extends Struct({
//   initial: Circuit.array(Field, 3),
//   latest: Circuit.array(Field, 3),
// }) {
//   static addOneToPixels(initial: Field[], latest: Field[]) {
//     // add 1 to each element of the array
//     // we check that initial array is true in the zk program
//     // initial.assertEqualsArray(array1);
//     let newPixelArray = initial.map((initial) => initial.add(Field(1)));
//     Poseidon.hash(newPixelArray).assertEquals(Poseidon.hash(latest));
//     return new PixelChange({ initial: initial, latest: newPixelArray });
//   }

//   // static createMerged(state1: PixelChange, state2: PixelChange) {
//   //   return new PixelChange({
//   //     initial: state1.initial,
//   //     latest: state2.latest,
//   //   });
//   // }

//   static assertEqualsArray(state1: Field[], state2: Field[]) {
//     Poseidon.hash(state1).assertEquals(Poseidon.hash(state2));
//   }

//   static assertEqualsPixelChanges(state1: PixelChange, state2: PixelChange) {
//     Poseidon.hash(state1.initial).assertEquals(Poseidon.hash(state2.initial));
//     Poseidon.hash(state1.latest).assertEquals(Poseidon.hash(state2.latest));
//   }
// }

// export const PixelChangeProof = Experimental.ZkProgram({
//   publicInput: PixelChange,

//   methods: {
//     init: {
//       privateInputs: [Circuit.array(Field, 3)],
//       method(state: PixelChange, initialRoot: Field[]) {
//         PixelChange.assertEqualsArray(initialRoot, state.initial);
//       },
//     },

//     oneStep: {
//       privateInputs: [Circuit.array(Field, 3), Circuit.array(Field, 3)],

//       method(state: PixelChange, initialRoot: Field[], latestRoot: Field[]) {
//         const computedState = PixelChange.addOneToPixels(
//           initialRoot,
//           latestRoot
//         );
//         PixelChange.assertEqualsPixelChanges(computedState, state);
//       },
//     },

//     merge: {
//       privateInputs: [SelfProof, SelfProof],

//       method(
//         state: PixelChange,
//         pixelProof0: SelfProof<PixelChange>,
//         pixelProof1: SelfProof<PixelChange>
//       ) {
//         pixelProof0.verify();
//         pixelProof1.verify();

//         Poseidon.hash(pixelProof0.publicInput.initial).assertEquals(
//           Poseidon.hash(pixelProof1.publicInput.initial)
//         );
//         // rollup2proof.publicInput.initial.assertEqualsArray(rollup1proof.publicInput.latest);
//         // rollup1proof.publicInput.initialRoot.assertEquals(newState.initialRoot);
//         // rollup2proof.publicInput.latestRoot.assertEquals(newState.latestRoot);
//       },
//     },
//   },
// });

// console.log('compiling...');

// const { verificationKey } = await PixelChangeProof.compile();

// console.log('making proof 0');

// let stateChange1 = PixelChange.addOneToPixels(array1[0], array1[1]);
// const proof0 = await PixelChangeProof.init(stateChange1, array1[0]);

// // const ok = await verify(proof0.toJSON(), verificationKey);
// // console.log('ok', ok);

// console.log('making proof 1');
// let proof1 = await PixelChangeProof.oneStep(
//   stateChange1,
//   stateChange1.initial,
//   stateChange1.latest
// );

// // const ok = await verify(proof1.toJSON(), verificationKey);
// // console.log('ok', ok);
// // let newPixelArray = new Pixels({ x: [Field(1), Field(1), Field(1)] }).add();
// // console.log('newPixelArray', newPixelArray.x.toString());

// // const proof1 = await Add.addNumber(Field(4), proof0, Field(4));

// console.log('making proof 2');
// let proof2 = await PixelChangeProof.merge(stateChange1, proof0, proof1);

// // const proof2 = await Add.add(Field(4), proof1, proof0);

// // console.log('verifying proof 2');
// // console.log('proof 2 data', proof2.publicInput.toString());

// // const ok = await verify(proof2.toJSON(), verificationKey);
// // console.log('ok', ok);
