/**
 * Logical Postgres backup for Free-plan Supabase (no automated backups).
 *
 * Usage:
 *   node scripts/db-logical-backup.mjs
 *   node scripts/db-logical-backup.mjs --schema-only
 *
 * Requires DIRECT_URL (or DATABASE_URL) in env / .env.local.
 * Prefers local `pg_dump`, then Docker, then Node+pg JSONL fallback.
 * Writes under .backups/ (gitignored). Never prints connection secrets.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import dotenv from "dotenv";
import pg from "pg";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path, quiet: true });
}

const schemaOnly = process.argv.includes("--schema-only");
const connection =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

if (!connection) {
  console.error("[db-logical-backup] DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

let host = "(unknown)";
let role = "(unknown)";
try {
  const u = new URL(connection);
  host = u.hostname;
  role = decodeURIComponent(u.username || "");
} catch {
  console.error("[db-logical-backup] Invalid connection URL.");
  process.exit(1);
}

const outDir = resolve(process.cwd(), ".backups");
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

function sanitize(text) {
  return String(text || "").replace(/postgresql:\/\/[^\s]+/gi, "postgresql://***");
}

function run(command, args, env) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

async function nodeLogicalBackup() {
  const client = new pg.Client({
    connectionString: connection,
    ssl: connection.includes("supabase.com") || connection.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();

  try {
    const tablesRes = await client.query(`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    const rlsRes = await client.query(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    const grantsRes = await client.query(`
      SELECT grantee, COUNT(*)::int AS grant_rows, COUNT(DISTINCT table_name)::int AS tables
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon','authenticated','service_role','postgres')
      GROUP BY grantee
      ORDER BY grantee
    `);

    const migrationsRes = await client.query(`
      SELECT migration_name, finished_at IS NOT NULL AS finished
      FROM public."_prisma_migrations"
      ORDER BY finished_at NULLS LAST
    `);

    const meta = {
      createdAt: new Date().toISOString(),
      host,
      role,
      schemaOnly,
      method: "node-pg-logical",
      tables: tablesRes.rows.map((r) => r.table_name),
      rls: rlsRes.rows,
      grantsSummary: grantsRes.rows,
      prismaMigrations: migrationsRes.rows,
      note: "Node fallback dump. Prefer pg_dump when available. Store off-site; do not commit.",
    };

    const metaPath = resolve(outDir, `wexon-backup-meta-${stamp}.json`);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    if (schemaOnly) {
      const schemaPath = resolve(outDir, `wexon-schema-catalog-${stamp}.json`);
      writeFileSync(
        schemaPath,
        JSON.stringify(
          {
            ...meta,
            columns: (
              await client.query(`
                SELECT table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
              `)
            ).rows,
          },
          null,
          2,
        ),
      );
      console.log("[db-logical-backup] OK (schema catalog via node-pg)");
      console.log(`[db-logical-backup] output=${schemaPath}`);
      console.log(`[db-logical-backup] meta=${metaPath}`);
      return { metaPath, outputFile: schemaPath, bytes: statSync(schemaPath).size, method: meta.method };
    }

    const dataPath = resolve(outDir, `wexon-full-${stamp}.jsonl.gz`);
    const gzip = createGzip();
    const out = createWriteStream(dataPath);
    const done = pipeline(gzip, out);

    for (const { table_name } of tablesRes.rows) {
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS n FROM public."${table_name.replace(/"/g, '""')}"`,
      );
      const n = countRes.rows[0]?.n ?? 0;
      gzip.write(
        `${JSON.stringify({ type: "table", table: table_name, rowCount: n })}\n`,
      );

      // Stream in batches to avoid huge memory spikes.
      const batchSize = 500;
      let offset = 0;
      while (offset < n) {
        const rowsRes = await client.query(
          `SELECT * FROM public."${table_name.replace(/"/g, '""')}" ORDER BY ctid LIMIT $1 OFFSET $2`,
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

    console.log("[db-logical-backup] OK (full logical via node-pg)");
    console.log(`[db-logical-backup] output=${dataPath} bytes=${statSync(dataPath).size}`);
    console.log(`[db-logical-backup] meta=${metaPath}`);
    return { metaPath, outputFile: dataPath, bytes: statSync(dataPath).size, method: meta.method };
  } finally {
    await client.end();
  }
}

const outFile = resolve(
  outDir,
  `wexon-${schemaOnly ? "schema" : "full"}-${stamp}.sql`,
);

console.log("[db-logical-backup] Starting backup");
console.log(`[db-logical-backup] host=${host} role=${role} schemaOnly=${schemaOnly}`);

const dumpArgsBase = ["--no-owner", "--no-acl", "--clean", "--if-exists"];
if (schemaOnly) dumpArgsBase.push("--schema-only");

let result = run("pg_dump", [`--dbname=${connection}`, ...dumpArgsBase, `--file=${outFile}`]);
let method = "pg_dump";

if (result.error || result.status !== 0) {
  console.log("[db-logical-backup] Local pg_dump unavailable; trying Docker");
  method = "docker:postgres:16-alpine";
  result = run("docker", [
    "run",
    "--rm",
    "-v",
    `${outDir}:/backups`,
    "postgres:16-alpine",
    "pg_dump",
    connection,
    ...dumpArgsBase,
    `--file=/backups/${outFile.split(/[/\\]/).pop()}`,
  ]);
}

if (!result.error && result.status === 0 && existsSync(outFile) && statSync(outFile).size >= 32) {
  const metaPath = resolve(outDir, `wexon-backup-meta-${stamp}.json`);
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        host,
        role,
        schemaOnly,
        method,
        bytes: statSync(outFile).size,
        outputFile: outFile,
        note: "Store off-site. Do not commit. Free plan has no automated Supabase backups.",
      },
      null,
      2,
    ),
  );
  console.log("[db-logical-backup] OK");
  console.log(`[db-logical-backup] method=${method} bytes=${statSync(outFile).size}`);
  console.log(`[db-logical-backup] meta=${metaPath}`);
  process.exit(0);
}

console.log("[db-logical-backup] Falling back to Node+pg logical dump");
try {
  await nodeLogicalBackup();
  process.exit(0);
} catch (error) {
  console.error("[db-logical-backup] FAILED:", sanitize(error instanceof Error ? error.message : error));
  process.exit(1);
}
