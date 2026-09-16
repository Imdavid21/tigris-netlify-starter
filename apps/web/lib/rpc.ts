import { createPublicClient, fallback, http } from "viem";
import { arcTestnet, isArcMainnet } from "./arc";

function rpcUrls() {
  const configured = [
    process.env.NEXT_PUBLIC_ARC_RPC_URL,
    ...(process.env.NEXT_PUBLIC_ARC_RPC_FALLBACKS ?? "").split(",")
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const defaultRpc = isArcMainnet
    ? "https://rpc.mainnet.arc.io"
    : "https://rpc.testnet.arc.network";
  const urls = configured.length ? configured : [defaultRpc];
  return [...new Set(urls)];
}

export function createArcPublicClient() {
  const transports = rpcUrls().map((url) =>
    http(url, {
      retryCount: 2,
      retryDelay: 500,
      timeout: 12_000
    })
  );

  return createPublicClient({
    chain: arcTestnet,
    transport: transports.length === 1 ? transports[0] : fallback(transports, { rank: true })
  });
}

export function friendlyChainError(error: unknown, fallbackMessage = "Transaction failed.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (
    message.includes("rate limit") ||
    message.includes("request exceeds defined limit") ||
    message.includes("-32005") ||
    message.includes("0x4cef52")
  ) {
    return "Arc RPC is rate limiting this request. Wait a few seconds and retry. If it persists, use a dedicated Arc RPC in your wallet/network settings.";
  }

  if (message.includes("user rejected") || message.includes("user denied") || message.includes("4001")) {
    return "Transaction cancelled in wallet.";
  }

  if (message.includes("insufficient funds")) {
    return "Insufficient balance for this transaction and gas.";
  }

  return raw || fallbackMessage;
}
