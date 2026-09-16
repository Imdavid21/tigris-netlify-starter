import { AppHeader } from "@/components/app-header";
import { Launches } from "@/components/launches";
import { SiteFooter } from "@/components/site-footer";

export default function ExplorePage() {
  return (
    <main className="app-shell explore-page avenue-shell">
      <AppHeader />

      <section className="avenue-hero">
        <div className="avenue-hero-copy">
          <span className="avenue-eyebrow">Built on Arc</span>
          <h1>Launch markets.<br />Trade from day one.</h1>
          <p>
            Create tokens, trade bonding-curve markets, manage limit orders, and follow launches through graduation from one interface.
          </p>

          <div className="avenue-hero-actions">
            <a href="/create" className="primary-link">Launch a token</a>
            <a href="#live-markets" className="secondary-link">Explore markets</a>
          </div>

          <div className="avenue-supported">
            <span className="avenue-supported-label">Supported quote assets</span>
            <div className="avenue-asset-row">
              <div className="avenue-asset"><span>U</span><small>USDC</small></div>
              <div className="avenue-asset"><span>€</span><small>EURC</small></div>
              <div className="avenue-asset"><span>₿</span><small>cirBTC</small></div>
              <div className="avenue-asset"><span>◎</span><small>Arc</small></div>
            </div>
          </div>
        </div>

        <div className="avenue-card-stage" aria-hidden="true">
          <div className="avenue-project-card avenue-project-card-left">
            <div className="avenue-card-art avenue-art-left"><span>01</span></div>
            <div className="avenue-card-caption"><strong>Permissionless</strong><small>Launch</small></div>
          </div>

          <div className="avenue-project-card avenue-project-card-right">
            <div className="avenue-card-art avenue-art-right"><span>03</span></div>
            <div className="avenue-card-caption"><strong>Onchain</strong><small>Graduate</small></div>
          </div>

          <div className="avenue-project-card avenue-project-card-main">
            <div className="avenue-card-topline"><span>Celestial market</span><b>LIVE</b></div>
            <div className="avenue-card-art avenue-art-main">
              <div className="avenue-orbit-mark">✦</div>
            </div>
            <div className="avenue-card-stats">
              <div><strong>Bonding curve</strong><small>Price discovery</small></div>
              <div><strong>Limit orders</strong><small>Native execution</small></div>
            </div>
          </div>
        </div>
      </section>

      <section id="live-markets" className="avenue-market-heading">
        <div>
          <span>Markets</span>
          <h2>Live projects</h2>
        </div>
        <a href="/analytics">View protocol data</a>
      </section>

      <Launches />
      <SiteFooter />
    </main>
  );
}
