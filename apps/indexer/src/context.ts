import { createPublicClient, defineChain, fallback, http, webSocket } from "viem";
import pg from "pg";

const rpcUrls = [
  process.env.ARC_RPC_URL,
  ...(process.env.ARC_RPC_FALLBACKS ?? "").split(",")
].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const wsUrl = process.env.ARC_WS_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!rpcUrls.length || !databaseUrl) {
  throw new Error("ARC_RPC_URL and DATABASE_URL are required");
}

const arc = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? "5042002"),
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: rpcUrls } }
});

const transports = [
  ...(wsUrl ? [webSocket(wsUrl, { reconnect: true })] : []),
  ...rpcUrls.map((url) => http(url, { retryCount: 2, retryDelay: 750, timeout: 15_000 }))
];

export const client = createPublicClient({
  chain: arc,
  pollingInterval: Number(process.env.ARC_POLLING_INTERVAL_MS ?? "30000"),
  transport: transports.length === 1 ? transports[0] : fallback(transports, { rank: true })
});

export const db = new pg.Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX ?? "10"),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});
