/**
 * Disaster-recovery logical backup via PostgreSQL 17+ pg_dump custom archive (-Fc).
 *
 * Usage: npm run db:backup
 *
 * Requires DIRECT_URL (preferred) or DATABASE_URL.
 * Credentials are passed only via PG* env vars — never on argv.
 * Fails closed if pg_dump major < 17 or older than the source server.
 * Does NOT fall back to Node/JSONL.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { resolve, basename, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import {
  connectionUrlToLibpqEnv,
  evaluatePgDumpVersionGate,
  parsePostgresMajorVersion,
  sanitizeBackupLog,
  RECOVERY_STATUS,
  EXPECTED_PUBLIC_TABLE_COUNT,
  MIN_PG_DUMP_MAJOR,
} from "./db-backup-lib.mjs";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path, quiet: true });
}

const connection =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!connection) {
  console.error("[db-backup] DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const parsed = connectionUrlToLibpqEnv(connection);
if (!parsed.ok) {
  console.error(`[db-backup] ${parsed.reason}`);
  process.exit(1);
}

const outDir = resolve(process.cwd(), ".backups");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archiveName = `wexon-full-${stamp}.dump`;
const archivePath = join(outDir, archiveName);
const metaPath = join(outDir, `wexon-backup-meta-${stamp}.json`);
const manifestPath = join(outDir, `wexon-rowcount-manifest-${stamp}.json`);

function fail(message, partialPaths = []) {
  console.error(`[db-backup] FAILED: ${sanitizeBackupLog(message)}`);
  for (const p of partialPaths) {
    try {
      if (p && existsSync(p)) unlinkSync(p);
    } catch {
      // ignore cleanup errors
    }
  }
  process.exit(1);
}

function run(command, args, envExtra = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...parsed.env, ...envExtra },
    windowsHide: true,
  });
}

function resolvePgDumpCandidates() {
  const fromEnv = process.env.WEXON_PG_DUMP?.trim();
  const candidates = [
    fromEnv,
    "pg_dump",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
    "/usr/lib/postgresql/17/bin/pg_dump",
    "/usr/pgsql-17/bin/pg_dump",
  ].filter(Boolean);
  return candidates;
}

function probePgDump() {
  for (const bin of resolvePgDumpCandidates()) {
    const ver = run(bin, ["--version"]);
    if (ver.status === 0) {
      return { bin, versionText: (ver.stdout || "").trim() };
    }
  }
  // Docker postgres:17-alpine fallback (no URL on argv — use env)
  const dockerVer = run("docker", [
    "run",
    "--rm",
    "-e",
    "PGHOST",
    "-e",
    "PGPORT",
    "-e",
    "PGUSER",
    "-e",
    "PGPASSWORD",
    "-e",
    "PGDATABASE",
    "-e",
    "PGSSLMODE",
    "postgres:17-alpine",
    "pg_dump",
    "--version",
  ]);
  if (dockerVer.status === 0) {
    return {
      bin: "docker",
      dockerImage: "postgres:17-alpine",
      versionText: (dockerVer.stdout || "").trim(),
    };
  }
  return null;
}

const client = new pg.Client({
  connectionString: connection,
  ssl: parsed.ssl ? { rejectUnauthorized: false } : undefined,
});

let serverMajor = null;
let serverVersionText = "";
/** @type {Record<string, number>} */
let rowCounts = {};

try {
  await client.connect();
  const ver = await client.query("SHOW server_version");
  serverVersionText = String(ver.rows[0]?.server_version || "");
  serverMajor = parsePostgresMajorVersion(serverVersionText);

  const tables = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);
  for (const { table_name } of tables.rows) {
    const q = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${String(table_name).replace(/"/g, '""')}"`,
    );
    rowCounts[table_name] = q.rows[0]?.n ?? 0;
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => undefined);
}

const dumpProbe = probePgDump();
if (!dumpProbe) {
  fail(
    `PostgreSQL ${MIN_PG_DUMP_MAJOR}+ pg_dump not found (local PATH / Program Files / docker postgres:17-alpine). No JSONL fallback.`,
  );
}

const clientMajor = parsePostgresMajorVersion(dumpProbe.versionText);
const gate = evaluatePgDumpVersionGate({ clientMajor, serverMajor });
if (!gate.ok) {
  fail(gate.reason);
}

console.log("[db-backup] Starting custom-format dump (-Fc)");
console.log(
  `[db-backup] host=${parsed.host} db=${parsed.database} role=${parsed.user.includes(".") ? parsed.user.split(".")[0] + ".[ref]" : parsed.user}`,
);
console.log(
  `[db-backup] serverMajor=${serverMajor} pgDumpMajor=${clientMajor} archive=${archiveName}`,
);

let dumpResult;
let method = "pg_dump";
if (dumpProbe.bin === "docker") {
  method = "docker:postgres:17-alpine";
  // Mount .backups and write archive inside container
  dumpResult = run("docker", [
    "run",
    "--rm",
    "-e",
    "PGHOST",
    "-e",
    "PGPORT",
    "-e",
    "PGUSER",
    "-e",
    "PGPASSWORD",
    "-e",
    "PGDATABASE",
    "-e",
    "PGSSLMODE",
    "-v",
    `${outDir}:/backups`,
    "postgres:17-alpine",
    "pg_dump",
    "-Fc",
    "--no-owner",
    "--no-acl",
    "--schema=public",
    `-f=/backups/${archiveName}`,
  ]);
} else {
  dumpResult = run(dumpProbe.bin, [
    "-Fc",
    "--no-owner",
    "--no-acl",
    "--schema=public",
    `--file=${archivePath}`,
  ]);
}

if (dumpResult.status !== 0) {
  fail(dumpResult.stderr || dumpResult.stdout || "pg_dump failed", [archivePath]);
}

if (!existsSync(archivePath) || statSync(archivePath).size < 32) {
  fail("archive missing or empty after pg_dump", [archivePath]);
}

const archiveBytes = statSync(archivePath).size;
const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");

writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      tableCount: Object.keys(rowCounts).length,
      expectedPublicTableCount: EXPECTED_PUBLIC_TABLE_COUNT,
      rowCounts,
    },
    null,
    2,
  ),
);

const meta = {
  createdAt: new Date().toISOString(),
  method,
  format: "custom",
  schema: "public",
  basename: archiveName,
  bytes: archiveBytes,
  sha256,
  pgDumpMajor: clientMajor,
  pgDumpVersion: dumpProbe.versionText,
  serverMajor,
  serverVersion: serverVersionText,
  tableCount: Object.keys(rowCounts).length,
  rowCountManifest: basename(manifestPath),
  restoreVerified: false,
  recoveryStatus: RECOVERY_STATUS.NOT_VERIFIED,
  offsiteCopyStatus: RECOVERY_STATUS.PENDING_USER_COPY,
  note: "Disaster-recovery candidate (public schema custom archive). Run npm run db:backup:test-restore -- <archive> before treating as RESTORE VERIFIED. Offsite copy is PENDING USER COPY.",
};

writeFileSync(metaPath, JSON.stringify(meta, null, 2));

console.log("[db-backup] OK");
console.log(`[db-backup] basename=${archiveName}`);
console.log(`[db-backup] bytes=${archiveBytes}`);
console.log(`[db-backup] sha256=${sha256}`);
console.log(`[db-backup] schema=public format=custom`);
console.log(`[db-backup] recoveryStatus=${RECOVERY_STATUS.NOT_VERIFIED}`);
console.log(`[db-backup] offsiteCopyStatus=${RECOVERY_STATUS.PENDING_USER_COPY}`);
console.log(`[db-backup] Next: npm run db:backup:test-restore -- .backups/${archiveName}`);
