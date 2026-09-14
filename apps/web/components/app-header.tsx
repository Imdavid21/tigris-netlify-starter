import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="topbar">
      <a href="/" className="brand">
        <span className="brand-mark">✦</span>
        <span>Celestial</span>
      </a>
      <nav className="nav">
        <a href="/">Explore</a>
        <a href="/stocks">Stocks</a>
        <a href="/create">Create</a>
        <a href="/analytics">Analytics</a>
        <a href="/profile">Profile</a>
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
  );
}
