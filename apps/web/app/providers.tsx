"use client";

import { WalletSessionProvider } from "@/components/wallet-session";

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletSessionProvider>{children}</WalletSessionProvider>;
}
