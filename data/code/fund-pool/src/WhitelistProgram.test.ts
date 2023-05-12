import { Field, isReady, MerkleMap, PrivateKey, UInt64 } from 'snarkyjs';
import { withTimer } from './describeContract';
import {
  toWhitelistEntry,
  WhitelistProgram,
  WhitelistProgramInput,
} from './WhitelistProgram';

await isReady;

export const whitelistProgramTestData = () => {
  // prepare testing keys
  const alice = PrivateKey.random();
  const charlie = PrivateKey.random();

  // prepare testing whitelist tree
  const whitelist = new MerkleMap();
  // only alice is whitelisted, charlie is not whitelisted
  whitelist.set(Field(1), toWhitelistEntry(alice));

  const whitelistRoot = whitelist.getRoot();

  return { alice, charlie, whitelist, whitelistRoot };
};

const { alice, charlie, whitelist, whitelistRoot } = whitelistProgramTestData();

describe('WhitelistProgram', () => {
  beforeAll(async () => {
    await withTimer('compile', async () => {
      await WhitelistProgram.compile();
    });
  });

  it('should produce a valid proof for a whitelisted key', async () => {
    const witness = whitelist.getWitness(Field(1));
    const publicInput = new WhitelistProgramInput({
      whitelistRoot,
      validUntilBlock: UInt64.from(0),
    });
    const proof = await WhitelistProgram.isWhitelisted(
      publicInput,
      alice,
      witness
    );
    const verified = await WhitelistProgram.verify(proof);
    expect(verified).toBe(true);
  });

  it('should fail to produce a valid proof for a key that is not whitelisted', async () => {
    const witness = whitelist.getWitness(Field(1));
    const publicInput = new WhitelistProgramInput({
      whitelistRoot,
      validUntilBlock: UInt64.from(0),
    });

    expect(
      WhitelistProgram.isWhitelisted(publicInput, charlie, witness)
    ).rejects.toBeTruthy();
  });
});
