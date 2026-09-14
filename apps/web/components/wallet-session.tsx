"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAddress, type EIP1193Provider } from "viem";
import { ensureArcChain } from "@/lib/wallet";

type WalletContextValue = {
  address?: `0x${string}`;
  connecting: boolean;
  connected: boolean;
  connect: () => Promise<`0x${string}` | undefined>;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function injected(): (EIP1193Provider & {
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}) | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum as any;
}

export function WalletSessionProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}`>();
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    const provider = injected();
    if (!provider) {
      setAddress(undefined);
      return;
    }

    try {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      setAddress(accounts[0] ? getAddress(accounts[0]) : undefined);
    } catch {
      setAddress(undefined);
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = injected();
    if (!provider) return undefined;

    setConnecting(true);
    try {
      await ensureArcChain(provider);
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts[0] ? getAddress(accounts[0]) : undefined;
      setAddress(next);
      return next;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const provider = injected();
    if (!provider?.on) return;

    const onAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] ? getAddress(accounts[0]) : undefined);
    };
    const onDisconnect = () => setAddress(undefined);

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("disconnect", onDisconnect);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      address,
      connecting,
      connected: Boolean(address),
      connect,
      refresh
    }),
    [address, connecting, connect, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletSession() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWalletSession must be used inside WalletSessionProvider");
  return value;
}
