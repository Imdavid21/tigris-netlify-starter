import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProtocolStatus } from "@/components/protocol-status";

export function AppHeader() {
  return (
    <>
      <ProtocolStatus />
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark">✦</span>
          <span>Celestial</span>
        </a>
        <nav className="nav">
          <a href="/explore">Discover</a>
          <a href="/trade">Trade</a>
          <a href="/create">Launch</a>
          <a href="/portfolio">Portfolio</a>
        </nav>
        <div className="header-actions">
          <SearchPalette />
          <ThemeToggle />
          <a className="network-chip" href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">
            <span className="status-dot" /> Arc Testnet
          </a>
          <WalletButton />
        </div>
      </header>
    </>
  );
}
