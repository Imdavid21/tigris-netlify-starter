"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWalletSession } from "@/components/wallet-session";
import { M3Button } from "@/components/m3/primitives";
import { ArcBeaconLoader, CheckSpinLoader } from "@/components/dotmatrix/celestial-loaders";
import { motionSpring } from "@/lib/motion-system";
import styles from "./WalletButton.module.css";

export function WalletButton() {
  const {
    address,
    connecting,
    wallets,
    activeWallet,
    connect,
    switchWallet,
    changeAccount,
    disconnect
  } = useWalletSession();
  const [showConnectedPulse, setShowConnectedPulse] = useState(false);
  const [open, setOpen] = useState(false);
  const wasConnecting = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  if (!address) {
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

  return (
    <div className={styles.root} ref={rootRef}>
      <M3Button
        type="button"
        variant="tonal"
        className="connected-wallet"
        aria-label={"Wallet menu for " + address}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {showConnectedPulse && (
          <CheckSpinLoader size={17} dotSize={2.8} speed={1.25} ariaLabel="Wallet connected" tone="success" />
        )}
        {address.slice(0, 6)}...{address.slice(-4)}
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </M3Button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.menu}
            role="menu"
            initial={{ opacity: 0, y: -7, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: .98 }}
            transition={motionSpring.spatialFast}
          >
            <div className={styles.identity}>
              <span>{activeWallet?.name || "Connected wallet"}</span>
              <strong>{address.slice(0, 8)}...{address.slice(-6)}</strong>
            </div>

            <div className={styles.section}>
              <span className={styles.label}>Switch wallet</span>
              {wallets.map((wallet) => (
                <button
                  type="button"
                  role="menuitem"
                  key={wallet.id}
                  className={`${styles.walletOption} ${wallet.id === activeWallet?.id ? styles.selected : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (wallet.id !== activeWallet?.id) void switchWallet(wallet.id);
                  }}
                >
                  {wallet.icon ? <img src={wallet.icon} alt="" /> : <span className={styles.walletFallback}>{wallet.name.slice(0, 1)}</span>}
                  <span>{wallet.name}</span>
                  {wallet.id === activeWallet?.id && <span className={styles.check}>✓</span>}
                </button>
              ))}
              {wallets.length < 2 && <span className={styles.hint}>No other injected wallets detected.</span>}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void changeAccount();
                }}
              >
                Change account
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.disconnect}
                onClick={() => {
                  setOpen(false);
                  void disconnect();
                }}
              >
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
