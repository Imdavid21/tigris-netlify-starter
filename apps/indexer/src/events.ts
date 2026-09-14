import { getAddress, parseAbiItem, type Address } from "viem";
import { client, db } from "./context.js";

const tokenCreated = parseAbiItem(
  "event TokenCreated(address indexed token,address indexed curve,address indexed creator,string name,string symbol)"
);
const buy = parseAbiItem(
  "event Buy(address indexed trader,uint256 quoteIn,uint256 tokensOut,uint256 fee)"
);
const sell = parseAbiItem(
  "event Sell(address indexed trader,uint256 tokensIn,uint256 quoteOut,uint256 fee)"
);
const graduationSwept = parseAbiItem(
  "event GraduationSwept(address indexed token,uint256 quoteAmount,uint256 tokenAmount)"
);
const tokenGraduated = parseAbiItem(
  "event TokenGraduated(address indexed token,address indexed pool,uint256 positionId)"
);

const factory = process.env.FACTORY_ADDRESS as Address | undefined;
const startBlock = BigInt(process.env.FACTORY_START_BLOCK ?? "0");
const watched = new Set<string>();

function hexToBuffer(value: string) {
  return Buffer.from(value.slice(2), "hex");
}

const blockTimeCache = new Map<bigint, Date>();

async function blockTime(blockNumber: bigint) {
  const cached = blockTimeCache.get(blockNumber);
  if (cached) return cached;
  const block = await client.getBlock({ blockNumber });
  const time = new Date(Number(block.timestamp) * 1000);
  blockTimeCache.set(blockNumber, time);
  if (blockTimeCache.size > 5_000) {
    const first = blockTimeCache.keys().next().value;
    if (first !== undefined) blockTimeCache.delete(first);
  }
  return time;
}

async function chunkedLogs(args: {
  address: Address;
  event: any;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const logs: any[] = [];
  const chunk = BigInt(process.env.LOG_CHUNK_SIZE ?? "5000");

  for (let from = args.fromBlock; from <= args.toBlock; from += chunk) {
    const to = from + chunk - 1n > args.toBlock ? args.toBlock : from + chunk - 1n;
    const batch = await client.getLogs({
      address: args.address,
      event: args.event,
      fromBlock: from,
      toBlock: to
    });
    logs.push(...batch);
  }

  return logs;
}

async function storeLaunch(log: any) {
  const { token, curve, creator, name, symbol } = log.args;
  if (!token || !curve || !creator) return;

  await db.query(
    `insert into tokens
      (address, curve_address, creator, name, symbol, created_block, created_at, status)
     values ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')
     on conflict (address) do update set
       curve_address=excluded.curve_address,
       creator=excluded.creator,
       name=excluded.name,
       symbol=excluded.symbol`,
    [
      hexToBuffer(token),
      hexToBuffer(curve),
      hexToBuffer(creator),
      name,
      symbol,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber)
    ]
  );

  await backfillCurve(getAddress(curve), getAddress(token), log.blockNumber);
  watchCurve(getAddress(curve), getAddress(token));
}

async function storeTrade(token: Address, side: "BUY" | "SELL", log: any) {
  const args = log.args;
  const tokenAmount = side === "BUY" ? args.tokensOut : args.tokensIn;
  const quoteAmount = side === "BUY" ? args.quoteIn : args.quoteOut;

  await db.query(
    `insert into trades
     (tx_hash, log_index, block_number, block_time, token, trader, side, token_amount, quote_amount, fee_amount)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (tx_hash,log_index) do nothing`,
    [
      hexToBuffer(log.transactionHash),
      log.logIndex,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber),
      hexToBuffer(token),
      hexToBuffer(args.trader),
      side,
      tokenAmount.toString(),
      quoteAmount.toString(),
      args.fee.toString()
    ]
  );
}

async function backfillCurve(curve: Address, token: Address, fromBlock: bigint) {
  const toBlock = await client.getBlockNumber();

  const [buys, sells] = await Promise.all([
    chunkedLogs({ address: curve, event: buy, fromBlock, toBlock }),
    chunkedLogs({ address: curve, event: sell, fromBlock, toBlock })
  ]);

  for (const log of buys) await storeTrade(token, "BUY", log);
  for (const log of sells) await storeTrade(token, "SELL", log);
}

async function backfillFactory() {
  if (!factory) throw new Error("FACTORY_ADDRESS is required");

  const toBlock = await client.getBlockNumber();
  const launches = await chunkedLogs({
    address: factory,
    event: tokenCreated,
    fromBlock: startBlock,
    toBlock
  });

  for (const log of launches) await storeLaunch(log);

  const [swept, graduated] = await Promise.all([
    chunkedLogs({ address: factory, event: graduationSwept, fromBlock: startBlock, toBlock }),
    chunkedLogs({ address: factory, event: tokenGraduated, fromBlock: startBlock, toBlock })
  ]);

  for (const log of swept) {
    if (log.args.token) {
      await db.query("update tokens set status='GRADUATING' where address=$1", [
        hexToBuffer(log.args.token)
      ]);
    }
  }

  for (const log of graduated) {
    if (log.args.token && log.args.pool) {
      await db.query(
        "update tokens set status='GRADUATED', pool_address=$2 where address=$1",
        [hexToBuffer(log.args.token), hexToBuffer(log.args.pool)]
      );
    }
  }
}

function watchCurve(curve: Address, token: Address) {
  const key = curve.toLowerCase();
  if (watched.has(key)) return;
  watched.add(key);

  client.watchEvent({
    address: curve,
    event: buy,
    onLogs: async (logs) => {
      for (const log of logs) await storeTrade(token, "BUY", log);
    },
    onError: console.error
  });

  client.watchEvent({
    address: curve,
    event: sell,
    onLogs: async (logs) => {
      for (const log of logs) await storeTrade(token, "SELL", log);
    },
    onError: console.error
  });
}

export async function startEventIngestion() {
  if (!factory) throw new Error("FACTORY_ADDRESS is required");

  await backfillFactory();

  client.watchEvent({
    address: factory,
    event: tokenCreated,
    onLogs: async (logs) => {
      for (const log of logs) await storeLaunch(log);
    },
    onError: console.error
  });

  client.watchEvent({
    address: factory,
    event: graduationSwept,
    onLogs: async (logs) => {
      for (const log of logs) {
        if (!log.args.token) continue;
        await db.query("update tokens set status='GRADUATING' where address=$1", [
          hexToBuffer(log.args.token)
        ]);
      }
    },
    onError: console.error
  });

  client.watchEvent({
    address: factory,
    event: tokenGraduated,
    onLogs: async (logs) => {
      for (const log of logs) {
        if (!log.args.token || !log.args.pool) continue;
        await db.query(
          "update tokens set status='GRADUATED', pool_address=$2 where address=$1",
          [hexToBuffer(log.args.token), hexToBuffer(log.args.pool)]
        );
      }
    },
    onError: console.error
  });
}
