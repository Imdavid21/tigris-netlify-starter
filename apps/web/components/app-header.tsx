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
        <div className={styles.topRow}>
          <div className={styles.leftCluster}>
            <a href="/explore" className={styles.brand} aria-label="Celestial Explore">
              <CelestialLogo className={styles.logo} />
              <span>Celestial</span>
            </a>

            <MotionNav items={primaryItems} className={styles.nav} ariaLabel="Primary navigation" />
          </div>

          <div className={styles.actions}>
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>

        <div className={styles.searchBand}>
          <div className={styles.searchRow}>
            <div className={styles.search}>
              <SearchPalette />
            </div>
            <a href="/create" className={styles.createLink}>
              <span aria-hidden="true">＋</span>
              Launch Token
            </a>
          </div>
        </div>
      </header>
    </>
  );
}
