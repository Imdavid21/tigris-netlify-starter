import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const BLOCKSCOUT_API_BASE_URL = (process.env.BLOCKSCOUT_API_BASE_URL ?? "https://api.blockscout.com").replace(/\/+$/, "");
const BLOCKSCOUT_API_KEY = process.env.BLOCKSCOUT_API_KEY?.trim() ?? "";
const ARC_ANALYTICS_CHAIN_ID = process.env.ARC_ANALYTICS_CHAIN_ID?.trim() || "5042";
const ARC_EXPLORER_URL = (process.env.ARC_EXPLORER_URL ?? "https://explorer.arc.io").replace(/\/+$/, "");

const cache = new Map<string, { expiresAt: number; value: unknown }>();

type Json = Record<string, any>;

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function itemArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.chart_data)) return payload.chart_data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function blockscout(path: string, query: Record<string, string | number> = {}, ttlMs = 20_000) {
  if (!BLOCKSCOUT_API_KEY) throw new Error("BLOCKSCOUT_API_KEY is not configured");

  const cacheKey = `${path}?${JSON.stringify(query)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as Json;

  const url = new URL(`${BLOCKSCOUT_API_BASE_URL}/${ARC_ANALYTICS_CHAIN_ID}${path}`);
  url.searchParams.set("apikey", BLOCKSCOUT_API_KEY);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Blockscout request failed with ${response.status}`);
    const value = await response.json();
    cache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
    return value as Json;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStats(raw: Json) {
  const gasPrices = raw?.gas_prices ?? raw?.gasPrices ?? null;
  return {
    totalBlocks: asNumber(raw?.total_blocks ?? raw?.totalBlocks),
    totalTransactions: asNumber(raw?.total_transactions ?? raw?.totalTransactions),
    transactionsToday: asNumber(raw?.transactions_today ?? raw?.transactionsToday),
    totalAddresses: asNumber(raw?.total_addresses ?? raw?.totalAddresses),
    averageBlockTimeMs: asNumber(raw?.average_block_time ?? raw?.averageBlockTime),
    gasUsedToday: asNumber(raw?.gas_used_today ?? raw?.gasUsedToday),
    networkUtilizationPct: asNumber(raw?.network_utilization_percentage ?? raw?.networkUtilizationPercentage),
    coinPrice: asNumber(raw?.coin_price ?? raw?.coinPrice),
    gasPrices: gasPrices && typeof gasPrices === "object" ? {
      slow: asNumber(gasPrices.slow),
      average: asNumber(gasPrices.average),
      fast: asNumber(gasPrices.fast)
    } : null
  };
}

function normalizeActivity(raw: Json) {
  return itemArray(raw)
    .map((item) => ({
      date: asString(item?.date ?? item?.day ?? item?.timestamp),
      transactions: asNumber(item?.tx_count ?? item?.transactions ?? item?.count ?? item?.value)
    }))
    .filter((item) => item.date && item.transactions !== null)
    .slice(-180);
}

function normalizeBlocks(raw: Json) {
  return itemArray(raw).slice(0, 12).map((item) => ({
    number: asNumber(item?.height ?? item?.number),
    hash: asString(item?.hash),
    timestamp: asString(item?.timestamp),
    transactions: asNumber(item?.tx_count ?? item?.transactions_count ?? item?.transaction_count),
    gasUsed: asString(item?.gas_used),
    gasLimit: asString(item?.gas_limit),
    miner: asString(item?.miner?.hash ?? item?.miner)
  }));
}

function normalizeTransactions(raw: Json) {
  return itemArray(raw).slice(0, 14).map((item) => ({
    hash: asString(item?.hash),
    block: asNumber(item?.block ?? item?.block_number),
    timestamp: asString(item?.timestamp),
    status: asString(item?.status),
    method: asString(item?.method ?? item?.decoded_input?.method_call),
    from: asString(item?.from?.hash ?? item?.from),
    to: asString(item?.to?.hash ?? item?.to),
    fee: asString(item?.fee?.value ?? item?.fee)
  }));
}

async function loadArcStats() {
  return normalizeStats(await blockscout("/api/v2/stats", {}, 20_000));
}

async function loadArcActivity() {
  return normalizeActivity(await blockscout("/api/v2/stats/charts/transactions", {}, 5 * 60_000));
}

async function loadArcBlocks() {
  return normalizeBlocks(await blockscout("/api/v2/blocks", {}, 12_000));
}

async function loadArcTransactions() {
  return normalizeTransactions(await blockscout("/api/v2/transactions", {}, 12_000));
}

async function loadSupershotComparison(db: Pool, transactionsToday: number | null) {
  const result = await db.query(
    `select
      (select count(*)::int from trades where block_time > now() - interval '24 hours') as trades_24h,
      (select count(distinct trader)::int from trades where block_time > now() - interval '24 hours') as traders_24h,
      (select count(*)::int from tokens where created_at > now() - interval '24 hours') as launches_24h,
      (select count(*)::int from trades) as total_trades,
      (select count(*)::int from tokens) as total_launches`
  );
  const row = result.rows[0] ?? {};
  const trades24h = asNumber(row.trades_24h) ?? 0;
  return {
    trades24h,
    traders24h: asNumber(row.traders_24h) ?? 0,
    launches24h: asNumber(row.launches_24h) ?? 0,
    totalTrades: asNumber(row.total_trades) ?? 0,
    totalLaunches: asNumber(row.total_launches) ?? 0,
    tradeShareOfArcTransactionsPct: transactionsToday && transactionsToday > 0
      ? (trades24h / transactionsToday) * 100
      : null,
    shareDefinition: "Indexed Supershot trades in the last 24h divided by Arc transactions today. Launches, claims, and other protocol calls are not included yet."
  };
}

function sourceMeta() {
  return {
    configured: Boolean(BLOCKSCOUT_API_KEY),
    chainId: ARC_ANALYTICS_CHAIN_ID,
    source: "Blockscout",
    explorerUrl: ARC_EXPLORER_URL,
    apiBaseUrl: BLOCKSCOUT_API_BASE_URL
  };
}

export function registerArcAnalyticsRoutes(app: FastifyInstance, db: Pool) {
  app.get("/arc/analytics/status", async () => sourceMeta());

  app.get("/arc/stats", async (_request, reply) => {
    try {
      return { ...sourceMeta(), stats: await loadArcStats(), fetchedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(BLOCKSCOUT_API_KEY ? 502 : 503).send({ ...sourceMeta(), error: error instanceof Error ? error.message : "Arc analytics unavailable" });
    }
  });

  app.get("/arc/activity", async (_request, reply) => {
    try {
      return { ...sourceMeta(), items: await loadArcActivity(), fetchedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(BLOCKSCOUT_API_KEY ? 502 : 503).send({ ...sourceMeta(), error: error instanceof Error ? error.message : "Arc activity unavailable" });
    }
  });

  app.get("/arc/blocks", async (_request, reply) => {
    try {
      return { ...sourceMeta(), items: await loadArcBlocks(), fetchedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(BLOCKSCOUT_API_KEY ? 502 : 503).send({ ...sourceMeta(), error: error instanceof Error ? error.message : "Arc blocks unavailable" });
    }
  });

  app.get("/arc/transactions", async (_request, reply) => {
    try {
      return { ...sourceMeta(), items: await loadArcTransactions(), fetchedAt: new Date().toISOString() };
    } catch (error) {
      return reply.code(BLOCKSCOUT_API_KEY ? 502 : 503).send({ ...sourceMeta(), error: error instanceof Error ? error.message : "Arc transactions unavailable" });
    }
  });

  app.get("/arc/analytics/overview", async (_request, reply) => {
    if (!BLOCKSCOUT_API_KEY) {
      return reply.code(503).send({
        ...sourceMeta(),
        error: "BLOCKSCOUT_API_KEY is not configured",
        setup: "Set BLOCKSCOUT_API_KEY on the API service. ARC_ANALYTICS_CHAIN_ID defaults to 5042."
      });
    }

    try {
      const [stats, activity, blocks, transactions] = await Promise.all([
        loadArcStats(),
        loadArcActivity(),
        loadArcBlocks(),
        loadArcTransactions()
      ]);
      const supershot = await loadSupershotComparison(db, stats.transactionsToday);
      return {
        ...sourceMeta(),
        fetchedAt: new Date().toISOString(),
        stats,
        activity,
        blocks,
        transactions,
        supershot
      };
    } catch (error) {
      app.log.warn({ err: error }, "Arc analytics refresh failed");
      return reply.code(502).send({
        ...sourceMeta(),
        error: error instanceof Error ? error.message : "Arc analytics unavailable"
      });
    }
  });
}
