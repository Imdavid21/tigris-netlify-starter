"use client";
import { ui } from "@/styles/ui";


import { useWalletSession } from "@/components/wallet-session";

export function WalletButton() {
  const { address, connecting, connect } = useWalletSession();

  if (address) {
    return (
      <a href="/portfolio" className={ui("connected-wallet")} aria-label={"Connected wallet " + address}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </a>
    );
  }

  return (
    <button type="button" disabled={connecting} onClick={() => void connect()}>
      {connecting ? "Connecting..." : "Connect wallet"}
    </button>
  );
}
