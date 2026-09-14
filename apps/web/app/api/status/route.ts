import { NextResponse } from "next/server";

const api = process.env.NEXT_PUBLIC_API_URL ?? "https://arc-launchpad-api.onrender.com";
const indexer = process.env.NEXT_PUBLIC_INDEXER_URL ?? "https://arc-launchpad-indexer.onrender.com";

async function check(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false };
  }
}

export async function GET() {
  const [apiHealth, indexerHealth] = await Promise.all([
    check(api + "/health"),
    check(indexer + "/health")
  ]);

  const ingestion = (indexerHealth as any)?.body?.ingestion;
  const degraded = !apiHealth.ok || !indexerHealth.ok || (ingestion && ingestion !== "live");

  return NextResponse.json({
    ok: !degraded,
    degraded,
    api: apiHealth.ok,
    indexer: indexerHealth.ok,
    ingestion: ingestion ?? (indexerHealth.ok ? "unknown" : "offline")
  });
}
