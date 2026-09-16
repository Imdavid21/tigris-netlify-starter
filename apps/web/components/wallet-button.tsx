"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletSession } from "@/components/wallet-session";
import { M3Button } from "@/components/m3/primitives";
import { ArcBeaconLoader, CheckSpinLoader } from "@/components/dotmatrix/celestial-loaders";

export function WalletButton() {
  const { address, connecting, connect } = useWalletSession();
  const [showConnectedPulse, setShowConnectedPulse] = useState(false);
  const wasConnecting = useRef(false);

  useEffect(() => {
    if (connecting) {
      wasConnecting.current = true;
      return;
    }

    if (address && wasConnecting.current) {
      wasConnecting.current = false;
      setShowConnectedPulse(true);
      const timer = window.setTimeout(() => setShowConnectedPulse(false), 900);
      return () => window.clearTimeout(timer);
    }
  }, [address, connecting]);

  if (address) {
    return (
      <M3Button
        type="button"
        variant="tonal"
        className="connected-wallet"
        aria-label={"Connected wallet " + address}
      >
        {showConnectedPulse && (
          <CheckSpinLoader size={17} dotSize={2.8} speed={1.25} ariaLabel="Wallet connected" tone="success" />
        )}
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
      {connecting && <ArcBeaconLoader size={18} dotSize={2.3} speed={1.25} ariaLabel="Connecting wallet" />}
      {connecting ? "Connecting" : "Connect wallet"}
    </M3Button>
  );
}
