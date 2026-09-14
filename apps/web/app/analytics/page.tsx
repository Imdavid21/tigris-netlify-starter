import { AppHeader } from "@/components/app-header";
import { API_URL } from "@/lib/api";

async function loadData() {
  try {
    const [statsRes, dailyRes] = await Promise.all([
      fetch(API_URL + "/stats", { cache: "no-store" }),
      fetch(API_URL + "/analytics/daily", { cache: "no-store" })
    ]);
    return {
      stats: statsRes.ok ? await statsRes.json() : null,
      daily: dailyRes.ok ? await dailyRes.json() : null
    };
  } catch {
    return { stats: null, daily: null };
  }
}

function Bars({ rows, keyName }: { rows: any[]; keyName: string }) {
  const values = rows.map((x) => Number(x[keyName] ?? 0));
  const max = Math.max(1, ...values);
  return (
    <div className="analytics-bars">
      {rows.length ? rows.map((row, i) => (
        <div key={String(row.day ?? i)} className="analytics-bar-col">
          <div className="analytics-bar" style={{ height: Math.max(4, (Number(row[keyName] ?? 0) / max) * 100) + "%" }} />
        </div>
      )) : <div className="analytics-empty">No indexed history yet.</div>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const { stats, daily } = await loadData();

  const volume = stats ? Number(stats.quote_volume) / 1e6 : null;
  const volume24h = stats ? Number(stats.quote_volume_24h) / 1e6 : null;
  const fees = stats ? Number(stats.fees) / 1e6 : null;

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>Celestial, by the numbers.</h1>
        <p>Live market activity indexed from Arc. Execution remains onchain.</p>
      </section>

      <section className="metric-grid">
        <div className="metric-card"><span>All-time volume</span><strong>{volume === null ? "—" : "$" + volume.toLocaleString(undefined,{maximumFractionDigits:0})}</strong></div>
        <div className="metric-card"><span>24h volume</span><strong>{volume24h === null ? "—" : "$" + volume24h.toLocaleString(undefined,{maximumFractionDigits:0})}</strong></div>
        <div className="metric-card"><span>Launches</span><strong>{stats?.launches ?? "—"}</strong></div>
        <div className="metric-card"><span>Graduated</span><strong>{stats?.graduated ?? "—"}</strong></div>
        <div className="metric-card"><span>Trades</span><strong>{stats?.trades ?? "—"}</strong></div>
        <div className="metric-card"><span>24h traders</span><strong>{stats?.traders_24h ?? "—"}</strong></div>
        <div className="metric-card"><span>24h launches</span><strong>{stats?.launches_24h ?? "—"}</strong></div>
        <div className="metric-card"><span>Indexed fees</span><strong>{fees === null ? "—" : "$" + fees.toLocaleString(undefined,{maximumFractionDigits:2})}</strong></div>
      </section>

      <section className="analytics-grid">
        <div className="analytics-card">
          <div className="section-title"><strong>Trading volume</strong><span>30 days</span></div>
          <Bars rows={daily?.volume ?? []} keyName="volume" />
        </div>
        <div className="analytics-card">
          <div className="section-title"><strong>Token launches</strong><span>30 days</span></div>
          <Bars rows={daily?.launches ?? []} keyName="launches" />
        </div>
      </section>

      <section className="analytics-card buyback-preview">
        <div>
          <h2>Buyback and burn</h2>
          <p>Protocol fee recycling will appear here when an explicit buyback vault and policy are live.</p>
        </div>
        
      </section>
    </main>
  );
}
