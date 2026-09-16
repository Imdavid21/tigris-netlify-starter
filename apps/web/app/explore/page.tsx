import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";

export default function ExplorePage() {
  return (
    <main className="app-shell explore-page utopia-app-shell">
      <AppHeader />

      <section className="utopia-app-hero">
        <div className="utopia-app-hero-topline">
          <span>CELESTIAL / ARC</span>
          <span>MARKET TERMINAL</span>
          <span>LIVE</span>
        </div>

        <div className="utopia-app-hero-grid">
          <div className="utopia-app-hero-copy">
            <div className="utopia-app-kicker">BUILT ON ARC</div>
            <h1>
              <span>LAUNCH.</span>
              <span>TRADE.</span>
              <span>GRADUATE.</span>
            </h1>
            <p>
              Permissionless token markets with bonding-curve execution, limit orders,
              holder rewards, and onchain graduation.
            </p>
            <div className="utopia-app-actions">
              <a href="/create" className="utopia-app-primary">LAUNCH MARKET</a>
              <a href="#live-markets" className="utopia-app-secondary">EXPLORE MARKETS</a>
            </div>
          </div>

          <div className="utopia-app-hero-art" aria-hidden="true">
            <div className="utopia-app-hero-number">01</div>
            <div className="utopia-app-hero-symbol">市<br />場</div>
            <div className="utopia-app-hero-orbit"><span /><span /><span /></div>
            <div className="utopia-app-hero-caption">ARC TESTNET / NON-CUSTODIAL / LIVE MARKETS</div>
          </div>
        </div>

        <div className="utopia-app-assets">
          <span>SUPPORTED QUOTE ASSETS</span>
          <div><b>USDC</b><b>EURC</b><b>cirBTC</b></div>
        </div>
      </section>

      <section id="live-markets" className="utopia-app-market-intro">
        <div>
          <span>02 / DISCOVER</span>
          <h2>EXPLORE<br />MARKETS</h2>
        </div>
        <div className="utopia-app-market-copy">
          <p>Live markets are read from the indexer, while execution and market state remain contract-authoritative.</p>
          <a href="/analytics">VIEW PROTOCOL DATA ↗</a>
        </div>
        <div className="utopia-app-side-type" aria-hidden="true">天体市場</div>
      </section>

      <Launches />
      <SiteFooter />
    </main>
  );
}
