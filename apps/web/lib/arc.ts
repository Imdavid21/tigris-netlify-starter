import { defineChain } from "viem";

export const arcChainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? "5042002");
export const isArcMainnet = arcChainId === 5042;

const defaultRpcUrl = isArcMainnet
  ? "https://rpc.mainnet.arc.io"
  : "https://rpc.testnet.arc.network";

export const arcExplorerUrl =
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ??
  (isArcMainnet ? "https://arc-scan.org" : "https://testnet.arc-scan.org");

export const arcTestnet = defineChain({
  id: arcChainId,
  name: isArcMainnet ? "Arc" : "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? defaultRpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: arcExplorerUrl
    }
  }
});

function networkAddress(
  configured: string | undefined,
  testnetFallback: `0x${string}`,
  name: string
): `0x${string}` {
  if (configured) return configured as `0x${string}`;
  if (isArcMainnet) {
    throw new Error(`${name} must be configured for Arc mainnet`);
  }
  return testnetFallback;
}

export const addresses = {
  factory: networkAddress(
    process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
    "0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423",
    "NEXT_PUBLIC_FACTORY_ADDRESS"
  ),
  usdc:
    (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined) ??
    "0x3600000000000000000000000000000000000000",
  feeEscrow: networkAddress(
    process.env.NEXT_PUBLIC_FEE_ESCROW_ADDRESS,
    "0x6D1597932B93b9939f21E9A8D8C2908457F7925d",
    "NEXT_PUBLIC_FEE_ESCROW_ADDRESS"
  )
};
