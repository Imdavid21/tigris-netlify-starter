import { WalletButton } from "@/components/wallet-button";
import { SearchPalette } from "@/components/search-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProtocolStatus } from "@/components/protocol-status";
import { CelestialLogo } from "@/components/celestial-logo";
import { MotionNav } from "@/components/motion-nav";
import styles from "./AppHeader.module.css";

const primaryItems = [
  { href: "/explore", label: "Explore" },
  { href: "/analytics", label: "Analytics" },
  { href: "/portfolio", label: "Portfolio" }
];

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

          <MotionNav items={primaryItems} className={styles.nav} ariaLabel="Primary navigation" />

          <div className={styles.search}>
            <SearchPalette />
          </div>

          <div className={styles.actions}>
            <nav className={styles.utilityNav} aria-label="Product actions">
              <a href="/create" className={styles.createLink}>Launch Token</a>
            </nav>
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>
    </>
  );
}
