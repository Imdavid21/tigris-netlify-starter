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

const legacyFactory = process.env.FACTORY_ADDRESS as Address | undefined;
const celestialFactory = process.env.CELESTIAL_FACTORY_ADDRESS as Address | undefined;
const orderBook = process.env.ORDERBOOK_ADDRESS as Address | undefined;
const buybackVault = process.env.BUYBACK_VAULT_ADDRESS as Address | undefined;
const dexAdapter = process.env.CELESTIAL_DEX_ADAPTER_ADDRESS as Address | undefined;
const dexConnector = process.env.CELESTIAL_DEX_CONNECTOR_ADDRESS as Address | undefined;

const legacyStartBlock = BigInt(process.env.FACTORY_START_BLOCK ?? "0");
const celestialStartBlock = BigInt(process.env.CELESTIAL_FACTORY_START_BLOCK ?? process.env.FACTORY_START_BLOCK ?? "0");

const watchedCurves = new Set<string>();
const watchedTokens = new Set<string>();

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

function isRpcLimitError(error: unknown) {
  const message = String((error as any)?.shortMessage ?? (error as any)?.message ?? error).toLowerCase();
  const details = String((error as any)?.details ?? "").toLowerCase();
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  return code === -32005 || message.includes("rate limit") || message.includes("exceeds defined limit") || details.includes("rate limit");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chunkedLogs(args: {
  address: Address;
  event: any;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const logs: any[] = [];
  const configured = BigInt(process.env.LOG_CHUNK_SIZE ?? "500");
  const minChunk = 5n;
  let chunk = configured > 0n ? configured : 500n;
  let from = args.fromBlock;

  while (from <= args.toBlock) {
    let to = from + chunk - 1n > args.toBlock ? args.toBlock : from + chunk - 1n;
    let attempt = 0;

    for (;;) {
      try {
        const batch = await client.getLogs({
          address: args.address,
          event: args.event,
          fromBlock: from,
          toBlock: to
        });
        logs.push(...batch);
        break;
      } catch (error) {
        if (!isRpcLimitError(error)) throw error;

        attempt += 1;
        if (chunk > minChunk) {
          chunk = chunk / 2n < minChunk ? minChunk : chunk / 2n;
          to = from + chunk - 1n > args.toBlock ? args.toBlock : from + chunk - 1n;
        }

        if (attempt > 8) {
          console.warn(`Arc RPC still rate limited for blocks ${from}-${to}; cooling down before retry`);
          attempt = 0;
          await sleep(30_000);
          continue;
        }
        await sleep(Math.min(8_000, 750 * 2 ** Math.min(attempt, 4)));
      }
    }

    from = to + 1n;
    await sleep(125);
  }

  return logs;
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

  await attachMarket(getAddress(curve), getAddress(token), log.blockNumber, "V1");
}

async function storeLaunchV2(log: any) {
  const {
    token,
    curve,
    creator,
    quoteAsset,
    name,
    symbol,
    creatorFeeRecipient,
    creatorTaxBps,
    holderFeeBps
  } = log.args;

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
      hexToBuffer(token),
      hexToBuffer(curve),
      hexToBuffer(creator),
      name,
      symbol,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber),
      hexToBuffer(quoteAsset),
      hexToBuffer(creatorFeeRecipient ?? creator),
      Number(creatorTaxBps ?? 0n),
      Number(holderFeeBps ?? 0n)
    ]
  );

  await attachMarket(getAddress(curve), getAddress(token), log.blockNumber, "CELESTIAL");
}

async function storeMetadata(log: any) {
  const { token, description, image, website, twitter, telegram } = log.args;
  if (!token) return;

  await db.query(
    `update tokens
     set description=$2, image=$3, website=$4, twitter=$5, telegram=$6
     where address=$1`,
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
      (args.fee ?? 0n).toString()
    ]
  );
}

async function storeDexSwap(log: any) {
  const { trader, pool, tokenIn, amountIn, amountOut } = log.args;
  if (!trader || !pool || !tokenIn || amountIn === undefined || amountOut === undefined) return;

  const market = await db.query(
    `select address, quote_asset from tokens where pool_address=$1 limit 1`,
    [hexToBuffer(pool)]
  );
  if (!market.rowCount || !market.rows[0].quote_asset) return;

  const token = "0x" + Buffer.from(market.rows[0].address).toString("hex");
  const quoteAsset = "0x" + Buffer.from(market.rows[0].quote_asset).toString("hex");
  const isSell = tokenIn.toLowerCase() === token.toLowerCase();
  const side = isSell ? "SELL" : "BUY";
  const tokenAmount = isSell ? amountIn : amountOut;
  const quoteAmount = isSell ? amountOut : amountIn;

  if (!isSell && tokenIn.toLowerCase() !== quoteAsset.toLowerCase()) return;

  await db.query(
    `insert into trades
     (tx_hash, log_index, block_number, block_time, token, trader, side, token_amount, quote_amount, fee_amount, venue)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'0','UNISWAP_V4')
     on conflict (tx_hash,log_index) do nothing`,
    [
      hexToBuffer(log.transactionHash),
      log.logIndex,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber),
      market.rows[0].address,
      hexToBuffer(trader),
      side,
      tokenAmount.toString(),
      quoteAmount.toString()
    ]
  );
}

async function storeV4Pool(log: any) {
  const { handle, poolId, token, sqrtPriceX96, positionId } = log.args;
  if (!handle || !poolId || !token) return;
  await db.query(
    `update tokens
     set pool_address=$2, dex_pool_id=$3, graduation_sqrt_price=$4, dex_position_id=$5
     where address=$1`,
    [
      hexToBuffer(token),
      hexToBuffer(handle),
      Buffer.from(String(poolId).slice(2), "hex"),
      sqrtPriceX96?.toString() ?? null,
      positionId?.toString() ?? null
    ]
  );
}

async function storeTransfer(token: Address, log: any) {
  const { from, to, value } = log.args;
  if (!from || !to || value === undefined) return;

  await db.query(
    `insert into transfers
     (tx_hash, log_index, block_number, block_time, token, from_addr, to_addr, amount)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (tx_hash,log_index) do nothing`,
    [
      hexToBuffer(log.transactionHash),
      log.logIndex,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber),
      hexToBuffer(token),
      hexToBuffer(from),
      hexToBuffer(to),
      value.toString()
    ]
  );
}

async function storeBuyback(log: any) {
  const { venue, token, quoteAsset, quoteSpent, tokensBurned, postGraduation } = log.args;
  if (!venue || !token || !quoteAsset) return;

  await db.query(
    `insert into buybacks
      (tx_hash, log_index, block_number, block_time, venue, token, quote_asset, quote_spent, tokens_burned, post_graduation)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (tx_hash,log_index) do nothing`,
    [
      hexToBuffer(log.transactionHash),
      log.logIndex,
      log.blockNumber.toString(),
      await blockTime(log.blockNumber),
      hexToBuffer(venue),
      hexToBuffer(token),
      hexToBuffer(quoteAsset),
      quoteSpent.toString(),
      tokensBurned.toString(),
      Boolean(postGraduation)
    ]
  );
}

async function storeOrderPlaced(log: any) {
  const { orderId, owner, curve, side, amountIn, minAmountOut } = log.args;
  if (orderId === undefined || !owner || !curve) return;
  await db.query(
    `insert into limit_orders
      (order_id, owner, curve, side, amount_in, min_amount_out, status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,'OPEN',$7,$7)
     on conflict (order_id) do update set status='OPEN', updated_at=excluded.updated_at`,
    [
      orderId.toString(),
      hexToBuffer(owner),
      hexToBuffer(curve),
      Number(side) === 0 ? "BUY" : "SELL",
      amountIn.toString(),
      minAmountOut.toString(),
      await blockTime(log.blockNumber)
    ]
  );
}

async function updateOrderStatus(log: any, status: "FILLED" | "CANCELLED") {
  const { orderId } = log.args;
  if (orderId === undefined) return;
  await db.query(
    "update limit_orders set status=$2, updated_at=$3 where order_id=$1",
    [orderId.toString(), status, await blockTime(log.blockNumber)]
  );
}

async function backfillToken(token: Address, fromBlock: bigint) {
  const toBlock = await client.getBlockNumber();
  const transfers = await chunkedLogs({ address: token, event: transfer, fromBlock, toBlock });
  for (const log of transfers) await storeTransfer(token, log);
}

async function backfillCurve(curve: Address, token: Address, fromBlock: bigint, generation: "V1" | "CELESTIAL") {
  const toBlock = await client.getBlockNumber();
  const buyEvent = generation === "CELESTIAL" ? buyV2 : buyV1;
  const sellEvent = generation === "CELESTIAL" ? sellV2 : sellV1;

  const [buys, sells] = await Promise.all([
    chunkedLogs({ address: curve, event: buyEvent, fromBlock, toBlock }),
    chunkedLogs({ address: curve, event: sellEvent, fromBlock, toBlock })
  ]);

  for (const log of buys) await storeTrade(token, "BUY", log);
  for (const log of sells) await storeTrade(token, "SELL", log);
}

async function attachMarket(
  curve: Address,
  token: Address,
  fromBlock: bigint,
  generation: "V1" | "CELESTIAL"
) {
  await Promise.all([
    backfillCurve(curve, token, fromBlock, generation),
    backfillToken(token, fromBlock)
  ]);
  watchCurve(curve, token, generation);
  watchToken(token);
}

async function applyGraduationState(factory: Address, fromBlock: bigint) {
  const toBlock = await client.getBlockNumber();
  const [swept, graduated, prices] = await Promise.all([
    chunkedLogs({ address: factory, event: graduationSwept, fromBlock, toBlock }),
    chunkedLogs({ address: factory, event: tokenGraduated, fromBlock, toBlock }),
    chunkedLogs({ address: factory, event: graduationPriceLocked, fromBlock, toBlock }).catch(() => [])
  ]);

  for (const log of swept) {
    if (log.args.token) {
      await db.query("update tokens set status='GRADUATING' where address=$1", [
        hexToBuffer(log.args.token)
      ]);
    }
  }

  for (const log of prices) {
    if (log.args.token && log.args.sqrtPriceX96 !== undefined) {
      await db.query(
        "update tokens set graduation_sqrt_price=$2 where address=$1",
        [hexToBuffer(log.args.token), log.args.sqrtPriceX96.toString()]
      );
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

async function backfillLegacyFactory() {
  if (!legacyFactory) return;
  const toBlock = await client.getBlockNumber();
  const launches = await chunkedLogs({
    address: legacyFactory,
    event: tokenCreatedV1,
    fromBlock: legacyStartBlock,
    toBlock
  });
  for (const log of launches) await storeLaunchV1(log);
  await applyGraduationState(legacyFactory, legacyStartBlock);
}

async function backfillCelestialFactory() {
  if (!celestialFactory) return;
  const toBlock = await client.getBlockNumber();
  const [launches, metadata] = await Promise.all([
    chunkedLogs({
      address: celestialFactory,
      event: tokenCreatedV2,
      fromBlock: celestialStartBlock,
      toBlock
    }),
    chunkedLogs({
      address: celestialFactory,
      event: metadataSet,
      fromBlock: celestialStartBlock,
      toBlock
    })
  ]);
  for (const log of launches) await storeLaunchV2(log);
  for (const log of metadata) await storeMetadata(log);
  await applyGraduationState(celestialFactory, celestialStartBlock);
}

async function backfillAuxiliary() {
  const toBlock = await client.getBlockNumber();

  if (buybackVault) {
    const logs = await chunkedLogs({
      address: buybackVault,
      event: buybackExecuted,
      fromBlock: celestialStartBlock,
      toBlock
    });
    for (const log of logs) await storeBuyback(log);
  }

  if (dexAdapter) {
    const logs = await chunkedLogs({
      address: dexAdapter,
      event: dexSwap,
      fromBlock: celestialStartBlock,
      toBlock
    });
    for (const log of logs) await storeDexSwap(log);
  }

  if (dexConnector) {
    const logs = await chunkedLogs({
      address: dexConnector,
      event: v4PoolCreated,
      fromBlock: celestialStartBlock,
      toBlock
    });
    for (const log of logs) await storeV4Pool(log);
  }

  if (orderBook) {
    const [placed, cancelled, filled] = await Promise.all([
      chunkedLogs({ address: orderBook, event: orderPlaced, fromBlock: celestialStartBlock, toBlock }),
      chunkedLogs({ address: orderBook, event: orderCancelled, fromBlock: celestialStartBlock, toBlock }),
      chunkedLogs({ address: orderBook, event: orderFilled, fromBlock: celestialStartBlock, toBlock })
    ]);
    for (const log of placed) await storeOrderPlaced(log);
    for (const log of cancelled) await updateOrderStatus(log, "CANCELLED");
    for (const log of filled) await updateOrderStatus(log, "FILLED");
  }
}

function watchToken(token: Address) {
  const key = token.toLowerCase();
  if (watchedTokens.has(key)) return;
  watchedTokens.add(key);
  client.watchEvent({
    address: token,
    event: transfer,
    onLogs: async (logs) => {
      for (const log of logs) await storeTransfer(token, log);
    },
    onError: console.error
  });
}

function watchCurve(curve: Address, token: Address, generation: "V1" | "CELESTIAL") {
  const key = curve.toLowerCase();
  if (watchedCurves.has(key)) return;
  watchedCurves.add(key);

  const buyEvent = generation === "CELESTIAL" ? buyV2 : buyV1;
  const sellEvent = generation === "CELESTIAL" ? sellV2 : sellV1;

  client.watchEvent({
    address: curve,
    event: buyEvent,
    onLogs: async (logs) => {
      for (const log of logs) await storeTrade(token, "BUY", log);
    },
    onError: console.error
  });

  client.watchEvent({
    address: curve,
    event: sellEvent,
    onLogs: async (logs) => {
      for (const log of logs) await storeTrade(token, "SELL", log);
    },
    onError: console.error
  });
}

function watchFactory(factory: Address, generation: "V1" | "CELESTIAL") {
  client.watchEvent({
    address: factory,
    event: generation === "CELESTIAL" ? tokenCreatedV2 : tokenCreatedV1,
    onLogs: async (logs) => {
      for (const log of logs) {
        if (generation === "CELESTIAL") await storeLaunchV2(log);
        else await storeLaunchV1(log);
      }
    },
    onError: console.error
  });

  if (generation === "CELESTIAL") {
    client.watchEvent({
      address: factory,
      event: metadataSet,
      onLogs: async (logs) => {
        for (const log of logs) await storeMetadata(log);
      },
      onError: console.error
    });
  }

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

  if (generation === "CELESTIAL") {
    client.watchEvent({
      address: factory,
      event: graduationPriceLocked,
      onLogs: async (logs) => {
        for (const log of logs) {
          if (!log.args.token || log.args.sqrtPriceX96 === undefined) continue;
          await db.query(
            "update tokens set graduation_sqrt_price=$2 where address=$1",
            [hexToBuffer(log.args.token), log.args.sqrtPriceX96.toString()]
          );
        }
      },
      onError: console.error
    });
  }

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

function watchAuxiliary() {
  if (dexAdapter) {
    client.watchEvent({
      address: dexAdapter,
      event: dexSwap,
      onLogs: async (logs) => {
        for (const log of logs) await storeDexSwap(log);
      },
      onError: console.error
    });
  }

  if (dexConnector) {
    client.watchEvent({
      address: dexConnector,
      event: v4PoolCreated,
      onLogs: async (logs) => {
        for (const log of logs) await storeV4Pool(log);
      },
      onError: console.error
    });
  }

  if (buybackVault) {
    client.watchEvent({
      address: buybackVault,
      event: buybackExecuted,
      onLogs: async (logs) => {
        for (const log of logs) await storeBuyback(log);
      },
      onError: console.error
    });
  }

  if (orderBook) {
    client.watchEvent({
      address: orderBook,
      event: orderPlaced,
      onLogs: async (logs) => {
        for (const log of logs) await storeOrderPlaced(log);
      },
      onError: console.error
    });
    client.watchEvent({
      address: orderBook,
      event: orderCancelled,
      onLogs: async (logs) => {
        for (const log of logs) await updateOrderStatus(log, "CANCELLED");
      },
      onError: console.error
    });
    client.watchEvent({
      address: orderBook,
      event: orderFilled,
      onLogs: async (logs) => {
        for (const log of logs) await updateOrderStatus(log, "FILLED");
      },
      onError: console.error
    });
  }
}

export async function startEventIngestion() {
  if (!legacyFactory && !celestialFactory) {
    throw new Error("FACTORY_ADDRESS or CELESTIAL_FACTORY_ADDRESS is required");
  }

  await Promise.all([backfillLegacyFactory(), backfillCelestialFactory()]);
  await backfillAuxiliary();

  if (legacyFactory) watchFactory(legacyFactory, "V1");
  if (celestialFactory) watchFactory(celestialFactory, "CELESTIAL");
  watchAuxiliary();
}
