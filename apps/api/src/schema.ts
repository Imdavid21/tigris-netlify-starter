export const schemaSql = `
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

create table if not exists transfers (
  tx_hash bytea not null,
  log_index integer not null,
  block_number bigint not null,
  block_time timestamptz not null,
  token bytea not null,
  from_addr bytea not null,
  to_addr bytea not null,
  amount numeric(78,0) not null,
  primary key (tx_hash, log_index)
);

create index if not exists transfers_token_block_idx on transfers(token, block_number);
create index if not exists transfers_from_idx on transfers(token, from_addr);
create index if not exists transfers_to_idx on transfers(token, to_addr);
alter table tokens add column if not exists generation text not null default 'V1';
alter table tokens add column if not exists quote_asset bytea;
alter table tokens add column if not exists creator_fee_recipient bytea;
alter table tokens add column if not exists creator_tax_bps integer not null default 0;
alter table tokens add column if not exists holder_fee_bps integer not null default 0;
alter table tokens add column if not exists description text;
alter table tokens add column if not exists image text;
alter table tokens add column if not exists website text;
alter table tokens add column if not exists twitter text;
alter table tokens add column if not exists telegram text;
alter table tokens add column if not exists graduation_sqrt_price numeric(78,0);
alter table tokens add column if not exists dex_pool_id bytea;
alter table tokens add column if not exists dex_position_id numeric(78,0);

create table if not exists buybacks (
  tx_hash bytea not null,
  log_index integer not null,
  block_number bigint not null,
  block_time timestamptz not null,
  venue bytea not null,
  token bytea not null,
  quote_asset bytea not null,
  quote_spent numeric(78,0) not null,
  tokens_burned numeric(78,0) not null,
  post_graduation boolean not null,
  primary key (tx_hash, log_index)
);

create index if not exists buybacks_token_time_idx on buybacks(token, block_time desc);

create table if not exists limit_orders (
  order_id numeric(78,0) primary key,
  owner bytea not null,
  curve bytea not null,
  side text not null check (side in ('BUY','SELL')),
  amount_in numeric(78,0) not null,
  min_amount_out numeric(78,0) not null,
  status text not null default 'OPEN',
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists limit_orders_owner_idx on limit_orders(owner, status);

create table if not exists token_images (
  id uuid primary key,
  mime_type text not null,
  data bytea not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create table if not exists arc_chain_snapshots (
  captured_at timestamptz primary key,
  stats jsonb not null default '{}'::jsonb,
  transaction_stats jsonb,
  contract_counters jsonb,
  hot_contracts jsonb,
  historical_lines jsonb not null default '{}'::jsonb
);
alter table arc_chain_snapshots add column if not exists historical_lines jsonb not null default '{}'::jsonb;

create index if not exists arc_chain_snapshots_time_idx on arc_chain_snapshots(captured_at desc);

create table if not exists arc_daily_activity (
  day date primary key,
  transactions bigint not null default 0,
  synced_at timestamptz not null default now()
);

create table if not exists arc_blocks (
  block_number bigint primary key,
  block_hash text,
  block_time timestamptz not null,
  transactions_count integer not null default 0,
  gas_used numeric(78,0),
  gas_limit numeric(78,0),
  miner text,
  synced_at timestamptz not null default now()
);

create index if not exists arc_blocks_time_idx on arc_blocks(block_time desc);

create table if not exists arc_transactions (
  tx_hash text primary key,
  block_number bigint,
  block_time timestamptz not null,
  status text,
  method text,
  from_address text,
  to_address text,
  created_contract text,
  fee_value text,
  value text,
  gas_used numeric(78,0),
  gas_price text,
  synced_at timestamptz not null default now()
);

create index if not exists arc_transactions_time_idx on arc_transactions(block_time desc);
create index if not exists arc_transactions_block_idx on arc_transactions(block_number desc);
create index if not exists arc_transactions_from_idx on arc_transactions(from_address, block_time desc);
create index if not exists arc_transactions_to_idx on arc_transactions(to_address, block_time desc);

create table if not exists arc_sync_state (
  id text primary key,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

`;