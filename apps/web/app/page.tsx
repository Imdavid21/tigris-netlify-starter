import { AppHeader } from "@/components/app-header";

const features = [
  ["Launch with real market structure", "Configure quote asset, creator economics, holder rewards, opening protection, and an optional developer buy in one flow."],
  ["Trade before and after graduation", "Bonding-curve markets, limit orders, position controls, and a permanent route that stays with the token as liquidity graduates."],
  ["Keep the economics onchain", "Pricing, balances, launch terms, rewards, and execution remain contract-authoritative. Indexing improves speed without becoming a trust dependency."],
  ["Built for creators and holders", "Creator fee claims, holder fee sharing, buyback and burn mechanics, market analytics, and profile-level position management."]
];

const steps = [
  ["01", "Create", "Set token metadata, quote asset, economics, and launch protection."],
  ["02", "Open", "Launch atomically with an optional first buy and transparent immutable terms."],
  ["03", "Trade", "Use market or limit orders with live quotes and position controls."],
  ["04", "Graduate", "Move from the curve into locked DEX liquidity when the market is ready."]
];

export default function Home() {
  return (
    <main className="app-shell marketing-shell">
      <AppHeader />

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <div className="hero-status"><span className="status-dot" /> Built on Arc</div>
          <h1>Launch markets.<br />Not just tokens.</h1>
          <p>
            Celestial is an Arc-native launchpad and trading terminal for creating,
            trading, and graduating onchain markets.
          </p>
          <div className="marketing-actions">
            <a className="primary-link marketing-primary" href="/explore">Explore markets</a>
            <a className="secondary-link" href="/create">Launch a token</a>
          </div>
        </div>

        <div className="terminal-preview" aria-label="Celestial market terminal preview">
          <div className="terminal-preview-head">
            <div>
              <span>CELESTIAL / USDC</span>
              <strong>$0.00642</strong>
            </div>
            <span className="phase-pill">Curve live</span>
          </div>
          <div className="terminal-chart">
            <svg viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Market chart preview">
              <path className="preview-grid" d="M0 45H600M0 110H600M0 175H600" />
              <path className="preview-area" d="M0 185 C70 175 100 160 145 166 C205 175 230 116 286 128 C348 142 378 78 430 92 C485 106 525 42 600 54 L600 220 L0 220Z" />
              <path className="preview-line" d="M0 185 C70 175 100 160 145 166 C205 175 230 116 286 128 C348 142 378 78 430 92 C485 106 525 42 600 54" />
            </svg>
          </div>
          <div className="terminal-preview-stats">
            <div><span>Volume</span><strong>$184.2K</strong></div>
            <div><span>Holders</span><strong>842</strong></div>
            <div><span>Progress</span><strong>71%</strong></div>
          </div>
          <div className="terminal-preview-actions">
            <span>Market</span><span>Limit</span><strong>Buy</strong><span>Sell</span>
          </div>
        </div>
      </section>

      <section className="marketing-strip">
        <span>USDC</span><span>EURC</span><span>cirBTC</span>
        <span>Atomic launch</span><span>Limit orders</span><span>Holder rewards</span>
      </section>

      <section className="marketing-section">
        <div className="marketing-section-head">
          <h2>A launchpad that behaves like a market terminal.</h2>
          <p>Everything important stays visible, tradable, and recoverable from the same product surface.</p>
        </div>
        <div className="marketing-feature-grid">
          {features.map(([title, copy]) => (
            <article className="marketing-feature" key={title}>
              <div className="feature-mark">✦</div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-flow">
        <div className="marketing-section-head">
          <h2>From idea to liquid market.</h2>
          <p>One lifecycle. One token route. No separate creator dashboard maze.</p>
        </div>
        <div className="flow-grid">
          {steps.map(([n, title, copy]) => (
            <article className="flow-step" key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="protocol-block">
        <div>
          <h2>Designed around onchain truth.</h2>
          <p>
            Contracts are authoritative for execution, pricing, balances, phase, and economic terms.
            Celestial&apos;s API and indexer make discovery and analytics faster without making markets dependent on a backend.
          </p>
        </div>
        <div className="protocol-points">
          <span>Non-custodial execution</span>
          <span>Bounded creator economics</span>
          <span>Locked graduation liquidity</span>
          <span>Multi-asset fee accounting</span>
        </div>
      </section>

      <section className="marketing-cta">
        <h2>Find the next market before everyone else.</h2>
        <div className="marketing-actions">
          <a className="primary-link marketing-primary" href="/explore">Explore Celestial</a>
          <a className="secondary-link" href="/create">Create a market</a>
        </div>
      </section>
    </main>
  );
}
