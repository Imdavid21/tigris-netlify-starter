"use client";
import { ui } from "@/styles/ui";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProtocolStatus } from "@/components/protocol-status";
import { CelestialLogo } from "@/components/celestial-logo";

export function AppHeader() {
  const path = usePathname();
  return (
    <>
      <ProtocolStatus />
      <header className={ui("topbar avenue-topbar")}>
        <a href="/" className={ui("brand avenue-brand")}>
          <CelestialLogo className={ui("avenue-brand-logo")} />
          <span>Celestial</span>
        </a>

        <nav className={ui("nav")} aria-label="Main navigation">
          {[["/explore", "Explore"], ["/analytics", "Analytics"], ["/portfolio", "Portfolio"]].map(([href, label]) =>
            <Link key={href} href={href} aria-current={path === href || (href === "/explore" && (path === "/" || path.startsWith("/token"))) ? "page" : undefined}>{label}</Link>
          )}
          <Link href="/create" aria-current={path === "/create" ? "page" : undefined}>Create</Link>
        </nav>

        <div className={ui("avenue-header-search")}>
          <SearchPalette />
        </div>

        <div className={ui("header-actions avenue-header-actions")}>
          <a className={ui("network-chip")} href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">
            <span className={ui("status-dot")} /> Arc Testnet
          </a>
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
    </>
  );
}
