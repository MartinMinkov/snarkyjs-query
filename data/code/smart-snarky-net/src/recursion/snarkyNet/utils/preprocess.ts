import { Field } from 'snarkyjs';
import { num2Field_t1, num2Field_t2 } from './scaledWeights2Int65';

export function preprocessWeights(weightsScaled: number[][]): Array<Field>[] {
  const weights_l1_preprocessed = num2Field_t2(weightsScaled);
  // const weights_l2_preprocessed = await num2Field_t2(weights_l2);
  return weights_l1_preprocessed;
}

export function preprocessImage(image: number[]): Array<Field> {
  const imagePreprocessed = num2Field_t1(image);
  // console.log('imagePreprocessed', imagePreprocessed.toString());
  return imagePreprocessed;
}
