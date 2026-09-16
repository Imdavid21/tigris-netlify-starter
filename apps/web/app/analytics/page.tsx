import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { API_URL } from "@/lib/api";
import styles from "./AnalyticsPage.module.css";

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
    return {
      stats: null,
      daily: null,
      buybacks: [],
      venues: [],
      arc: null,
      degraded: true,
      arcDegraded: true
    };
  }
}

export default async function AnalyticsPage() {
  const data = await loadData();

  return (
    <main className={`app-shell analytics-page ${styles.page}`}>
      <AppHeader />
      <AnalyticsDashboard {...data} />
      <SiteFooter />
    </main>
  );
}
