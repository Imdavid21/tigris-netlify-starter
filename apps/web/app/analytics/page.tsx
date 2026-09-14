import { AppHeader } from "@/components/app-header";
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
      buybacks: buybacksRes.ok ? (await buybacksRes.json()).items ?? [] : []
    };
  } catch {
    return { stats: null, daily: null, buybacks: [] };
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
  const { stats, daily, buybacks } = await loadData();
  const volume = stats ? Number(stats.quote_volume) / 1e6 : null;
  const volume24h = stats ? Number(stats.quote_volume_24h) / 1e6 : null;
  const fees = stats ? Number(stats.fees) / 1e6 : null;

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="page-heading compact">
        <h1>What is happening on Arc.</h1>
        <p>Indexed onchain activity. Execution and critical market state remain contract-native.</p>
      </section>

      <section className="metric-grid">
        <div className="metric-card"><span>All-time volume</span><strong>{volume === null ? "—" : "$" + volume.toLocaleString(undefined,{maximumFractionDigits:0})}</strong></div>
        <div className="metric-card"><span>24h volume</span><strong>{volume24h === null ? "—" : "$" + volume24h.toLocaleString(undefined,{maximumFractionDigits:0})}</strong></div>
        <div className="metric-card"><span>Launches</span><strong>{stats?.launches ?? "—"}</strong></div>
        <div className="metric-card"><span>Graduated</span><strong>{stats?.graduated ?? "—"}</strong></div>
        <div className="metric-card"><span>Trades</span><strong>{stats?.trades ?? "—"}</strong></div>
        <div className="metric-card"><span>24h traders</span><strong>{stats?.traders_24h ?? "—"}</strong></div>
        <div className="metric-card"><span>Open orders</span><strong>{stats?.open_orders ?? "—"}</strong></div>
        <div className="metric-card"><span>Buyback executions</span><strong>{stats?.buyback_count ?? "—"}</strong></div>
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
        <div style={{width:"100%"}}>
          <div className="section-title"><strong>Buyback and burn</strong><span>Protocol-funded executions</span></div>
          {!buybacks.length ? (
            <p>No buybacks have been indexed yet.</p>
          ) : (
            <div className="profile-table" style={{marginTop:12}}>
              {buybacks.slice(0,20).map((item:any)=>(
                <a href={"/token/"+item.token} className="profile-row" key={item.tx_hash}>
                  <div>
                    <strong>{item.post_graduation ? "DEX buyback" : "Curve buyback"}</strong>
                    <span>{item.token.slice(0,8)}...{item.token.slice(-6)}</span>
                  </div>
                  <span>{item.quote_spent} quote units</span>
                  <span>{item.tokens_burned} token units burned</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {fees !== null && (
        <p className="terminal-footnote">
          {"Indexed trade fees: $" + fees.toLocaleString(undefined,{maximumFractionDigits:2}) + ". Buyback amounts are displayed per execution because Celestial can use multiple quote assets."}
        </p>
      )}
    </main>
  );
}
