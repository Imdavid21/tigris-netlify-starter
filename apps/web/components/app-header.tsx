import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProtocolStatus } from "@/components/protocol-status";
import { CelestialLogo } from "@/components/celestial-logo";

export function AppHeader() {
  return (
    <>
      <ProtocolStatus />
      <header className="topbar avenue-topbar">
        <a href="/" className="brand avenue-brand">
          <CelestialLogo className="avenue-brand-logo" />
          <span>Celestial</span>
        </a>

        <nav className="nav avenue-nav">
          <a href="/explore">Launchpad</a>
          <a href="/trade">Markets</a>
          <a href="/analytics">Analytics</a>
          <a href="/portfolio">Portfolio</a>
        </nav>

        <div className="avenue-header-search">
          <SearchPalette />
        </div>

        <div className="header-actions avenue-header-actions">
          <a className="network-chip" href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">
            <span className="status-dot" /> Arc Testnet
          </a>
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>
    </>
  );
}
