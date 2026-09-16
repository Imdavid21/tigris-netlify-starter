import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brandBlock}>
        <a href="/explore" className={styles.brand}>
          <span className={styles.brandMark}>✦</span>
          <span>Celestial</span>
        </a>
        <p>
          Non-custodial token launches and onchain markets on Arc. Your wallet signs every transaction.
        </p>
      </div>

      <div className={styles.column}>
        <strong>Product</strong>
        <a href="/explore">Explore</a>
        <a href="/analytics">Analytics</a>
        <a href="/create">Create</a>
        <a href="/portfolio">Portfolio</a>
      </div>

      <div className={styles.column}>
        <strong>Network</strong>
        <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Explorer</a>
        <a href="/scanner">Scanner</a>
      </div>

      <div className={styles.risk}>
        <strong>Risk</strong>
        <p>
          Transactions are irreversible. Token markets can be volatile and may lose all value.
        </p>
      </div>

      <div className={styles.bottom}>
        <span>© Celestial · Arc Testnet</span>
        <div className={styles.bottomLinks}>
          <a href="/analytics">Protocol data</a>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc</a>
        </div>
      </div>
    </footer>
  );
}
