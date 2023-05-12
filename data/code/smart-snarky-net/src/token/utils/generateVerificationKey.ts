import { Field, PrivateKey, PublicKey, isReady } from 'snarkyjs';
import { writeFile } from 'fs/promises';

await isReady;

// write verificationKey to file

export async function saveVerificationKey(
  verificationKeyHash: Field | undefined,
  verificationKey: string | undefined,
  name: string,
  publicKey: PublicKey,
  privateKey: PrivateKey
) {
  try {
    const data = {
      hash: verificationKeyHash,
      vk: verificationKey,
      publicKey: publicKey,
      privateKey: privateKey.toBase58(),
    };

    await writeFile(
      `./src/${name}VerificationKey.json`,
      JSON.stringify(data, null, 2)
    );
    console.log(`Verification key for ${name} saved to file`);
  } catch (error) {
    console.error(`Error saving verification key for ${name}:`, error);
  }
}
