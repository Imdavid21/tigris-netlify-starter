import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { API_URL } from "@/lib/api";

async function loadData() {
  try {
    const [statsRes, dailyRes, buybacksRes] = await Promise.all([
      fetch(API_URL + "/stats", { cache: "no-store" }),
      fetch(API_URL + "/analytics/daily", { cache: "no-store" }),
      fetch(API_URL + "/buybacks", { cache: "no-store" })
    ]);
    return {
      stats: statsRes.ok ? await statsRes.json() : null,
      daily: dailyRes.ok ? await dailyRes.json() : null,
      buybacks: buybacksRes.ok ? (await buybacksRes.json()).items ?? [] : [],
      degraded: !statsRes.ok || !dailyRes.ok
    };
  } catch {
    return { stats: null, daily: null, buybacks: [], degraded: true };
  }
}

function compact(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + "B";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="analytics-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { stats, daily, buybacks, degraded } = await loadData();

  return (
    <main className="app-shell analytics-page">
      <AppHeader />

      {degraded && (
        <div className="system-notice analytics-notice">
          <strong>Analytics degraded</strong>
          <span>Indexed data may be delayed. Market execution remains contract-native.</span>
        </div>
      )}

      <section className="analytics-hero-card">
        <div className="analytics-title-row">
          <div>
            <h1>Protocol analytics</h1>
            <p>Indexed onchain reporting for Celestial markets on Arc.</p>
          </div>
          <div className="analytics-actions">
            <span className="phase-pill">Live index</span>
            <a className="secondary-link compact-link" href="/explore">View markets</a>
          </div>
        </div>

        <div className="analytics-kpi-grid">
          <Metric label="24h trades" value={String(daily?.volume?.at(-1)?.trades ?? stats?.traders_24h ?? "—")} />
          <Metric label="24h launches" value={String(stats?.launches_24h ?? "—")} />
          <Metric label="Unique creators" value={String(stats?.unique_creators ?? "—")} note="Lifetime indexed" />
        </div>
        <p className="analytics-source-note">Values are derived from indexed onchain activity. Multi-asset markets are not combined into a fake USD total where conversion data is unavailable.</p>
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-head">
          <div>
            <h2>Protocol activity</h2>
            <p>Market creation, trading, graduation, and order activity.</p>
          </div>
        </div>
        <div className="analytics-kpi-grid analytics-kpi-grid-four">
          <Metric label="Unique traders" value={String(stats?.unique_traders ?? "—")} />
          <Metric label="Launches" value={String(stats?.launches ?? "—")} />
          <Metric label="Graduated" value={String(stats?.graduated ?? "—")} />
          <Metric label="Trades" value={String(stats?.trades ?? "—")} />
          <Metric label="24h traders" value={String(stats?.traders_24h ?? "—")} />
          <Metric label="Open orders" value={String(stats?.open_orders ?? "—")} />
          <Metric label="Buyback executions" value={String(stats?.buyback_count ?? "—")} />
        </div>
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-head">
          <div>
            <h2>Buyback and burn</h2>
            <p>Protocol-funded executions indexed from the Celestial buyback vault.</p>
          </div>
          <strong>{stats?.buyback_count ?? "—"} executions</strong>
        </div>

        {!buybacks.length ? (
          <div className="analytics-empty-block">No buyback executions have been indexed yet.</div>
        ) : (
          <div className="buyback-table">
            {buybacks.slice(0, 8).map((item: any) => (
              <a href={"/token/" + item.token} className="buyback-row" key={item.tx_hash}>
                <div>
                  <strong>{item.post_graduation ? "DEX buyback" : "Curve buyback"}</strong>
                  <span>{item.token.slice(0, 8)}...{item.token.slice(-6)}</span>
                </div>
                <div><span>Quote spent</span><strong>{item.quote_spent}</strong></div>
                <div><span>Tokens burned</span><strong>{item.tokens_burned}</strong></div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="analytics-chart-grid">
        <div className="analytics-panel chart-panel">
          <div className="analytics-panel-head">
            <div><h2>Trading activity</h2><p>Recent daily indexed trades.</p></div>
            <strong>{String(daily?.volume?.at(-1)?.trades ?? "—")}</strong>
          </div>
          <Bars rows={daily?.volume ?? []} keyName="trades" />
        </div>
        <div className="analytics-panel chart-panel">
          <div className="analytics-panel-head">
            <div><h2>Token launches</h2><p>Recent daily market creation.</p></div>
            <strong>{stats?.launches_24h ?? "—"}</strong>
          </div>
          <Bars rows={daily?.launches ?? []} keyName="launches" />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
