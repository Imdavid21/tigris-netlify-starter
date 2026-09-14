import { CelestialLogo } from "@/components/celestial-logo";

export function BrandFooter() {
  return (
    <footer className="brand-footer">
      <div className="brand-footer-main">
        <div className="footer-brand">
          <CelestialLogo className="footer-logo" />
          <div>
            <strong>Celestial</strong>
            <span>Markets in orbit on Arc.</span>
          </div>
        </div>

        <div className="footer-links">
          <a href="/">Explore</a>
          <a href="/create">Create</a>
          <a href="/analytics">Analytics</a>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Explorer</a>
        </div>
      </div>

      <div className="footer-risk">
        Celestial is a non-custodial interface. Onchain markets can be volatile and transactions may be irreversible.
      </div>
    </footer>
  );
}
