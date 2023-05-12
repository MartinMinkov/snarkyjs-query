import { fetchLastBlock, UInt32 } from 'snarkyjs';
import config from '../config.json';

/**
 * It waits until the current block height has increased.
 *
 * @param [retries=20] - The number of times to retry before timing out.
 * @param [interval=30000] - the time in milliseconds between each check.
 */
export async function waitUntilNextBlock(
  retries = 20,
  interval = 30000
): Promise<void> {
  // eslint-disable-next-line no-async-promise-executor
  await new Promise<void>(async (resolve, reject) => {
    const timeoutMilliseconds = retries * interval;
    const timeoutId = setTimeout(() => {
      reject(
        new Error(`Reached timeout after ${timeoutMilliseconds / 1000} seconds`)
      );
    }, timeoutMilliseconds); // timeout

    let startingHeight = await getCurrentBlockLength();

    const timerId = setInterval(async () => {
      const currentHeight = await getCurrentBlockLength();
      const hasIncreased = currentHeight.greaterThan(startingHeight);

      if (hasIncreased.toBoolean()) {
        const start = startingHeight.toString();
        const current = currentHeight.toString();
        console.log(
          `Block has increased from ${start} to ${current}, continuing...`
        );

        clearTimeout(timeoutId);
        clearInterval(timerId);
        resolve();
      }
      console.log(`Retrying in ${interval / 1000} seconds...`);
    }, interval);
  });
}

async function getCurrentBlockLength(): Promise<UInt32> {
  const { blockchainLength } = await fetchLastBlock(
    config.networks.berkeley.mina
  );
  return blockchainLength;
}
