import Fastify from "fastify";
import cors from "@fastify/cors";
import pg from "pg";
import { schemaSql } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = new pg.Pool({ connectionString: databaseUrl });
await db.query(schemaSql);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true
});

app.get("/", async () => ({ service: "arc-launchpad-api", ok: true }));

app.get("/health", async () => {
  const result = await db.query("select now() as now");
  return { ok: true, databaseTime: result.rows[0].now };
});

app.get("/stats", async () => {
  const result = await db.query(
    "select " +
      "(select count(*)::int from tokens) as launches, " +
      "(select count(*)::int from trades) as trades, " +
      "(select coalesce(sum(quote_amount),0)::text from trades) as quote_volume, " +
      "(select coalesce(sum(fee_amount),0)::text from trades) as fees, " +
      "(select coalesce(sum(quote_amount),0)::text from trades where block_time > now() - interval '24 hours') as quote_volume_24h, " +
      "(select count(*)::int from tokens where created_at > now() - interval '24 hours') as launches_24h, " +
      "(select count(distinct trader)::int from trades where block_time > now() - interval '24 hours') as traders_24h, " +
      "(select count(*)::int from tokens where status='GRADUATED') as graduated"
  );
  return result.rows[0];
});



app.get("/analytics/daily", async () => {
  const volume = await db.query(
    `select date_trunc('day', block_time) as day,
            coalesce(sum(quote_amount),0)::text as volume,
            count(*)::int as trades,
            count(distinct trader)::int as traders
     from trades
     where block_time > now() - interval '30 days'
     group by 1 order by 1 asc`
  );

  const launches = await db.query(
    `select date_trunc('day', created_at) as day,
            count(*)::int as launches
     from tokens
     where created_at > now() - interval '30 days'
     group by 1 order by 1 asc`
  );

  return { volume: volume.rows, launches: launches.rows };
});

app.get("/tokens", async (request) => {
  const q = request.query as { status?: string; limit?: string; offset?: string };
  const parsedLimit = Number(q.limit ?? 50);
  const parsedOffset = Number(q.offset ?? 0);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
    : 50;
  const offset = Number.isFinite(parsedOffset)
    ? Math.max(Math.trunc(parsedOffset), 0)
    : 0;

  const values: unknown[] = [];
  let where = "";

  if (q.status) {
    values.push(q.status.toUpperCase());
    where = "where status = $" + values.length;
  }

  values.push(limit, offset);

  const result = await db.query(
    `select
       '0x' || encode(address,'hex') as address,
       '0x' || encode(curve_address,'hex') as curve_address,
       '0x' || encode(creator,'hex') as creator,
       name,
       symbol,
       created_block,
       created_at,
       status,
       case when pool_address is null then null else '0x' || encode(pool_address,'hex') end as pool_address,
       coalesce((
         select sum(tr.quote_amount)::text
         from trades tr
         where tr.token=tokens.address and tr.block_time > now() - interval '24 hours'
       ), '0') as volume_24h,
       coalesce((
         select count(*)::int
         from trades tr
         where tr.token=tokens.address and tr.block_time > now() - interval '24 hours'
       ), 0) as trades_24h,
       (
         select max(tr.block_time)
         from trades tr
         where tr.token=tokens.address
       ) as last_trade_at
     from tokens
     ${where}
     order by coalesce((
       select max(tr.block_time) from trades tr where tr.token=tokens.address
     ), created_at) desc
     limit $${values.length - 1} offset $${values.length}`,
    values
  );

  return { items: result.rows };
});

app.get("/tokens/:address", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.code(400).send({ error: "invalid address" });
  }

  const result = await db.query(
    `select
       '0x' || encode(address,'hex') as address,
       '0x' || encode(curve_address,'hex') as curve_address,
       '0x' || encode(creator,'hex') as creator,
       name, symbol, created_block, created_at, status,
       case when pool_address is null then null else '0x' || encode(pool_address,'hex') end as pool_address
     from tokens where address=decode($1,'hex') limit 1`,
    [address.slice(2)]
  );

  if (!result.rowCount) return reply.code(404).send({ error: "not found" });

  const trades = await db.query(
    `select
       '0x' || encode(tx_hash,'hex') as tx_hash,
       log_index, block_number, block_time,
       '0x' || encode(trader,'hex') as trader,
       side, token_amount, quote_amount, fee_amount
     from trades where token=decode($1,'hex')
     order by block_time desc limit 100`,
    [address.slice(2)]
  );

  return { ...result.rows[0], trades: trades.rows };
});



app.get("/tokens/:address/holders", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.code(400).send({ error: "invalid address" });
  }

  const result = await db.query(
    `with deltas as (
       select to_addr as holder, amount as delta
       from transfers
       where token=decode($1,'hex')
       union all
       select from_addr as holder, -amount as delta
       from transfers
       where token=decode($1,'hex')
     )
     select
       '0x' || encode(holder,'hex') as holder,
       sum(delta)::text as balance
     from deltas
     where holder <> decode(repeat('00',20),'hex')
     group by holder
     having sum(delta) > 0
     order by sum(delta) desc
     limit 100`,
    [address.slice(2)]
  );

  return { items: result.rows };
});

app.get("/wallet/:address/activity", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.code(400).send({ error: "invalid address" });
  }

  const result = await db.query(
    `select
       '0x' || encode(tx_hash,'hex') as tx_hash,
       '0x' || encode(token,'hex') as token,
       side, token_amount, quote_amount, fee_amount, block_time
     from trades where trader=decode($1,'hex')
     order by block_time desc limit 200`,
    [address.slice(2)]
  );

  return { items: result.rows };
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
