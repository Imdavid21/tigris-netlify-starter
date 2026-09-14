import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? "5042002"),
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"]
    }
  }
});

export const addresses = {
  factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined,
  usdc:
    (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ??
    "0x3600000000000000000000000000000000000000"
};
