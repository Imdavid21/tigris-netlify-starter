import type { Address, PublicClient, WalletClient } from "viem";

const writeQueues = new Map<string, Promise<unknown>>();

function isNonceTooLow(error: unknown) {
  const text = String((error as any)?.shortMessage ?? (error as any)?.message ?? error).toLowerCase();
  const details = String((error as any)?.details ?? "").toLowerCase();
  return text.includes("nonce too low") || details.includes("nonce too low");
}

async function freshNonce(client: PublicClient, account: Address) {
  return client.getTransactionCount({ address: account, blockTag: "pending" });
}

/**
 * Browser wallets can retain a stale local nonce after rapid Arc transactions.
 * Serialize writes per account and explicitly use the RPC's pending nonce.
 * A nonce-too-low rejection is safe to retry once because the rejected tx was
 * not accepted into the mempool.
 */
export async function writeContractFreshNonce(
  wallet: WalletClient,
  client: PublicClient,
  account: Address,
  request: any
): Promise<`0x${string}`> {
  const key = account.toLowerCase();
  const previous = writeQueues.get(key) ?? Promise.resolve();

  const current = previous.catch(() => undefined).then(async () => {
    let nonce = await freshNonce(client, account);
    try {
      return await wallet.writeContract({ ...request, account, nonce } as any);
    } catch (error) {
      if (!isNonceTooLow(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
      nonce = await freshNonce(client, account);
      return wallet.writeContract({ ...request, account, nonce } as any);
    }
  });

  writeQueues.set(key, current);
  try {
    return await current as `0x${string}`;
  } finally {
    if (writeQueues.get(key) === current) writeQueues.delete(key);
  }
}
