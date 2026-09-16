"use client";

import { useWalletSession } from "@/components/wallet-session";
import { M3Button } from "@/components/m3/primitives";
import { MaterialBusy } from "@/components/m3/material-feedback";

export function WalletButton() {
  const { address, connecting, connect } = useWalletSession();

  if (address) {
    return (
      <M3Button
        type="button"
        variant="tonal"
        className="connected-wallet"
        aria-label={"Connected wallet " + address}
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </M3Button>
    );
  }

  return (
    <M3Button
      type="button"
      variant="tonal"
      disabled={connecting}
      onClick={() => void connect()}
      aria-busy={connecting}
    >
      <MaterialBusy busy={connecting} label="Connecting wallet">
        {connecting ? "Connecting" : "Connect wallet"}
      </MaterialBusy>
    </M3Button>
  );
}
