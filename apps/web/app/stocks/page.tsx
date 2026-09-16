
import { ui } from "@/styles/ui";
import { SiteFooter } from "@/components/site-footer";
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
    <main className={ui("app-shell")}>
      <AppHeader />
      <section className={ui("page-heading compact")}>
        <h1>Stocks</h1>
        <p>A preview of future tokenized-asset discovery.</p>
      </section>

      <div className={ui("feature-notice")}>
        <strong>Preview mode</strong>
        <span>These are illustrative assets, not live markets. Explore shows the currently indexed Arc markets.</span>
      </div>

      <div className={ui("stocks-grid")}>
        {markets.map(([ticker,name,type]) => (
          <div className={ui("stock-card")} key={ticker}>
            <div className={ui("stock-symbol")}>{ticker.slice(0,2)}</div>
            <div><strong>{name}</strong><span>{ticker} · {type}</span></div>
            <span className={ui("coming-chip")}>Preview</span>
          </div>
        ))}
      </div>

      <section className={ui("jurisdiction-card")}>
        <h2>Pair-level restrictions, not hidden failures.</h2>
        <p>Tokenized-equity pairs will carry explicit jurisdiction eligibility before a user reaches the trade signature. Viewing remains separate from execution eligibility.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
