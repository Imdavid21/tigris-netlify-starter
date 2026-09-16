import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient, QueryResult } from "pg";

const BLOCKSCOUT_API_BASE_URL = (process.env.BLOCKSCOUT_API_BASE_URL ?? "https://api.blockscout.com").replace(/\/+$/, "");
const BLOCKSCOUT_API_KEY = process.env.BLOCKSCOUT_API_KEY?.trim() ?? "";
const ARC_ANALYTICS_CHAIN_ID = process.env.ARC_ANALYTICS_CHAIN_ID?.trim() || "5042";
const ARC_EXPLORER_URL = (process.env.ARC_EXPLORER_URL ?? "https://explorer.arc.io").replace(/\/+$/, "");
const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const INITIAL_BACKFILL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_PAGES = 100;
const MAX_BLOCK_PAGES = 3;

type Json = Record<string, any>;
type Queryable = { query: (text: string, values?: any[]) => Promise<QueryResult<any>> };

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
  if (Array.isArray(payload?.chart)) return payload.chart;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let blockscoutQueue: Promise<void> = Promise.resolve();
let lastBlockscoutRequestAt = 0;
const BLOCKSCOUT_MIN_REQUEST_GAP_MS = 500;
const BLOCKSCOUT_MAX_ATTEMPTS = 4;

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(1_000, date - Date.now());
  }
  return Math.min(8_000, 1_250 * (2 ** attempt));
}

async function blockscout(path: string, query: Record<string, string | number | boolean | null | undefined> = {}) {
  if (!BLOCKSCOUT_API_KEY) throw new Error("BLOCKSCOUT_API_KEY is not configured");

  const run = blockscoutQueue.then(async () => {
    const url = new URL(`${BLOCKSCOUT_API_BASE_URL}/${ARC_ANALYTICS_CHAIN_ID}${path}`);
    url.searchParams.set("apikey", BLOCKSCOUT_API_KEY);
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; attempt < BLOCKSCOUT_MAX_ATTEMPTS; attempt += 1) {
      const wait = Math.max(0, lastBlockscoutRequestAt + BLOCKSCOUT_MIN_REQUEST_GAP_MS - Date.now());
      if (wait) await sleep(wait);
      lastBlockscoutRequestAt = Date.now();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
        if (response.status === 429 && attempt < BLOCKSCOUT_MAX_ATTEMPTS - 1) {
          await sleep(retryDelayMs(response, attempt));
          continue;
        }
        if (!response.ok) throw new Error(`Blockscout ${path} returned ${response.status}`);
        return await response.json() as Json;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`Blockscout ${path} exhausted retries`);
  });

  blockscoutQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function optionalBlockscout(path: string, query: Record<string, string | number> = {}) {
  try {
    return await blockscout(path, query);
  } catch {
    return null;
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
    totalGasUsed: asNumber(raw?.total_gas_used ?? raw?.totalGasUsed),
    networkUtilizationPct: asNumber(raw?.network_utilization_percentage ?? raw?.networkUtilizationPercentage),
    gasPrices: gasPrices && typeof gasPrices === "object" ? {
      slow: asNumber(gasPrices.slow),
      average: asNumber(gasPrices.average),
      fast: asNumber(gasPrices.fast)
    } : null
  };
}

function normalizeStatsLine(raw: Json | null) {
  if (!raw) return [];
  return itemArray(raw)
    .map((item) => ({
      date: asString(item?.date ?? item?.date_from ?? item?.timestamp),
      dateTo: asString(item?.date_to),
      value: asNumber(item?.value),
      approximate: Boolean(item?.is_approximate)
    }))
    .filter((item): item is { date: string; dateTo: string | null; value: number; approximate: boolean } => Boolean(item.date) && item.value !== null);
}

function normalizeActivity(raw: Json) {
  return itemArray(raw)
    .map((item) => ({
      date: asString(item?.date ?? item?.day ?? item?.timestamp),
      transactions: asNumber(item?.transactions_count ?? item?.tx_count ?? item?.transactions ?? item?.count ?? item?.value)
    }))
    .filter((item): item is { date: string; transactions: number } => Boolean(item.date) && item.transactions !== null)
    .slice(-365);
}

function normalizeBlock(item: any) {
  return {
    number: asNumber(item?.height ?? item?.number),
    hash: asString(item?.hash),
    timestamp: asString(item?.timestamp),
    transactions: asNumber(item?.transactions_count ?? item?.tx_count ?? item?.transaction_count),
    gasUsed: asString(item?.gas_used),
    gasLimit: asString(item?.gas_limit),
    miner: asString(item?.miner?.hash ?? item?.miner)
  };
}

function normalizeTransaction(item: any) {
  const created = item?.created_contract?.hash ?? item?.created_contract_address_hash ?? item?.created_contract;
  return {
    hash: asString(item?.hash),
    block: asNumber(item?.block ?? item?.block_number),
    timestamp: asString(item?.timestamp),
    status: asString(item?.status),
    method: asString(item?.method ?? item?.decoded_input?.method_call),
    from: asString(item?.from?.hash ?? item?.from),
    to: asString(item?.to?.hash ?? item?.to),
    createdContract: asString(created),
    fee: asString(item?.fee?.value ?? item?.fee),
    value: asString(item?.value),
    gasUsed: asString(item?.gas_used),
    gasPrice: asString(item?.gas_price)
  };
}

function normalizeTransactionStats(raw: Json | null) {
  if (!raw) return null;
  return {
    transactions24h: asNumber(raw.transactions_count_24h),
    pendingTransactions: asNumber(raw.pending_transactions_count),
    feesSum24h: asString(raw.transaction_fees_sum_24h),
    feesAverage24h: asString(raw.transaction_fees_avg_24h)
  };
}

function normalizeContractCounters(raw: Json | null) {
  if (!raw) return null;
  return {
    smartContracts: asNumber(raw.smart_contracts),
    newSmartContracts24h: asNumber(raw.new_smart_contracts_24h),
    verifiedSmartContracts: asNumber(raw.verified_smart_contracts),
    newVerifiedSmartContracts24h: asNumber(raw.new_verified_smart_contracts_24h)
  };
}

function normalizeHotContracts(raw: Json | null) {
  if (!raw) return [];
  return itemArray(raw).slice(0, 12).map((item) => ({
    address: asString(item?.address?.hash ?? item?.address_hash ?? item?.hash),
    name: asString(item?.address?.name ?? item?.name ?? item?.smart_contract?.name),
    transactions: asNumber(item?.transactions_count ?? item?.transaction_count ?? item?.tx_count ?? item?.transactions)
  })).filter((item) => item.address);
}

async function upsertTransactions(db: Queryable, transactions: ReturnType<typeof normalizeTransaction>[]) {
  for (let offset = 0; offset < transactions.length; offset += 150) {
    const chunk = transactions.slice(offset, offset + 150).filter((tx) => tx.hash && tx.timestamp);
    if (!chunk.length) continue;
    const values: any[] = [];
    const rows = chunk.map((tx, index) => {
      const base = index * 12;
      values.push(tx.hash, tx.block, tx.timestamp, tx.status, tx.method, tx.from, tx.to, tx.createdContract, tx.fee, tx.value, tx.gasUsed, tx.gasPrice);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12})`;
    });
    await db.query(
      `insert into arc_transactions(tx_hash,block_number,block_time,status,method,from_address,to_address,created_contract,fee_value,value,gas_used,gas_price)
       values ${rows.join(",")}
       on conflict (tx_hash) do update set
         block_number=excluded.block_number,
         block_time=excluded.block_time,
         status=excluded.status,
         method=excluded.method,
         from_address=excluded.from_address,
         to_address=excluded.to_address,
         created_contract=excluded.created_contract,
         fee_value=excluded.fee_value,
         value=excluded.value,
         gas_used=excluded.gas_used,
         gas_price=excluded.gas_price,
         synced_at=now()`,
      values
    );
  }
}

async function syncTransactions(db: Queryable) {
  const latestResult = await db.query("select max(block_number)::text as block from arc_transactions");
  const latestIndexed = asNumber(latestResult.rows[0]?.block);
  const cutoff = Date.now() - INITIAL_BACKFILL_MS;
  let query: Record<string, string | number> = {};
  let pages = 0;
  let indexed = 0;

  while (pages < MAX_TRANSACTION_PAGES) {
    const raw = await blockscout("/api/v2/transactions", query);
    const normalized = itemArray(raw).map(normalizeTransaction).filter((tx) => tx.hash && tx.timestamp);
    if (!normalized.length) break;

    const wanted = normalized.filter((tx) => {
      if (latestIndexed !== null && tx.block !== null) return tx.block >= latestIndexed - 1;
      return new Date(tx.timestamp as string).getTime() >= cutoff;
    });
    await upsertTransactions(db, wanted);
    indexed += wanted.length;

    const oldestBlock = Math.min(...normalized.map((tx) => tx.block ?? Number.POSITIVE_INFINITY));
    const oldestTime = Math.min(...normalized.map((tx) => new Date(tx.timestamp as string).getTime()));
    if (latestIndexed !== null && Number.isFinite(oldestBlock) && oldestBlock < latestIndexed - 1) break;
    if (latestIndexed === null && Number.isFinite(oldestTime) && oldestTime < cutoff) break;

    const next = raw?.next_page_params;
    if (!next || typeof next !== "object" || !Object.keys(next).length) break;
    query = next;
    pages += 1;
  }
  return indexed;
}

async function syncBlocks(db: Queryable) {
  let query: Record<string, string | number> = {};
  let indexed = 0;
  for (let page = 0; page < MAX_BLOCK_PAGES; page += 1) {
    const raw = await blockscout("/api/v2/blocks", query);
    const blocks = itemArray(raw).map(normalizeBlock).filter((block) => block.number !== null && block.timestamp);
    for (const block of blocks) {
      await db.query(
        `insert into arc_blocks(block_number,block_hash,block_time,transactions_count,gas_used,gas_limit,miner)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (block_number) do update set
           block_hash=excluded.block_hash,
           block_time=excluded.block_time,
           transactions_count=excluded.transactions_count,
           gas_used=excluded.gas_used,
           gas_limit=excluded.gas_limit,
           miner=excluded.miner,
           synced_at=now()`,
        [block.number, block.hash, block.timestamp, block.transactions ?? 0, block.gasUsed, block.gasLimit, block.miner]
      );
    }
    indexed += blocks.length;
    const next = raw?.next_page_params;
    if (!next || typeof next !== "object" || !Object.keys(next).length) break;
    query = next;
  }
  return indexed;
}

async function syncDailyActivity(db: Queryable, activity: ReturnType<typeof normalizeActivity>) {
  for (const point of activity) {
    await db.query(
      `insert into arc_daily_activity(day,transactions,synced_at) values ($1,$2,now())
       on conflict (day) do update set transactions=excluded.transactions,synced_at=now()`,
      [point.date, point.transactions]
    );
  }
}

export async function syncArcAnalytics(db: Pool, log?: FastifyInstance["log"]) {
  if (!BLOCKSCOUT_API_KEY) return { configured: false, skipped: true };
  const client: PoolClient = await db.connect();
  let locked = false;
  try {
    const lockResult = await client.query("select pg_try_advisory_lock(5042, 30) as locked");
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) return { configured: true, skipped: true };

    const statsRaw = await blockscout("/api/v2/stats");
    const activityRaw = await blockscout("/api/v2/stats/charts/transactions");
    const transactionStatsRaw = await optionalBlockscout("/api/v2/transactions/stats");
    const contractCountersRaw = await optionalBlockscout("/api/v2/smart-contracts/counters");
    const hotContractsRaw = await optionalBlockscout("/api/v2/stats/hot-smart-contracts", { scale: "1h" });

    const historicalLines: Record<string, ReturnType<typeof normalizeStatsLine>> = {};
    for (const name of ["active_accounts", "txns_success_rate", "new_blocks", "average_gas_used", "average_gas_limit"]) {
      const raw = await optionalBlockscout(`/stats-service/api/v1/lines/${name}`, { resolution: "DAY" });
      const points = normalizeStatsLine(raw);
      if (points.length) historicalLines[name] = points.slice(-365);
    }

    const stats = normalizeStats(statsRaw);
    const activity = normalizeActivity(activityRaw);
    const transactionStats = normalizeTransactionStats(transactionStatsRaw);
    const contractCounters = normalizeContractCounters(contractCountersRaw);
    const hotContracts = normalizeHotContracts(hotContractsRaw);

    const transactionsIndexed = await syncTransactions(client);
    const blocksIndexed = await syncBlocks(client);
    await syncDailyActivity(client, activity);

    await client.query(
      `insert into arc_chain_snapshots(captured_at,stats,transaction_stats,contract_counters,hot_contracts,historical_lines)
       values (now(),$1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)`,
      [JSON.stringify(stats), JSON.stringify(transactionStats), JSON.stringify(contractCounters), JSON.stringify(hotContracts), JSON.stringify(historicalLines)]
    );
    await client.query("delete from arc_chain_snapshots where captured_at < now() - interval '120 days'");
    await client.query(
      `insert into arc_sync_state(id,last_synced_at,last_error,updated_at)
       values ('arc',now(),null,now())
       on conflict (id) do update set last_synced_at=now(),last_error=null,updated_at=now()`
    );

    log?.info({ transactionsIndexed, blocksIndexed }, "Arc analytics indexed");
    return { configured: true, transactionsIndexed, blocksIndexed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arc analytics sync failed";
    await client.query(
      `insert into arc_sync_state(id,last_error,updated_at) values ('arc',$1,now())
       on conflict (id) do update set last_error=$1,updated_at=now()`,
      [message]
    ).catch(() => {});
    log?.warn({ err: error }, "Arc analytics sync failed");
    throw error;
  } finally {
    if (locked) await client.query("select pg_advisory_unlock(5042, 30)").catch(() => {});
    client.release();
  }
}

function sourceMeta() {
  return {
    configured: Boolean(BLOCKSCOUT_API_KEY),
    chainId: ARC_ANALYTICS_CHAIN_ID,
    explorerUrl: ARC_EXPLORER_URL,
    refreshMinutes: 30
  };
}

async function loadSupershotComparison(db: Queryable, transactionsToday: number | null) {
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
    tradeShareOfArcTransactionsPct: transactionsToday && transactionsToday > 0 ? (trades24h / transactionsToday) * 100 : null
  };
}

async function loadArcOverview(db: Pool) {
  const [snapshotRes, syncRes, activityRes, blocksRes, txRes, recentRes, methodsRes, destinationsRes] = await Promise.all([
    db.query("select * from arc_chain_snapshots order by captured_at desc limit 1"),
    db.query("select last_synced_at,last_error from arc_sync_state where id='arc' limit 1"),
    db.query("select day,transactions from arc_daily_activity order by day asc limit 365"),
    db.query("select block_number,block_hash,block_time,transactions_count,gas_used::text,gas_limit::text,miner from arc_blocks order by block_number desc limit 40"),
    db.query("select tx_hash,block_number,block_time,status,method,from_address,to_address,created_contract,fee_value,value,gas_used::text,gas_price from arc_transactions order by block_time desc limit 60"),
    db.query(`with recent as (
                select * from arc_transactions where block_time > now() - interval '48 hours'
              ), bounds as (
                select extract(epoch from (max(block_time) - min(block_time))) as span_seconds from recent
              ), params as (
                select case
                  when coalesce(span_seconds,0) <= 300 then 5
                  when span_seconds <= 3600 then 30
                  when span_seconds <= 21600 then 120
                  when span_seconds <= 86400 then 600
                  else 1800
                end::int as bucket_seconds
                from bounds
              ), aggregated as (
                select to_timestamp(floor(extract(epoch from r.block_time) / p.bucket_seconds) * p.bucket_seconds) as bucket,
                       p.bucket_seconds,
                       count(*)::int as transactions,
                       count(distinct r.from_address)::int as senders,
                       count(*) filter (where lower(coalesce(r.status,'')) in ('ok','success','confirmed'))::int as successful,
                       count(*) filter (where lower(coalesce(r.status,'')) in ('error','failed','fail','reverted','revert'))::int as failed,
                       count(*) filter (where r.method is not null and r.method <> '')::int as contract_calls
                from recent r cross join params p
                group by 1,2
              )
              select * from (select * from aggregated order by bucket desc limit 240) latest order by bucket asc`),
    db.query(`select coalesce(nullif(regexp_replace(method,'\\(.*$','','g'),''),'Transfer') as method,count(*)::int as transactions
              from arc_transactions where block_time > now() - interval '24 hours'
              group by 1 order by 2 desc limit 8`),
    db.query(`select to_address,count(*)::int as transactions,count(distinct from_address)::int as senders
              from arc_transactions
              where block_time > now() - interval '24 hours' and to_address is not null
              group by to_address order by 2 desc limit 8`)
  ]);

  if (!snapshotRes.rowCount) return null;
  const snapshot = snapshotRes.rows[0];
  const stats = snapshot.stats ?? {};
  const supershot = await loadSupershotComparison(db, asNumber(stats.transactionsToday));
  return {
    ...sourceMeta(),
    fetchedAt: syncRes.rows[0]?.last_synced_at ?? snapshot.captured_at,
    syncError: syncRes.rows[0]?.last_error ?? null,
    stats,
    transactionStats: snapshot.transaction_stats,
    contracts: snapshot.contract_counters,
    hotContracts: snapshot.hot_contracts ?? [],
    historicalLines: snapshot.historical_lines ?? {},
    activity: activityRes.rows.map((row) => ({ date: row.day, transactions: asNumber(row.transactions) ?? 0 })),
    recentBucketSeconds: asNumber(recentRes.rows[0]?.bucket_seconds) ?? null,
    recentActivity: recentRes.rows.map((row) => ({
      time: row.bucket,
      transactions: asNumber(row.transactions) ?? 0,
      senders: asNumber(row.senders) ?? 0,
      successful: asNumber(row.successful) ?? 0,
      failed: asNumber(row.failed) ?? 0,
      contractCalls: asNumber(row.contract_calls) ?? 0
    })),
    blocks: blocksRes.rows.map((row) => ({
      number: asNumber(row.block_number),
      hash: row.block_hash,
      timestamp: row.block_time,
      transactions: asNumber(row.transactions_count) ?? 0,
      gasUsed: row.gas_used,
      gasLimit: row.gas_limit,
      miner: row.miner
    })),
    transactions: txRes.rows.map((row) => ({
      hash: row.tx_hash,
      block: asNumber(row.block_number),
      timestamp: row.block_time,
      status: row.status,
      method: row.method,
      from: row.from_address,
      to: row.to_address,
      createdContract: row.created_contract,
      fee: row.fee_value,
      value: row.value,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price
    })),
    topMethods: methodsRes.rows,
    topDestinations: destinationsRes.rows,
    supershot
  };
}

export function startArcAnalyticsIndexer(app: FastifyInstance, db: Pool) {
  const run = () => syncArcAnalytics(db, app.log).catch(() => {});
  const initial = setTimeout(run, 1_500);
  const interval = setInterval(run, SYNC_INTERVAL_MS);
  initial.unref();
  interval.unref();
}

export function registerArcAnalyticsRoutes(app: FastifyInstance, db: Pool) {
  app.get("/arc/analytics/status", async () => {
    const result = await db.query("select last_synced_at,last_error from arc_sync_state where id='arc' limit 1");
    return { ...sourceMeta(), lastSyncedAt: result.rows[0]?.last_synced_at ?? null, lastError: result.rows[0]?.last_error ?? null };
  });

  app.get("/arc/stats", async (_request, reply) => {
    const overview = await loadArcOverview(db);
    if (!overview) return reply.code(503).send({ ...sourceMeta(), error: BLOCKSCOUT_API_KEY ? "Arc analytics index is warming up" : "BLOCKSCOUT_API_KEY is not configured" });
    return { ...sourceMeta(), stats: overview.stats, fetchedAt: overview.fetchedAt };
  });

  app.get("/arc/activity", async (_request, reply) => {
    const overview = await loadArcOverview(db);
    if (!overview) return reply.code(503).send({ ...sourceMeta(), error: "Arc analytics index is warming up" });
    return { ...sourceMeta(), items: overview.activity, fetchedAt: overview.fetchedAt };
  });

  app.get("/arc/blocks", async (_request, reply) => {
    const overview = await loadArcOverview(db);
    if (!overview) return reply.code(503).send({ ...sourceMeta(), error: "Arc analytics index is warming up" });
    return { ...sourceMeta(), items: overview.blocks, fetchedAt: overview.fetchedAt };
  });

  app.get("/arc/transactions", async (_request, reply) => {
    const overview = await loadArcOverview(db);
    if (!overview) return reply.code(503).send({ ...sourceMeta(), error: "Arc analytics index is warming up" });
    return { ...sourceMeta(), items: overview.transactions, fetchedAt: overview.fetchedAt };
  });

  app.get("/arc/analytics/overview", async (_request, reply) => {
    const overview = await loadArcOverview(db);
    if (overview) {
      const age = Date.now() - new Date(overview.fetchedAt).getTime();
      if (BLOCKSCOUT_API_KEY && age > SYNC_INTERVAL_MS * 1.5) void syncArcAnalytics(db, app.log).catch(() => {});
      return overview;
    }
    if (BLOCKSCOUT_API_KEY) void syncArcAnalytics(db, app.log).catch(() => {});
    return reply.code(503).send({
      ...sourceMeta(),
      error: BLOCKSCOUT_API_KEY ? "Arc analytics index is warming up" : "BLOCKSCOUT_API_KEY is not configured"
    });
  });
}
