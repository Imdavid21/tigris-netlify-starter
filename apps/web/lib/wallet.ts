import { arcTestnet } from "./arc";
import type { EIP1193Provider } from "viem";

export async function ensureArcChain(provider: EIP1193Provider) {
  const chainId = `0x${arcTestnet.id.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error: any) {
    if (error?.code !== 4902 && !String(error?.message ?? "").toLowerCase().includes("unrecognized")) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: arcTestnet.name,
        nativeCurrency: arcTestnet.nativeCurrency,
        rpcUrls: [
          process.env.NEXT_PUBLIC_ARC_WALLET_RPC_URL ??
            process.env.NEXT_PUBLIC_ARC_RPC_URL ??
            arcTestnet.rpcUrls.default.http[0]
        ],
        blockExplorerUrls: ["https://testnet.arcscan.app"]
      }]
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
}
