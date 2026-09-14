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

`;
