import { createPublicClient, defineChain, http, webSocket } from "viem";
import pg from "pg";

const rpcUrl = process.env.ARC_RPC_URL;
const wsUrl = process.env.ARC_WS_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!rpcUrl || !databaseUrl) {
  throw new Error("ARC_RPC_URL and DATABASE_URL are required");
}

const arc = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? "5042002"),
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } }
});

export const client = createPublicClient({
  chain: arc,
  transport: wsUrl ? webSocket(wsUrl) : http(rpcUrl)
});

export const db = new pg.Pool({ connectionString: databaseUrl });
