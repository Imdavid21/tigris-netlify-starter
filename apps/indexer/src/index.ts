import http from "node:http";
import { client, db } from "./context.js";
import { startEventIngestion } from "./events.js";
import { schemaSql } from "./schema.js";

async function main() {
  await db.query(schemaSql);

  const block = await client.getBlockNumber();
  console.log(`Arc indexer connected at block ${block}`);

  await startEventIngestion();
  console.log("Arc event ingestion started");

  const port = Number(process.env.PORT ?? 10000);
  http
    .createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, latestBlock: block.toString() }));
        return;
      }
      res.writeHead(404);
      res.end();
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`Indexer health server listening on ${port}`);
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
