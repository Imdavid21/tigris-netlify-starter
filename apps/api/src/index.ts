import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import { createDatabasePool, prepareDatabaseSchema, databaseSchema } from "./database.js";
import { schemaSql } from "./schema.js";

await prepareDatabaseSchema();
const db = createDatabasePool();
await db.query(schemaSql);

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true
});

app.get("/", async () => ({ service: "arc-launchpad-api", ok: true, databaseSchema }));

app.get("/health", async () => {
  const result = await db.query("select now() as now");
  return { ok: true, databaseTime: result.rows[0].now, databaseSchema };
});

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxImageBytes = 5 * 1024 * 1024;
const uploadWindows = new Map<string, { count: number; resetAt: number }>();

app.post("/uploads/images", async (request, reply) => {
  const now = Date.now();
  const key = request.ip;
  const window = uploadWindows.get(key);
  if (!window || window.resetAt <= now) {
    uploadWindows.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    if (window.count >= 20) return reply.code(429).send({ error: "Too many image uploads. Try again later." });
    window.count += 1;
  }

  const body = request.body as { dataUrl?: string } | undefined;
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(body?.dataUrl ?? "");
  if (!match || !allowedImageTypes.has(match[1])) return reply.code(400).send({ error: "Use a PNG, JPG, WebP, or GIF image." });

  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > maxImageBytes) return reply.code(400).send({ error: "Token images must be 5 MB or smaller." });

  const id = randomUUID();
  await db.query("insert into token_images(id,mime_type,data,size_bytes) values ($1,$2,$3,$4)", [id, match[1], data, data.length]);
  return reply.code(201).send({ id, path: `/uploads/images/${id}` });
});

app.get("/uploads/images/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return reply.code(400).send({ error: "invalid image id" });
  const result = await db.query("select mime_type,data from token_images where id=$1 limit 1", [id]);
  if (!result.rowCount) return reply.code(404).send({ error: "not found" });
  reply.header("Cache-Control", "public, max-age=31536000, immutable");
  reply.header("X-Content-Type-Options", "nosniff");
  return reply.type(result.rows[0].mime_type).send(result.rows[0].data);
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
      "(select count(distinct creator)::int from tokens) as unique_creators, " +
      "(select count(distinct creator)::int from tokens where created_at > now() - interval '24 hours') as creators_24h, " +
      "(select count(distinct trader)::int from trades) as unique_traders, " +
      "(select count(distinct trader)::int from trades where block_time > now() - interval '24 hours') as traders_24h, " +
      "(select count(*)::int from tokens where status='GRADUATED') as graduated, " +
      "(select coalesce(sum(quote_spent),0)::text from buybacks) as buyback_quote, " +
      "(select coalesce(sum(tokens_burned),0)::text from buybacks) as tokens_burned, " +
      "(select count(*)::int from limit_orders where status='OPEN') as open_orders, " +
      "(select count(*)::int from buybacks) as buyback_count, " +
      "(select count(*)::int from trades where venue='UNISWAP_V4') as post_graduation_trades, " +
      "(select count(distinct token)::int from trades where venue='UNISWAP_V4') as post_graduation_markets"
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

  const venues = await db.query(
    `select date_trunc('day', block_time) as day,
            venue,
            count(*)::int as trades,
            count(distinct trader)::int as traders
     from trades
     where block_time > now() - interval '30 days'
     group by 1,2 order by 1 asc,2 asc`
  );

  return { volume: volume.rows, launches: launches.rows, venues: venues.rows };
});

app.get("/analytics/venues", async () => {
  const result = await db.query(
    `select venue,
            count(*)::int as trades,
            count(distinct trader)::int as traders,
            count(distinct token)::int as markets
     from trades
     group by venue
     order by trades desc`
  );
  return { items: result.rows };
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
       generation,
       case when quote_asset is null then null else '0x' || encode(quote_asset,'hex') end as quote_asset,
       creator_tax_bps,
       holder_fee_bps,
       image,
       website,
       twitter,
       telegram,
       case when pool_address is null then null else '0x' || encode(pool_address,'hex') end as pool_address,
       graduation_sqrt_price,
       case when dex_pool_id is null then null else '0x' || encode(dex_pool_id,'hex') end as dex_pool_id,
       dex_position_id,
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
       name, symbol, created_block, created_at, status, generation,
       case when quote_asset is null then null else '0x' || encode(quote_asset,'hex') end as quote_asset,
       case when creator_fee_recipient is null then null else '0x' || encode(creator_fee_recipient,'hex') end as creator_fee_recipient,
       creator_tax_bps,
       holder_fee_bps,
       description,
       image,
       website,
       twitter,
       telegram,
       case when pool_address is null then null else '0x' || encode(pool_address,'hex') end as pool_address,
       graduation_sqrt_price,
       case when dex_pool_id is null then null else '0x' || encode(dex_pool_id,'hex') end as dex_pool_id,
       dex_position_id
     from tokens where address=decode($1,'hex') limit 1`,
    [address.slice(2)]
  );

  if (!result.rowCount) return reply.code(404).send({ error: "not found" });

  const trades = await db.query(
    `select
       '0x' || encode(tx_hash,'hex') as tx_hash,
       log_index, block_number, block_time,
       '0x' || encode(trader,'hex') as trader,
       side, token_amount, quote_amount, fee_amount, venue
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

app.get("/wallet/:address/launches", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return reply.code(400).send({ error: "invalid address" });

  const result = await db.query(
    `select
       '0x' || encode(address,'hex') as address,
       name, symbol, status, created_at,
       case when pool_address is null then null else '0x' || encode(pool_address,'hex') end as pool_address
     from tokens
     where creator=decode($1,'hex')
     order by created_at desc`,
    [address.slice(2)]
  );
  return { items: result.rows };
});

app.get("/wallet/:address/positions", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return reply.code(400).send({ error: "invalid address" });

  const result = await db.query(
    `with deltas as (
       select token, amount as delta from transfers where to_addr=decode($1,'hex')
       union all
       select token, -amount as delta from transfers where from_addr=decode($1,'hex')
     ),
     balances as (
       select token, sum(delta) as balance
       from deltas group by token having sum(delta) > 0
     )
     select
       '0x' || encode(b.token,'hex') as token,
       b.balance::text,
       t.name,
       t.symbol,
       t.status,
       t.generation,
       case when t.quote_asset is null then null else '0x' || encode(t.quote_asset,'hex') end as quote_asset
     from balances b
     join tokens t on t.address=b.token
     order by b.balance desc
     limit 100`,
    [address.slice(2)]
  );
  return { items: result.rows };
});

app.get("/buybacks", async () => {
  const result = await db.query(
    `select
       '0x' || encode(tx_hash,'hex') as tx_hash,
       block_time,
       '0x' || encode(venue,'hex') as venue,
       '0x' || encode(token,'hex') as token,
       '0x' || encode(quote_asset,'hex') as quote_asset,
       quote_spent,
       tokens_burned,
       post_graduation
     from buybacks
     order by block_time desc
     limit 200`
  );
  return { items: result.rows };
});

app.get("/wallet/:address/orders", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return reply.code(400).send({ error: "invalid address" });
  }

  const result = await db.query(
    `select
       order_id,
       '0x' || encode(curve,'hex') as curve,
       side,
       amount_in,
       min_amount_out,
       status,
       created_at,
       updated_at
     from limit_orders
     where owner=decode($1,'hex')
     order by coalesce(updated_at,created_at) desc
     limit 200`,
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
       side, token_amount, quote_amount, fee_amount, venue, block_time
     from trades where trader=decode($1,'hex')
     order by block_time desc limit 200`,
    [address.slice(2)]
  );

  return { items: result.rows };
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
