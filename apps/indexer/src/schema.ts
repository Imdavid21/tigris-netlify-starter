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
`;
