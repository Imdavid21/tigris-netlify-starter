
import { ui } from "@/styles/ui";
import { CelestialLogo } from "./celestial-logo";
export function SiteFooter() {
  return (
    <footer className={ui("site-footer")}>
      <div className={ui("footer-brand")}>
        <a href="/" className={ui("brand footer-logo")}><CelestialLogo /><span>Celestial</span></a>
        <p>Launch and trade onchain markets on Arc. Your wallet submits every transaction. Celestial does not custody assets.</p>
      </div>
      <div className={ui("footer-column")}>
        <strong>Product</strong>
        <a href="/explore">Explore</a>
        <a href="/analytics">Analytics</a>
        <a href="/create">Create</a>
        <a href="/portfolio">Portfolio</a>
      </div>
      <div className={ui("footer-column")}>
        <strong>Network</strong>
        <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Explorer</a>
        <a href="/analytics">Protocol data</a>
      </div>
      <div className={ui("footer-risk")}>
        <strong>Risk notice</strong>
        <p>Transactions are irreversible. Tokens and markets can be volatile or lose all value. Celestial does not provide custody, warranties, or financial advice.</p>
      </div>
      <div className={ui("footer-bottom")}>
        <span>Celestial</span>
        <span>Arc Testnet</span>
      </div>
    </footer>
  );
}
