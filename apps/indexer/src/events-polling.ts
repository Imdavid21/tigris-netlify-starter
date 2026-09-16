import { getAddress, parseAbiItem, type Address } from "viem";
import { client, db } from "./context.js";

const tokenCreatedV1 = parseAbiItem(
  "event TokenCreated(address indexed token,address indexed curve,address indexed creator,string name,string symbol)"
);
const tokenCreatedV2 = parseAbiItem(
  "event TokenCreated(address indexed token,address indexed curve,address indexed creator,address quoteAsset,string name,string symbol,address creatorFeeRecipient,uint256 creatorTaxBps,uint256 holderFeeBps)"
);
const metadataSet = parseAbiItem(
  "event MetadataSet(address indexed token,string description,string image,string website,string twitter,string telegram)"
);
const buyV1 = parseAbiItem(
  "event Buy(address indexed trader,uint256 quoteIn,uint256 tokensOut,uint256 fee)"
);
const sellV1 = parseAbiItem(
  "event Sell(address indexed trader,uint256 tokensIn,uint256 quoteOut,uint256 fee)"
);
const buyV2 = parseAbiItem(
  "event Buy(address indexed trader,address indexed recipient,uint256 quoteIn,uint256 tokensOut,uint256 fee)"
);
const sellV2 = parseAbiItem(
  "event Sell(address indexed trader,address indexed recipient,uint256 tokensIn,uint256 quoteOut,uint256 fee)"
);
const graduationSwept = parseAbiItem(
  "event GraduationSwept(address indexed token,uint256 quoteAmount,uint256 tokenAmount)"
);
const tokenGraduated = parseAbiItem(
  "event TokenGraduated(address indexed token,address indexed pool,uint256 positionId)"
);
const graduationPriceLocked = parseAbiItem(
  "event GraduationPriceLocked(address indexed token,uint160 sqrtPriceX96)"
);
const dexSwap = parseAbiItem(
  "event Swap(address indexed trader,address indexed pool,address indexed tokenIn,uint256 amountIn,uint256 amountOut,address recipient)"
);
const v4PoolCreated = parseAbiItem(
  "event V4PoolCreated(address indexed handle,bytes32 indexed poolId,address indexed token,address quoteAsset,uint160 sqrtPriceX96,uint128 liquidity,uint256 positionId)"
);
const transfer = parseAbiItem(
  "event Transfer(address indexed from,address indexed to,uint256 value)"
);
const buybackExecuted = parseAbiItem(
  "event BuybackExecuted(address indexed venue,address indexed token,address indexed quoteAsset,uint256 quoteSpent,uint256 tokensBurned,bool postGraduation)"
);
const orderPlaced = parseAbiItem(
  "event OrderPlaced(uint256 indexed orderId,address indexed owner,address indexed curve,uint8 side,uint256 amountIn,uint256 minAmountOut)"
);
const orderCancelled = parseAbiItem("event OrderCancelled(uint256 indexed orderId)");
const orderFilled = parseAbiItem("event OrderFilled(uint256 indexed orderId,uint256 amountOut)");

const chainId = Number(process.env.ARC_CHAIN_ID ?? "5042002");
const legacyFactory = process.env.FACTORY_ADDRESS as Address | undefined;
const celestialFactory = process.env.CELESTIAL_FACTORY_ADDRESS as Address | undefined;
const orderBook = process.env.ORDERBOOK_ADDRESS as Address | undefined;
const buybackVault = process.env.BUYBACK_VAULT_ADDRESS as Address | undefined;
const dexAdapter = process.env.CELESTIAL_DEX_ADAPTER_ADDRESS as Address | undefined;
const dexConnector = process.env.CELESTIAL_DEX_CONNECTOR_ADDRESS as Address | undefined;

const MAINNET_DEPLOYMENT_START = 21_158_170n;
const configuredLegacyStart = BigInt(process.env.FACTORY_START_BLOCK ?? "0");
const configuredCelestialStart = BigInt(
  process.env.CELESTIAL_FACTORY_START_BLOCK ??
    (chainId === 5042 ? MAINNET_DEPLOYMENT_START.toString() : process.env.FACTORY_START_BLOCK ?? "0")
);
const batchSize = BigInt(process.env.INDEXER_BLOCK_BATCH ?? "500");
const pollIntervalMs = Number(process.env.ARC_POLLING_INTERVAL_MS ?? "5000");
const cursorKey = `arc-core-v2:${chainId}:${(celestialFactory ?? legacyFactory ?? "none").toLowerCase()}`;

function hexToBuffer(value: string) {
  return Buffer.from(value.slice(2), "hex");
}

function bufferToAddress(value: Buffer) {
  return getAddress(`0x${Buffer.from(value).toString("hex")}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRpcError(error: unknown) {
  const message = String((error as any)?.shortMessage ?? (error as any)?.message ?? error).toLowerCase();
  const details = String((error as any)?.details ?? "").toLowerCase();
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  return (
    code === -32005 ||
    code === -32000 ||
    message.includes("rate limit") ||
    message.includes("exceeds defined limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    details.includes("rate limit")
  );
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

async function rangeLogs(args: {
  address: Address;
  event: any;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<any[]> {
  if (args.fromBlock > args.toBlock) return [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await client.getLogs(args as any) as any[];
    } catch (error) {
      if (!isRetryableRpcError(error)) throw error;
      if (args.fromBlock < args.toBlock) {
        const middle = (args.fromBlock + args.toBlock) / 2n;
        const left = await rangeLogs({ ...args, toBlock: middle });
        const right = await rangeLogs({ ...args, fromBlock: middle + 1n });
        return [...left, ...right];
      }
      if (attempt === 4) throw error;
      await sleep(Math.min(5_000, 400 * 2 ** attempt));
    }
  }
  return [];
}

async function storeLaunchV1(log: any) {
  const { token, curve, creator, name, symbol } = log.args;
  if (!token || !curve || !creator) return;
  await db.query(
    `insert into tokens
      (address, curve_address, creator, name, symbol, created_block, created_at, status, generation)
     values ($1,$2,$3,$4,$5,$6,$7,'ACTIVE','V1')
     on conflict (address) do update set
       curve_address=excluded.curve_address,
       creator=excluded.creator,
       name=excluded.name,
       symbol=excluded.symbol`,
    [hexToBuffer(token), hexToBuffer(curve), hexToBuffer(creator), name, symbol,
      log.blockNumber.toString(), await blockTime(log.blockNumber)]
  );
}

async function storeLaunchV2(log: any) {
  const { token, curve, creator, quoteAsset, name, symbol, creatorFeeRecipient, creatorTaxBps, holderFeeBps } = log.args;
  if (!token || !curve || !creator || !quoteAsset) return;
  await db.query(
    `insert into tokens
      (address, curve_address, creator, name, symbol, created_block, created_at, status,
       generation, quote_asset, creator_fee_recipient, creator_tax_bps, holder_fee_bps)
     values ($1,$2,$3,$4,$5,$6,$7,'ACTIVE','CELESTIAL',$8,$9,$10,$11)
     on conflict (address) do update set
       curve_address=excluded.curve_address,
       creator=excluded.creator,
       name=excluded.name,
       symbol=excluded.symbol,
       generation='CELESTIAL',
       quote_asset=excluded.quote_asset,
       creator_fee_recipient=excluded.creator_fee_recipient,
       creator_tax_bps=excluded.creator_tax_bps,
       holder_fee_bps=excluded.holder_fee_bps`,
    [
      hexToBuffer(token), hexToBuffer(curve), hexToBuffer(creator), name, symbol,
      log.blockNumber.toString(), await blockTime(log.blockNumber), hexToBuffer(quoteAsset),
      hexToBuffer(creatorFeeRecipient ?? creator), Number(creatorTaxBps ?? 0n), Number(holderFeeBps ?? 0n)
    ]
  );
}

async function storeMetadata(log: any) {
  const { token, description, image, website, twitter, telegram } = log.args;
  if (!token) return;
  await db.query(
    `update tokens set description=$2,image=$3,website=$4,twitter=$5,telegram=$6 where address=$1`,
    [hexToBuffer(token), description ?? "", image ?? "", website ?? "", twitter ?? "", telegram ?? ""]
  );
}

async function storeTrade(token: Address, side: "BUY" | "SELL", log: any) {
  const args = log.args;
  const tokenAmount = side === "BUY" ? args.tokensOut : args.tokensIn;
  const quoteAmount = side === "BUY" ? args.quoteIn : args.quoteOut;
  if (!args.trader || tokenAmount === undefined || quoteAmount === undefined) return;
  await db.query(
    `insert into trades
      (tx_hash,log_index,block_number,block_time,token,trader,side,token_amount,quote_amount,fee_amount)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (tx_hash,log_index) do nothing`,
    [hexToBuffer(log.transactionHash), log.logIndex, log.blockNumber.toString(), await blockTime(log.blockNumber),
      hexToBuffer(token), hexToBuffer(args.trader), side, tokenAmount.toString(), quoteAmount.toString(),
      (args.fee ?? 0n).toString()]
  );
}

async function storeTransfer(token: Address, log: any) {
  const { from, to, value } = log.args;
  if (!from || !to || value === undefined) return;
  await db.query(
    `insert into transfers
      (tx_hash,log_index,block_number,block_time,token,from_addr,to_addr,amount)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (tx_hash,log_index) do nothing`,
    [hexToBuffer(log.transactionHash), log.logIndex, log.blockNumber.toString(), await blockTime(log.blockNumber),
      hexToBuffer(token), hexToBuffer(from), hexToBuffer(to), value.toString()]
  );
}

async function storeDexSwap(log: any) {
  const { trader, pool, tokenIn, amountIn, amountOut } = log.args;
  if (!trader || !pool || !tokenIn || amountIn === undefined || amountOut === undefined) return;
  const market = await db.query(`select address,quote_asset from tokens where pool_address=$1 limit 1`, [hexToBuffer(pool)]);
  if (!market.rowCount || !market.rows[0].quote_asset) return;
  const token = `0x${Buffer.from(market.rows[0].address).toString("hex")}`;
  const quoteAsset = `0x${Buffer.from(market.rows[0].quote_asset).toString("hex")}`;
  const isSell = tokenIn.toLowerCase() === token.toLowerCase();
  if (!isSell && tokenIn.toLowerCase() !== quoteAsset.toLowerCase()) return;
  await db.query(
    `insert into trades
      (tx_hash,log_index,block_number,block_time,token,trader,side,token_amount,quote_amount,fee_amount,venue)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'0','UNISWAP_V4')
     on conflict (tx_hash,log_index) do nothing`,
    [hexToBuffer(log.transactionHash), log.logIndex, log.blockNumber.toString(), await blockTime(log.blockNumber),
      market.rows[0].address, hexToBuffer(trader), isSell ? "SELL" : "BUY",
      (isSell ? amountIn : amountOut).toString(), (isSell ? amountOut : amountIn).toString()]
  );
}

async function storeV4Pool(log: any) {
  const { handle, poolId, token, sqrtPriceX96, positionId } = log.args;
  if (!handle || !poolId || !token) return;
  await db.query(
    `update tokens set pool_address=$2,dex_pool_id=$3,graduation_sqrt_price=$4,dex_position_id=$5 where address=$1`,
    [hexToBuffer(token), hexToBuffer(handle), Buffer.from(String(poolId).slice(2), "hex"),
      sqrtPriceX96?.toString() ?? null, positionId?.toString() ?? null]
  );
}

async function storeBuyback(log: any) {
  const { venue, token, quoteAsset, quoteSpent, tokensBurned, postGraduation } = log.args;
  if (!venue || !token || !quoteAsset) return;
  await db.query(
    `insert into buybacks
      (tx_hash,log_index,block_number,block_time,venue,token,quote_asset,quote_spent,tokens_burned,post_graduation)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (tx_hash,log_index) do nothing`,
    [hexToBuffer(log.transactionHash), log.logIndex, log.blockNumber.toString(), await blockTime(log.blockNumber),
      hexToBuffer(venue), hexToBuffer(token), hexToBuffer(quoteAsset), quoteSpent.toString(),
      tokensBurned.toString(), Boolean(postGraduation)]
  );
}

async function storeOrderPlaced(log: any) {
  const { orderId, owner, curve, side, amountIn, minAmountOut } = log.args;
  if (orderId === undefined || !owner || !curve) return;
  const time = await blockTime(log.blockNumber);
  await db.query(
    `insert into limit_orders
      (order_id,owner,curve,side,amount_in,min_amount_out,status,created_at,updated_at)
     values ($1,$2,$3,$4,$5,$6,'OPEN',$7,$7)
     on conflict (order_id) do update set status='OPEN',updated_at=excluded.updated_at`,
    [orderId.toString(), hexToBuffer(owner), hexToBuffer(curve), Number(side) === 0 ? "BUY" : "SELL",
      amountIn.toString(), minAmountOut.toString(), time]
  );
}

async function updateOrderStatus(log: any, status: "FILLED" | "CANCELLED") {
  if (log.args.orderId === undefined) return;
  await db.query(`update limit_orders set status=$2,updated_at=$3 where order_id=$1`,
    [log.args.orderId.toString(), status, await blockTime(log.blockNumber)]);
}

async function applyFactoryRange(factory: Address, generation: "V1" | "CELESTIAL", fromBlock: bigint, toBlock: bigint) {
  const launchEvent = generation === "CELESTIAL" ? tokenCreatedV2 : tokenCreatedV1;
  const launches = await rangeLogs({ address: factory, event: launchEvent, fromBlock, toBlock });
  for (const log of launches) {
    if (generation === "CELESTIAL") await storeLaunchV2(log);
    else await storeLaunchV1(log);
  }

  if (generation === "CELESTIAL") {
    const metadata = await rangeLogs({ address: factory, event: metadataSet, fromBlock, toBlock });
    for (const log of metadata) await storeMetadata(log);
  }

  const swept = await rangeLogs({ address: factory, event: graduationSwept, fromBlock, toBlock });
  for (const log of swept) {
    if (log.args.token) await db.query(`update tokens set status='GRADUATING' where address=$1`, [hexToBuffer(log.args.token)]);
  }

  if (generation === "CELESTIAL") {
    const prices = await rangeLogs({ address: factory, event: graduationPriceLocked, fromBlock, toBlock });
    for (const log of prices) {
      if (log.args.token && log.args.sqrtPriceX96 !== undefined) {
        await db.query(`update tokens set graduation_sqrt_price=$2 where address=$1`,
          [hexToBuffer(log.args.token), log.args.sqrtPriceX96.toString()]);
      }
    }
  }

  const graduated = await rangeLogs({ address: factory, event: tokenGraduated, fromBlock, toBlock });
  for (const log of graduated) {
    if (log.args.token && log.args.pool) {
      await db.query(`update tokens set status='GRADUATED',pool_address=$2 where address=$1`,
        [hexToBuffer(log.args.token), hexToBuffer(log.args.pool)]);
    }
  }
}

async function applyMarketsRange(fromBlock: bigint, toBlock: bigint) {
  const result = await db.query(`select address,curve_address,generation from tokens where created_block <= $1 order by created_block asc`, [toBlock.toString()]);
  for (const row of result.rows) {
    const token = bufferToAddress(row.address);
    const curve = bufferToAddress(row.curve_address);
    const celestial = row.generation === "CELESTIAL";
    const buys = await rangeLogs({ address: curve, event: celestial ? buyV2 : buyV1, fromBlock, toBlock });
    for (const log of buys) await storeTrade(token, "BUY", log);
    const sells = await rangeLogs({ address: curve, event: celestial ? sellV2 : sellV1, fromBlock, toBlock });
    for (const log of sells) await storeTrade(token, "SELL", log);
    const transfers = await rangeLogs({ address: token, event: transfer, fromBlock, toBlock });
    for (const log of transfers) await storeTransfer(token, log);
  }
}

async function applyAuxiliaryRange(fromBlock: bigint, toBlock: bigint) {
  if (buybackVault) {
    const logs = await rangeLogs({ address: buybackVault, event: buybackExecuted, fromBlock, toBlock });
    for (const log of logs) await storeBuyback(log);
  }
  if (dexAdapter) {
    const logs = await rangeLogs({ address: dexAdapter, event: dexSwap, fromBlock, toBlock });
    for (const log of logs) await storeDexSwap(log);
  }
  if (dexConnector) {
    const logs = await rangeLogs({ address: dexConnector, event: v4PoolCreated, fromBlock, toBlock });
    for (const log of logs) await storeV4Pool(log);
  }
  if (orderBook) {
    const placed = await rangeLogs({ address: orderBook, event: orderPlaced, fromBlock, toBlock });
    for (const log of placed) await storeOrderPlaced(log);
    const cancelled = await rangeLogs({ address: orderBook, event: orderCancelled, fromBlock, toBlock });
    for (const log of cancelled) await updateOrderStatus(log, "CANCELLED");
    const filled = await rangeLogs({ address: orderBook, event: orderFilled, fromBlock, toBlock });
    for (const log of filled) await updateOrderStatus(log, "FILLED");
  }
}

async function indexRange(fromBlock: bigint, toBlock: bigint) {
  if (legacyFactory) await applyFactoryRange(legacyFactory, "V1", fromBlock, toBlock);
  if (celestialFactory) await applyFactoryRange(celestialFactory, "CELESTIAL", fromBlock, toBlock);
  await applyMarketsRange(fromBlock, toBlock);
  await applyAuxiliaryRange(fromBlock, toBlock);
}

async function loadCursor(startBlock: bigint) {
  const result = await db.query(`select block_number from indexer_cursors where key=$1 limit 1`, [cursorKey]);
  if (!result.rowCount) return startBlock - 1n;
  const stored = BigInt(result.rows[0].block_number);
  return stored < startBlock - 1n ? startBlock - 1n : stored;
}

async function saveCursor(blockNumber: bigint) {
  await db.query(
    `insert into indexer_cursors(key,block_number,updated_at) values ($1,$2,now())
     on conflict (key) do update set block_number=excluded.block_number,updated_at=now()`,
    [cursorKey, blockNumber.toString()]
  );
}

function resolveStartBlock(head: bigint) {
  const candidates: bigint[] = [];
  if (legacyFactory) candidates.push(configuredLegacyStart);
  if (celestialFactory) candidates.push(configuredCelestialStart);
  let start = candidates.length ? candidates.reduce((a, b) => a < b ? a : b) : 0n;
  if (chainId === 5042 && (start <= 0n || start > head)) {
    console.warn(`Invalid Arc Mainnet indexer start block ${start}; using ${MAINNET_DEPLOYMENT_START}`);
    start = MAINNET_DEPLOYMENT_START;
  }
  return start;
}

export async function startEventIngestion() {
  if (!legacyFactory && !celestialFactory) throw new Error("FACTORY_ADDRESS or CELESTIAL_FACTORY_ADDRESS is required");

  const initialHead = await client.getBlockNumber();
  const startBlock = resolveStartBlock(initialHead);
  let cursor = await loadCursor(startBlock);
  console.log(`Arc stateless indexer cursor ${cursor} -> ${initialHead}; start ${startBlock}; batch ${batchSize}`);

  const catchUp = async () => {
    const head = await client.getBlockNumber();
    while (cursor < head) {
      const fromBlock = cursor + 1n;
      const toBlock = fromBlock + batchSize - 1n > head ? head : fromBlock + batchSize - 1n;
      await indexRange(fromBlock, toBlock);
      cursor = toBlock;
      await saveCursor(cursor);
      console.log(`Arc indexer processed blocks ${fromBlock}-${toBlock}`);
    }
  };

  await catchUp();

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await catchUp();
    } catch (error) {
      console.error("Arc stateless poll failed", error);
    } finally {
      running = false;
    }
  }, Math.max(1_000, pollIntervalMs));
  timer.unref();
}
