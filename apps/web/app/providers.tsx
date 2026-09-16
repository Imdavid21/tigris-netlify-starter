"use client";

import { AppMotion } from "@/components/app-motion";
import { WalletSessionProvider } from "@/components/wallet-session";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletSessionProvider>
      <AppMotion>{children}</AppMotion>
    </WalletSessionProvider>
  );
}
