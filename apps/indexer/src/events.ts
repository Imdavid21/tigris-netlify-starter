import {
  getAddress,
  parseAbiItem,
  type Address,
  type Log
} from "viem";
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

function hexToBuffer(value: string) {
  return Buffer.from(value.slice(2), "hex");
}

async function blockTime(blockNumber: bigint) {
  const block = await client.getBlock({ blockNumber });
  return new Date(Number(block.timestamp) * 1000);
}

export async function startEventIngestion() {
  if (!factory) throw new Error("FACTORY_ADDRESS is required");

  client.watchEvent({
    address: factory,
    event: tokenCreated,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { token, curve, creator, name, symbol } = log.args;
        if (!token || !curve || !creator || name === undefined || symbol === undefined) continue;

        const createdAt = await blockTime(log.blockNumber!);

        await db.query(
          `insert into tokens
            (address, curve_address, creator, name, symbol, created_block, created_at, status)
           values ($1,$2,$3,$4,$5,$6,$7,'ACTIVE')
           on conflict (address) do nothing`,
          [
            hexToBuffer(token),
            hexToBuffer(curve),
            hexToBuffer(creator),
            name,
            symbol,
            log.blockNumber!.toString(),
            createdAt
          ]
        );

        watchCurve(getAddress(curve), getAddress(token));
      }
    }
  });

  client.watchEvent({
    address: factory,
    event: graduationSwept,
    onLogs: async (logs) => {
      for (const log of logs) {
        const token = log.args.token;
        if (!token) continue;
        await db.query(
          "update tokens set status='GRADUATING' where address=$1",
          [hexToBuffer(token)]
        );
      }
    }
  });

  client.watchEvent({
    address: factory,
    event: tokenGraduated,
    onLogs: async (logs) => {
      for (const log of logs) {
        const token = log.args.token;
        const pool = log.args.pool;
        if (!token || !pool) continue;
        await db.query(
          "update tokens set status='GRADUATED', pool_address=$2 where address=$1",
          [hexToBuffer(token), hexToBuffer(pool)]
        );
      }
    }
  });

  const existing = await db.query<{ token: string; curve: string }>(
    `select
       '0x' || encode(address,'hex') as token,
       '0x' || encode(curve_address,'hex') as curve
     from tokens
     where status in ('ACTIVE','GRADUATING')`
  );

  for (const row of existing.rows) {
    watchCurve(getAddress(row.curve), getAddress(row.token));
  }
}

function watchCurve(curve: Address, token: Address) {
  client.watchEvent({
    address: curve,
    event: buy,
    onLogs: (logs) => ingestTrades(token, "BUY", logs)
  });

  client.watchEvent({
    address: curve,
    event: sell,
    onLogs: (logs) => ingestTrades(token, "SELL", logs)
  });
}

async function ingestTrades(token: Address, side: "BUY" | "SELL", logs: Log[]) {
  for (const raw of logs as any[]) {
    const args = raw.args as Record<string, bigint | Address>;
    const trader = args.trader as Address;
    const tokenAmount =
      side === "BUY" ? (args.tokensOut as bigint) : (args.tokensIn as bigint);
    const quoteAmount =
      side === "BUY" ? (args.quoteIn as bigint) : (args.quoteOut as bigint);
    const fee = args.fee as bigint;
    const time = await blockTime(raw.blockNumber);

    await db.query(
      `insert into trades
       (tx_hash, log_index, block_number, block_time, token, trader, side, token_amount, quote_amount, fee_amount)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (tx_hash,log_index) do nothing`,
      [
        hexToBuffer(raw.transactionHash),
        raw.logIndex,
        raw.blockNumber.toString(),
        time,
        hexToBuffer(token),
        hexToBuffer(trader),
        side,
        tokenAmount.toString(),
        quoteAmount.toString(),
        fee.toString()
      ]
    );
  }
}
