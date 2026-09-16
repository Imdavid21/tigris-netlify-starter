import { createPublicClient, defineChain, fallback, http, webSocket } from "viem";
import { createDatabasePool } from "./database.js";

const rpcUrls = [
  process.env.ARC_RPC_URL,
  ...(process.env.ARC_RPC_FALLBACKS ?? "").split(",")
].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const wsUrl = process.env.ARC_WS_URL;
const rpcMinRequestGapMs = Math.max(0, Number(process.env.ARC_RPC_MIN_REQUEST_GAP_MS ?? "500"));

if (!rpcUrls.length) {
  throw new Error("ARC_RPC_URL is required");
}

const arc = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? "5042002"),
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: rpcUrls } }
});

function pacedHttp(url: string) {
  const base = http(url, { retryCount: 0, timeout: 15_000 });
  let queue: Promise<void> = Promise.resolve();
  let lastRequestAt = 0;

  return (config: any) => {
    const transport = base(config);
    const request = transport.request;

    return {
      ...transport,
      request: (args: any) => {
        const run = queue.then(async () => {
          const waitMs = Math.max(0, lastRequestAt + rpcMinRequestGapMs - Date.now());
          if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
          lastRequestAt = Date.now();
          return request(args);
        });
        queue = run.then(() => undefined, () => undefined);
        return run;
      }
    };
  };
}

const transports = [
  ...(wsUrl ? [webSocket(wsUrl, { reconnect: true })] : []),
  ...rpcUrls.map((url) => pacedHttp(url))
];

export const client = createPublicClient({
  chain: arc,
  pollingInterval: Number(process.env.ARC_POLLING_INTERVAL_MS ?? "30000"),
  transport: transports.length === 1 ? transports[0] : fallback(transports, { rank: true })
});

export const db = createDatabasePool();
