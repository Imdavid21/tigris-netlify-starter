"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAddress, type EIP1193Provider } from "viem";
import { ensureArcChain } from "@/lib/wallet";

type InjectedProvider = EIP1193Provider & {
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

type WalletOption = {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: InjectedProvider;
};

type EIP6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: InjectedProvider;
};

type WalletContextValue = {
  address?: `0x${string}`;
  connecting: boolean;
  connected: boolean;
  wallets: WalletOption[];
  activeWallet?: WalletOption;
  provider?: InjectedProvider;
  connect: (walletId?: string) => Promise<`0x${string}` | undefined>;
  switchWallet: (walletId: string) => Promise<`0x${string}` | undefined>;
  changeAccount: () => Promise<`0x${string}` | undefined>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function browserProvider(): InjectedProvider | undefined {
  return (window as Window & { ethereum?: InjectedProvider }).ethereum;
}

function activateBrowserProvider(provider: InjectedProvider) {
  const target = window as Window & { ethereum?: InjectedProvider };
  if (target.ethereum === provider) return;
  try {
    target.ethereum = provider;
  } catch {
    // Some extensions expose a non-writable ethereum property. Session actions still use the selected provider.
  }
}

export function WalletSessionProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}`>();
  const [connecting, setConnecting] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string>();

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!detail?.provider || !detail.info?.uuid) return;

      setWallets((current) => {
        if (current.some((wallet) => wallet.id === detail.info.uuid || wallet.provider === detail.provider)) {
          return current;
        }
        return [
          ...current,
          {
            id: detail.info.uuid,
            name: detail.info.name || "Injected wallet",
            icon: detail.info.icon,
            rdns: detail.info.rdns,
            provider: detail.provider
          }
        ];
      });
    };

    window.addEventListener("eip6963:announceProvider", announce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const fallbackTimer = window.setTimeout(() => {
      const fallback = browserProvider();
      if (!fallback) return;
      setWallets((current) => {
        if (current.some((wallet) => wallet.provider === fallback)) return current;
        return [
          ...current,
          {
            id: "legacy-injected",
            name: "Browser wallet",
            provider: fallback
          }
        ];
      });
    }, 120);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("eip6963:announceProvider", announce as EventListener);
    };
  }, []);

  useEffect(() => {
    if (activeWalletId || !wallets[0]) return;
    const current = browserProvider();
    const preferred = wallets.find((wallet) => wallet.provider === current) ?? wallets[0];
    setActiveWalletId(preferred.id);
  }, [wallets, activeWalletId]);

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === activeWalletId) ?? wallets[0],
    [wallets, activeWalletId]
  );
  const provider = activeWallet?.provider;

  useEffect(() => {
    if (provider) activateBrowserProvider(provider);
  }, [provider]);

  const refresh = useCallback(async () => {
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
  }, [provider]);

  const connect = useCallback(async (walletId?: string) => {
    const target = walletId
      ? wallets.find((wallet) => wallet.id === walletId)
      : activeWallet;
    if (!target) return undefined;

    setConnecting(true);
    setActiveWalletId(target.id);
    activateBrowserProvider(target.provider);
    try {
      await ensureArcChain(target.provider);
      const accounts = (await target.provider.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts[0] ? getAddress(accounts[0]) : undefined;
      setAddress(next);
      return next;
    } finally {
      setConnecting(false);
    }
  }, [wallets, activeWallet]);

  const switchWallet = useCallback(async (walletId: string) => {
    setAddress(undefined);
    return connect(walletId);
  }, [connect]);

  const changeAccount = useCallback(async () => {
    if (!provider) return connect();

    setConnecting(true);
    try {
      try {
        await provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }]
        } as any);
      } catch {
        // Some injected wallets do not implement wallet_requestPermissions.
      }
      await ensureArcChain(provider);
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts[0] ? getAddress(accounts[0]) : undefined;
      setAddress(next);
      return next;
    } finally {
      setConnecting(false);
    }
  }, [provider, connect]);

  const disconnect = useCallback(async () => {
    if (provider) {
      try {
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        } as any);
      } catch {
        // Revocation is wallet-specific. Always clear the local session below.
      }
    }
    setAddress(undefined);
  }, [provider]);

  useEffect(() => {
    void refresh();
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
  }, [provider, refresh]);

  const value = useMemo(
    () => ({
      address,
      connecting,
      connected: Boolean(address),
      wallets,
      activeWallet,
      provider,
      connect,
      switchWallet,
      changeAccount,
      disconnect,
      refresh
    }),
    [address, connecting, wallets, activeWallet, provider, connect, switchWallet, changeAccount, disconnect, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletSession() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWalletSession must be used inside WalletSessionProvider");
  return value;
}
