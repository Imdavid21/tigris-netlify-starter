import http from "node:http";
import { client, db } from "./context.js";
import { prepareDatabaseSchema, databaseSchema } from "./database.js";
import { startEventIngestion } from "./events-polling.js";
import { schemaSql } from "./schema.js";

let latestBlock = 0n;
let ingestionState: "starting" | "backfilling" | "live" | "degraded" = "starting";
let lastIngestionError = "";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startHealthServer() {
  const port = Number(process.env.PORT ?? 10000);
  http
    .createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          ingestion: ingestionState,
          latestBlock: latestBlock.toString(),
          databaseSchema,
          error: lastIngestionError || undefined
        }));
        return;
      }
      res.writeHead(404);
      res.end();
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`Indexer health server listening on ${port}`);
    });
}

async function runIngestionUntilLive() {
  let retry = 0;
  while (ingestionState !== "live") {
    try {
      ingestionState = retry ? "degraded" : "backfilling";
      await startEventIngestion();
      ingestionState = "live";
      lastIngestionError = "";
      console.log("Arc stateless event ingestion is live");
    } catch (error) {
      retry += 1;
      ingestionState = "degraded";
      lastIngestionError = error instanceof Error ? error.message : String(error);
      const waitMs = Math.min(60_000, 5_000 * Math.max(1, retry));
      console.error(`Indexer ingestion attempt ${retry} failed; retrying in ${waitMs}ms`, error);
      await sleep(waitMs);
    }
  }
}

async function main() {
  const expectedChainId = Number(process.env.ARC_CHAIN_ID ?? "5042002");
  const rpcChainId = await client.getChainId();
  if (rpcChainId !== expectedChainId) {
    throw new Error(`RPC chain mismatch: expected ${expectedChainId}, received ${rpcChainId}`);
  }

  await prepareDatabaseSchema();
  await db.query(schemaSql);
  startHealthServer();

  try {
    latestBlock = await client.getBlockNumber();
    console.log(`Arc indexer connected to chain ${rpcChainId} at block ${latestBlock} using database schema ${databaseSchema}`);
  } catch (error) {
    ingestionState = "degraded";
    lastIngestionError = error instanceof Error ? error.message : String(error);
    console.error("Arc RPC unavailable during startup; indexer will keep retrying", error);
  }

  const blockTracker = setInterval(async () => {
    try {
      latestBlock = await client.getBlockNumber();
    } catch {
      // Health should continue to report the last known block.
    }
  }, 10_000);
  blockTracker.unref();

  await runIngestionUntilLive();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
