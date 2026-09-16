import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProtocolStatus } from "@/components/protocol-status";
import { CelestialLogo } from "@/components/celestial-logo";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <>
      <div className={styles.statusWrap}>
        <ProtocolStatus />
      </div>

      <header className={styles.header}>
        <div className={styles.inner}>
          <a href="/explore" className={styles.brand} aria-label="Celestial Explore">
            <CelestialLogo className={styles.logo} />
            <span>Celestial</span>
          </a>

          <nav className={styles.nav} aria-label="Primary navigation">
            <a href="/explore">Explore</a>
            <a href="/analytics">Analytics</a>
            <a href="/portfolio">Portfolio</a>
          </nav>

          <div className={styles.search}>
            <SearchPalette />
          </div>

          <div className={styles.actions}>
            <nav className={styles.utilityNav} aria-label="Product actions">
              <a href="/create" className={styles.createLink}>Create</a>
            </nav>
            <a
              className={styles.network}
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noreferrer"
            >
              <span className={styles.dot} /> Arc Testnet
            </a>
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>
    </>
  );
}
