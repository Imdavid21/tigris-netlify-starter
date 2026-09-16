"use client";

import { AppMotion } from "@/components/app-motion";
import { MaterialWebProvider } from "@/components/material-web-provider";
import { WalletSessionProvider } from "@/components/wallet-session";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MaterialWebProvider>
      <WalletSessionProvider>
        <AppMotion>{children}</AppMotion>
      </WalletSessionProvider>
    </MaterialWebProvider>
  );
}
