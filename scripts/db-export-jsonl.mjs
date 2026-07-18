/**
 * NOT A DISASTER-RECOVERY BACKUP
 *
 * Optional Node/JSONL data export for debugging. Never use for restore/DR.
 *
 * Usage: npm run db:export:jsonl
 */
import { createWriteStream, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import dotenv from "dotenv";
import pg from "pg";
import {
  connectionUrlToLibpqEnv,
  sanitizeBackupLog,
  RECOVERY_STATUS,
} from "./db-backup-lib.mjs";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path, quiet: true });
}

const connection =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!connection) {
  console.error("[db-export:jsonl] DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const parsed = connectionUrlToLibpqEnv(connection);
if (!parsed.ok) {
  console.error(`[db-export:jsonl] ${parsed.reason}`);
  process.exit(1);
}

const outDir = resolve(process.cwd(), ".backups");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(outDir, `wexon-export-${stamp}.jsonl.gz`);
const metaPath = join(outDir, `wexon-export-meta-${stamp}.json`);

console.warn(`[db-export:jsonl] ${RECOVERY_STATUS.NOT_DISASTER_RECOVERY}`);
console.warn("[db-export:jsonl] This output must not be used for disaster recovery.");

const client = new pg.Client({
  connectionString: connection,
  ssl: parsed.ssl ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  const tablesRes = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const gzip = createGzip();
  const out = createWriteStream(outFile);
  const done = pipeline(gzip, out);

  for (const { table_name } of tablesRes.rows) {
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${String(table_name).replace(/"/g, '""')}"`,
    );
    const n = countRes.rows[0]?.n ?? 0;
    gzip.write(`${JSON.stringify({ type: "table", table: table_name, rowCount: n })}\n`);

    const batchSize = 500;
    let offset = 0;
    while (offset < n) {
      const rowsRes = await client.query(
        `SELECT * FROM public."${String(table_name).replace(/"/g, '""')}" ORDER BY ctid LIMIT $1 OFFSET $2`,
        [batchSize, offset],
      );
      for (const row of rowsRes.rows) {
        gzip.write(`${JSON.stringify({ type: "row", table: table_name, row })}\n`);
      }
      offset += batchSize;
    }
  }

  gzip.end();
  await done;

  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        method: "node-pg-jsonl",
        format: "jsonl",
        basename: outFile.split(/[/\\]/).pop(),
        bytes: statSync(outFile).size,
        recoveryStatus: RECOVERY_STATUS.NOT_DISASTER_RECOVERY,
        note: RECOVERY_STATUS.NOT_DISASTER_RECOVERY,
      },
      null,
      2,
    ),
  );

  console.log(`[db-export:jsonl] wrote ${outFile.split(/[/\\]/).pop()} (${statSync(outFile).size} bytes)`);
  console.log(`[db-export:jsonl] ${RECOVERY_STATUS.NOT_DISASTER_RECOVERY}`);
} catch (error) {
  console.error(
    "[db-export:jsonl] FAILED:",
    sanitizeBackupLog(error instanceof Error ? error.message : String(error)),
  );
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
