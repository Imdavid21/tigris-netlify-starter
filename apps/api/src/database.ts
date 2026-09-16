import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export const databaseSchema = (process.env.DATABASE_SCHEMA ?? "public").trim();
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseSchema)) {
  throw new Error("DATABASE_SCHEMA must be a valid PostgreSQL identifier");
}

const chainId = Number(process.env.ARC_CHAIN_ID ?? "5042002");
if (chainId === 5042 && databaseSchema === "public") {
  throw new Error("Arc mainnet must use an isolated DATABASE_SCHEMA, not public");
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function prepareDatabaseSchema() {
  if (databaseSchema === "public") return;
  const bootstrap = new pg.Client({ connectionString: databaseUrl });
  await bootstrap.connect();
  try {
    await bootstrap.query(`create schema if not exists ${quoteIdentifier(databaseSchema)}`);
  } finally {
    await bootstrap.end();
  }
}

export function createDatabasePool() {
  return new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${databaseSchema}`
  });
}
