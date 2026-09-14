"use client";

import { useWalletSession } from "@/components/wallet-session";

export function WalletButton() {
  const { address, connecting, connect } = useWalletSession();

  return (
    <button type="button" disabled={connecting} onClick={() => void connect()}>
      {connecting
        ? "Connecting..."
        : address
          ? address.slice(0, 6) + "..." + address.slice(-4)
          : "Connect wallet"}
    </button>
  );
}
