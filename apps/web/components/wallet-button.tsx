"use client";

import { useWalletSession } from "@/components/wallet-session";

export function WalletButton() {
  const { address, connecting, connect } = useWalletSession();

  if (address) {
    return (
      <button type="button" className="connected-wallet" aria-label={"Connected wallet " + address}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button type="button" disabled={connecting} onClick={() => void connect()}>
      {connecting ? "Connecting..." : "Connect wallet"}
    </button>
  );
}
