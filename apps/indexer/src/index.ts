import { client } from "./context.js";
import { startEventIngestion } from "./events.js";

async function main() {
  const block = await client.getBlockNumber();
  console.log(`Arc indexer connected at block ${block}`);
  await startEventIngestion();
  console.log("Arc event ingestion started");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
