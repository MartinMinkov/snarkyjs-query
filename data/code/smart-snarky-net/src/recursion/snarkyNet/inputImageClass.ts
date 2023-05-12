// This file is used to generate an InputImage class that is used to store the image matrix and use in the circuit.

export { InputImage };

import { Field, Struct, Circuit } from 'snarkyjs';

class InputImage extends Struct({
  value: Circuit.array(Field, 64),
}) {
  num2Int64_t1(x: Field[]): Field[] {
    let y = Array();
    x.forEach((value, index) => (y[index] = this.num2Int64(value)));
    return y;
  }
  num2Int64(x: Field): Field {
    return Field(x);
  }
}
