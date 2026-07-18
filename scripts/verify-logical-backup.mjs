/**
 * Verify a Node+pg logical backup (.jsonl.gz) against live DB counts (read-only).
 * Usage: node scripts/verify-logical-backup.mjs .backups/wexon-full-....jsonl.gz
 */
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { resolve } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path, quiet: true });
}

const backupPath = process.argv[2];
if (!backupPath || !existsSync(backupPath)) {
  console.error("[verify-backup] Usage: node scripts/verify-logical-backup.mjs <file.jsonl.gz>");
  process.exit(1);
}

const connection =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!connection) {
  console.error("[verify-backup] DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

const tableCounts = new Map();
const rowSeen = new Map();

const rl = createInterface({
  input: createReadStream(backupPath).pipe(createGunzip()),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.type === "table") {
    tableCounts.set(obj.table, obj.rowCount);
    rowSeen.set(obj.table, 0);
  } else if (obj.type === "row") {
    rowSeen.set(obj.table, (rowSeen.get(obj.table) || 0) + 1);
  }
}

const client = new pg.Client({
  connectionString: connection,
  ssl:
    connection.includes("supabase.com") || connection.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
});
await client.connect();

let mismatches = 0;
try {
  for (const [table, expected] of tableCounts) {
    const archived = rowSeen.get(table) || 0;
    if (archived !== expected) {
      console.error(`[verify-backup] archive internal mismatch ${table}: header=${expected} rows=${archived}`);
      mismatches += 1;
      continue;
    }
    const live = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${table.replace(/"/g, '""')}"`,
    );
    const n = live.rows[0]?.n ?? -1;
    if (n !== expected) {
      console.error(`[verify-backup] live mismatch ${table}: backup=${expected} live=${n}`);
      mismatches += 1;
    } else {
      console.log(`[verify-backup] OK ${table}=${n}`);
    }
  }
} finally {
  await client.end();
}

if (mismatches > 0) {
  console.error(`[verify-backup] FAILED mismatches=${mismatches}`);
  process.exit(1);
}

console.log(`[verify-backup] OK tables=${tableCounts.size}`);
