import { Mina, PublicKey, SmartContract, UInt64, fetchAccount } from 'snarkyjs';

export { loopUntilAccountExists };
export { getFriendlyDateTime };
// export { callFaucet };

async function loopUntilAccountExists({
  account,
  eachTimeNotExist,
  isZkAppAccount,
}: {
  account: PublicKey;
  eachTimeNotExist: () => void;
  isZkAppAccount: boolean;
}) {
  for (;;) {
    let response = await fetchAccount({ publicKey: account });
    let accountExists = response.account !== undefined;
    if (isZkAppAccount) {
      accountExists = response.account?.zkapp?.appState !== undefined;
    }
    if (!accountExists) {
      eachTimeNotExist();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      // TODO add optional check that verification key is correct once this is available in SnarkyJS
      return response.account!;
    }
  }
}

// function to print the time
function getFriendlyDateTime() {
  let timestamp = Date.now();
  const date = new Date(timestamp);
  const day = date.toLocaleString('en-US', { weekday: 'long' });
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
  return `${day}, ${month} ${date.getDate()}, ${year} at ${time}`;
}

export async function fetchAndLoopEvents(zkApp: SmartContract) {
  for (;;) {
    let events = await zkApp.fetchEvents();
    if (events.length > 0) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

export async function fetchAndLoopAccount(account: PublicKey) {
  for (;;) {
    let response = await fetchAccount({ publicKey: account });
    if (response.account !== undefined) {
      return response.account;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

const deployTransactionFee = 100_000_000;
