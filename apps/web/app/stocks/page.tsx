import { AppHeader } from "@/components/app-header";

const markets = [
  ["AAPL", "Apple", "Tokenized equity"],
  ["TSLA", "Tesla", "Tokenized equity"],
  ["SPCX", "SpaceX", "Private market"],
  ["EURC", "Euro Coin", "Stablecoin"],
  ["cirBTC", "Bitcoin", "Tokenized asset"]
];

export default function StocksPage() {
  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <span className="kicker">Multi-asset markets · V2</span>
        <h1>Launch against more than USDC.</h1>
        <p>PONS-style paired-asset markets, designed for Arc's eventual approved quote-asset registry.</p>
      </section>

      <div className="feature-notice">
        <strong>Preview mode</strong>
        <span>The current Arc factory is USDC-only. These markets show the intended V2 discovery and compliance UX.</span>
      </div>

      <div className="stocks-grid">
        {markets.map(([ticker,name,type]) => (
          <div className="stock-card" key={ticker}>
            <div className="stock-symbol">{ticker.slice(0,2)}</div>
            <div><strong>{name}</strong><span>{ticker} · {type}</span></div>
            <span className="coming-chip">V2 pair</span>
          </div>
        ))}
      </div>

      <section className="jurisdiction-card">
        <span className="kicker">Market access</span>
        <h2>Pair-level restrictions, not hidden failures.</h2>
        <p>Tokenized-equity pairs will carry explicit jurisdiction eligibility before a user reaches the trade signature. Viewing remains separate from execution eligibility.</p>
      </section>
    </main>
  );
}
