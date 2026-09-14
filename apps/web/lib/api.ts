export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://arc-launchpad-api.onrender.com";

export type IndexedTrade = {
  tx_hash: string;
  block_time: string;
  trader: string;
  side: "BUY" | "SELL";
  token_amount: string;
  quote_amount: string;
  fee_amount: string;
};

export async function getIndexedToken(address: string) {
  const res = await fetch(API_URL + "/tokens/" + address, {
    cache: "no-store"
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    address: string;
    curve_address: string;
    creator: string;
    name: string;
    symbol: string;
    status: string;
    trades: IndexedTrade[];
  }>;
}

export async function getProtocolStats() {
  const res = await fetch(API_URL + "/stats", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    launches: number;
    trades: number;
    quote_volume: string;
    graduated: number;
  }>;
}
