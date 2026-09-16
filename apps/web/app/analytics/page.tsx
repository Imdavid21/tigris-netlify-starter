import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { ArcActivityChart } from "@/components/arc-activity-chart";
import { FlowDiv, FlowSection } from "@/components/viewport-flow";
import { API_URL } from "@/lib/api";
import styles from "./AnalyticsPage.module.css";
import arcStyles from "./ArcAnalytics.module.css";

async function loadData() {
  try {
    const [statsRes, dailyRes, buybacksRes, venuesRes, arcRes] = await Promise.all([
      fetch(API_URL + "/stats", { cache: "no-store" }),
      fetch(API_URL + "/analytics/daily", { cache: "no-store" }),
      fetch(API_URL + "/buybacks", { cache: "no-store" }),
      fetch(API_URL + "/analytics/venues", { cache: "no-store" }),
      fetch(API_URL + "/arc/analytics/overview", { cache: "no-store" })
    ]);
    return {
      stats: statsRes.ok ? await statsRes.json() : null,
      daily: dailyRes.ok ? await dailyRes.json() : null,
      buybacks: buybacksRes.ok ? (await buybacksRes.json()).items ?? [] : [],
      venues: venuesRes.ok ? (await venuesRes.json()).items ?? [] : [],
      arc: await arcRes.json().catch(() => null),
      degraded: !statsRes.ok || !dailyRes.ok,
      arcDegraded: !arcRes.ok
    };
  } catch {
    return { stats: null, daily: null, buybacks: [], venues: [], arc: null, degraded: true, arcDegraded: true };
  }
}

function compact(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(number);
}

function blockTime(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const seconds = number > 100 ? number / 1000 : number;
  return `${seconds.toLocaleString(undefined, { maximumFractionDigits: 2 })}s`;
}

function percent(value: unknown, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(digits)}%` : "—";
}

function short(value?: string | null) {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function relativeTime(value?: string | null) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="analytics-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ArcMetric({ label, value }: { label: string; value: string }) {
  return <div className={arcStyles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

function Bars({ rows, keyName }: { rows: any[]; keyName: string }) {
  const values = rows.map((x) => Number(x[keyName] ?? 0));
  const max = Math.max(1, ...values);
  return (
    <div className="analytics-bars upgraded">
      {rows.length ? rows.map((row, i) => (
        <div key={String(row.day ?? i)} className="analytics-bar-col" title={String(row.day ?? "")}>
          <div className="analytics-bar" style={{ height: Math.max(5, (Number(row[keyName] ?? 0) / max) * 100) + "%" }} />
        </div>
      )) : <div className="analytics-empty">No indexed history yet.</div>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { stats, daily, buybacks, venues, arc, degraded, arcDegraded } = await loadData();
  const curveVenue = venues.find((item: any) => item.venue === "CURVE");
  const v4Venue = venues.find((item: any) => item.venue === "UNISWAP_V4");
  const explorer = arc?.explorerUrl ?? "https://explorer.arc.io";

  return (
    <main className={`app-shell analytics-page ${styles.page}`}>
      <AppHeader />

      <nav className={arcStyles.nav} aria-label="Analytics sections">
        <a href="#overview">Overview</a>
        <a href="#arc-network">Arc Network</a>
        <a href="#supershot">supershot.fun</a>
      </nav>

      <section id="overview" className={arcStyles.arcHero}>
        <div className={arcStyles.heroHead}>
          <div>
            <h1>Arc Analytics</h1>
            <p>Network activity, blocks, transactions, and Supershot usage on Arc Mainnet.</p>
          </div>
          <span className={arcStyles.livePill}>Arc Mainnet · 5042</span>
        </div>

        {!arcDegraded && arc?.stats ? (
          <>
            <div className={arcStyles.networkGrid}>
              <ArcMetric label="Transactions today" value={compact(arc.stats.transactionsToday)} />
              <ArcMetric label="Total transactions" value={compact(arc.stats.totalTransactions)} />
              <ArcMetric label="Total blocks" value={compact(arc.stats.totalBlocks)} />
              <ArcMetric label="Addresses" value={compact(arc.stats.totalAddresses)} />
              <ArcMetric label="Avg block time" value={blockTime(arc.stats.averageBlockTimeMs)} />
              <ArcMetric label="Network utilization" value={percent(arc.stats.networkUtilizationPct)} />
            </div>
            <p className={arcStyles.sourceNote}>Source: Blockscout · refreshed {relativeTime(arc.fetchedAt)} · deep links open explorer.arc.io.</p>
          </>
        ) : (
          <div className={arcStyles.setup}>
            <strong>Arc network data is waiting for Blockscout API access.</strong>
            <p>{arc?.error ?? "Configure the server-side Blockscout key to activate Arc-wide analytics."}</p>
            <code>BLOCKSCOUT_API_KEY=your_key</code>
          </div>
        )}
      </section>

      {!arcDegraded && arc?.activity?.length > 0 && (
        <section id="arc-network" className={arcStyles.chartSection}>
          <ArcActivityChart points={arc.activity} />
        </section>
      )}

      {!arcDegraded && arc && (
        <>
          <section className={arcStyles.section}>
            <div className={arcStyles.sectionHead}>
              <div><h2>supershot.fun on Arc</h2><p>Protocol activity compared with Arc network activity.</p></div>
              <a className={arcStyles.explorerLink} href={explorer} target="_blank" rel="noreferrer">Open Arc Explorer ↗</a>
            </div>
            <div className={arcStyles.compareGrid}>
              <ArcMetric label="Supershot trades · 24h" value={compact(arc.supershot?.trades24h)} />
              <ArcMetric label="Active traders · 24h" value={compact(arc.supershot?.traders24h)} />
              <ArcMetric label="Launches · 24h" value={compact(arc.supershot?.launches24h)} />
              <ArcMetric label="Trade share of Arc tx" value={percent(arc.supershot?.tradeShareOfArcTransactionsPct, 2)} />
            </div>
            <p className={arcStyles.sourceNote}>{arc.supershot?.shareDefinition}</p>
          </section>

          <section className={arcStyles.tables}>
            <div className={arcStyles.tableCard}>
              <div className={arcStyles.tableHead}><h2>Latest blocks</h2><p>Recent Arc Mainnet blocks indexed by Blockscout.</p></div>
              <div className={arcStyles.rows}>
                {(arc.blocks ?? []).slice(0, 8).map((block: any) => (
                  <a key={String(block.hash ?? block.number)} className={arcStyles.row} href={`${explorer}/block/${block.number}`} target="_blank" rel="noreferrer">
                    <div><strong>Block {compact(block.number)}</strong><span>{short(block.miner)}</span></div>
                    <span>{compact(block.transactions)} tx · {relativeTime(block.timestamp)}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className={arcStyles.tableCard}>
              <div className={arcStyles.tableHead}><h2>Latest transactions</h2><p>Recent network activity with explorer deep links.</p></div>
              <div className={arcStyles.rows}>
                {(arc.transactions ?? []).slice(0, 10).map((tx: any) => (
                  <a key={String(tx.hash)} className={arcStyles.row} href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                    <div><strong>{tx.method || "Transaction"}</strong><span>{short(tx.hash)} · {short(tx.from)} → {short(tx.to)}</span></div>
                    <span>{relativeTime(tx.timestamp)}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <div id="supershot" />
      {degraded && (
        <FlowDiv className="system-notice analytics-notice">
          <strong>Supershot analytics degraded</strong>
          <span>Indexed protocol data may be delayed. Market execution remains contract-native.</span>
        </FlowDiv>
      )}

      <FlowSection className="analytics-hero-card">
        <div className="analytics-title-row">
          <div><h1>supershot.fun analytics</h1><p>Indexed onchain reporting for Supershot markets on Arc.</p></div>
          <div className="analytics-actions"><span className="phase-pill">Live index</span><a className="secondary-link compact-link" href="/explore">View markets</a></div>
        </div>
        <div className="analytics-kpi-grid">
          <Metric label="24h trades" value={String(daily?.volume?.at(-1)?.trades ?? stats?.traders_24h ?? "—")} />
          <Metric label="24h launches" value={String(stats?.launches_24h ?? "—")} />
          <Metric label="Unique creators" value={String(stats?.unique_creators ?? "—")} note="Lifetime indexed" />
        </div>
        <p className="analytics-source-note">Values are derived from indexed onchain activity. Multi-asset markets are not combined into a fake USD total where conversion data is unavailable.</p>
      </FlowSection>

      <FlowSection className="analytics-panel" delay={0.03}>
        <div className="analytics-panel-head"><div><h2>Protocol activity</h2><p>Market creation, trading, graduation, and order activity.</p></div></div>
        <div className="analytics-kpi-grid analytics-kpi-grid-four">
          <Metric label="Unique traders" value={String(stats?.unique_traders ?? "—")} />
          <Metric label="Launches" value={String(stats?.launches ?? "—")} />
          <Metric label="Graduated" value={String(stats?.graduated ?? "—")} />
          <Metric label="Trades" value={String(stats?.trades ?? "—")} />
          <Metric label="24h traders" value={String(stats?.traders_24h ?? "—")} />
          <Metric label="Open orders" value={String(stats?.open_orders ?? "—")} />
          <Metric label="Buyback executions" value={String(stats?.buyback_count ?? "—")} />
          <Metric label="Post-grad trades" value={String(stats?.post_graduation_trades ?? "—")} />
          <Metric label="Post-grad markets" value={String(stats?.post_graduation_markets ?? "—")} />
        </div>
      </FlowSection>

      <FlowSection className="analytics-panel" delay={0.05}>
        <div className="analytics-panel-head"><div><h2>Trading venues</h2><p>Supershot keeps one market page while execution moves from the bonding curve to Uniswap v4 after graduation.</p></div></div>
        <div className="analytics-kpi-grid analytics-kpi-grid-four">
          <Metric label="Curve trades" value={String(curveVenue?.trades ?? "—")} />
          <Metric label="Curve traders" value={String(curveVenue?.traders ?? "—")} />
          <Metric label="Uniswap v4 trades" value={String(v4Venue?.trades ?? "—")} />
          <Metric label="Uniswap v4 markets" value={String(v4Venue?.markets ?? "—")} />
        </div>
      </FlowSection>

      <FlowSection className="analytics-panel" delay={0.07}>
        <div className="analytics-panel-head"><div><h2>Buyback and burn</h2><p>Protocol-funded executions indexed from the Supershot buyback vault.</p></div><strong>{stats?.buyback_count ?? "—"} executions</strong></div>
        {!buybacks.length ? <div className="analytics-empty-block">No buyback executions have been indexed yet.</div> : (
          <div className="buyback-table">{buybacks.slice(0, 8).map((item: any) => (
            <a href={"/token/" + item.token} className="buyback-row" key={item.tx_hash}>
              <div><strong>{item.post_graduation ? "DEX buyback" : "Curve buyback"}</strong><span>{item.token.slice(0, 8)}...{item.token.slice(-6)}</span></div>
              <div><span>Quote spent</span><strong>{item.quote_spent}</strong></div>
              <div><span>Tokens burned</span><strong>{item.tokens_burned}</strong></div>
            </a>
          ))}</div>
        )}
      </FlowSection>

      <FlowSection className="analytics-chart-grid" delay={0.09}>
        <div className="analytics-panel chart-panel"><div className="analytics-panel-head"><div><h2>Trading activity</h2><p>Recent daily indexed trades.</p></div><strong>{String(daily?.volume?.at(-1)?.trades ?? "—")}</strong></div><Bars rows={daily?.volume ?? []} keyName="trades" /></div>
        <div className="analytics-panel chart-panel"><div className="analytics-panel-head"><div><h2>Token launches</h2><p>Recent daily market creation.</p></div><strong>{stats?.launches_24h ?? "—"}</strong></div><Bars rows={daily?.launches ?? []} keyName="launches" /></div>
      </FlowSection>

      <SiteFooter />
    </main>
  );
}
