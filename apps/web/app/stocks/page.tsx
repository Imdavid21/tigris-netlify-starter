import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import styles from "./StocksPage.module.css";

const markets = [
  ["AAPL", "Apple", "Tokenized equity"],
  ["TSLA", "Tesla", "Tokenized equity"],
  ["SPCX", "SpaceX", "Private market"],
  ["EURC", "Euro Coin", "Stablecoin"],
  ["cirBTC", "Bitcoin", "Tokenized asset"]
];

export default function StocksPage() {
  return (
    <main className={styles.page}>
      <AppHeader />

      <div className={styles.canvas}>
        <div className={styles.head}>
          <h1>Stocks</h1>
          <span className={styles.previewPill}>Preview</span>
        </div>

        <div className={styles.notice}>
          <strong>Not live markets.</strong>
          <span>The current Arc factory is USDC-only. These cards preview discovery for future approved quote assets.</span>
        </div>

        <div className={styles.grid}>
          {markets.map(([ticker, name, type]) => (
            <article className={styles.card} key={ticker}>
              <div className={styles.art}>{ticker.slice(0, 2)}</div>
              <div className={styles.body}>
                <strong>{name}</strong>
                <span>{ticker} · {type}</span>
              </div>
              <div className={styles.cardFoot}>
                <span>Approved-asset UX</span>
                <span className={styles.chip}>Preview</span>
              </div>
            </article>
          ))}
        </div>

        <section className={styles.info}>
          <h2>Pair-level eligibility</h2>
          <p>Tokenized-equity pairs will show jurisdiction and execution eligibility before signature. Viewing a market and being eligible to trade it remain separate states.</p>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
