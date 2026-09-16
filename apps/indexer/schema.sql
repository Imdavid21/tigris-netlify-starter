create table if not exists tokens (
  address bytea primary key,
  curve_address bytea not null,
  creator bytea not null,
  name text not null,
  symbol text not null,
  created_block bigint not null,
  created_at timestamptz not null,
  status text not null default 'ACTIVE',
  pool_address bytea
);

create table if not exists trades (
  tx_hash bytea not null,
  log_index integer not null,
  block_number bigint not null,
  block_time timestamptz not null,
  token bytea not null,
  trader bytea not null,
  side text not null check (side in ('BUY','SELL')),
  token_amount numeric(78,0) not null,
  quote_amount numeric(78,0) not null,
  fee_amount numeric(78,0) not null,
  primary key (tx_hash, log_index)
);

create index if not exists trades_token_time_idx on trades(token, block_time desc);
create index if not exists trades_trader_time_idx on trades(trader, block_time desc);

alter table trades add column if not exists venue text not null default 'CURVE';
alter table tokens add column if not exists graduation_sqrt_price numeric(78,0);
alter table tokens add column if not exists dex_pool_id bytea;
alter table tokens add column if not exists dex_position_id numeric(78,0);

create table if not exists token_images (
  id uuid primary key,
  mime_type text not null,
  data bytea not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);
