import { API_URL } from "@/lib/api";

async function loadStats() {
  try {
    const res = await fetch(API_URL + "/stats", { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  const stats = await loadStats();

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/" className="brand">Arc Launchpad</a>
        <nav className="nav">
          <a href="/">Explore</a>
          <a href="/analytics">Analytics</a>
          <a href="/create">Create</a>
        </nav>
      </header>

      <section className="page-heading">
        <h1>Protocol analytics</h1>
        <p>Indexed from Arc Testnet. Onchain contracts remain the source of truth.</p>
      </section>

      <section className="metric-grid">
        <div className="metric-card">
          <span>Launches</span>
          <strong>{stats?.launches ?? "—"}</strong>
        </div>
        <div className="metric-card">
          <span>Trades</span>
          <strong>{stats?.trades ?? "—"}</strong>
        </div>
        <div className="metric-card">
          <span>Graduated</span>
          <strong>{stats?.graduated ?? "—"}</strong>
        </div>
        <div className="metric-card">
          <span>Indexed volume</span>
          <strong>
            {stats
              ? "$" + (Number(stats.quote_volume) / 1e6).toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })
              : "—"}
          </strong>
        </div>
      </section>
    </main>
  );
}
