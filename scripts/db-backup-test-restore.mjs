/**
 * Isolated restore verification for a pg_dump custom archive (-Fc).
 *
 * Usage:
 *   WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run db:backup:test-restore -- .backups/wexon-full-....dump
 *
 * Spawns an ephemeral PostgreSQL 17 cluster via local initdb/pg_ctl (no Docker required).
 * Never targets production / remote / Supabase hosts.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, basename, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import {
  evaluateRestoreTargetGuard,
  compareRowCountManifests,
  parsePostgresMajorVersion,
  sanitizeBackupLog,
  RECOVERY_STATUS,
  EXPECTED_PUBLIC_TABLE_COUNT,
  sha256HexEqual,
} from "./db-backup-lib.mjs";

const archiveArg = process.argv[2];
if (!archiveArg) {
  console.error("[backup-restore-test] Usage: npm run db:backup:test-restore -- <archive.dump>");
  process.exit(1);
}

const archivePath = resolve(process.cwd(), archiveArg);
if (!existsSync(archivePath)) {
  console.error(`[backup-restore-test] archive not found: ${basename(archivePath)}`);
  process.exit(1);
}

if (process.env.WEXON_ALLOW_LOCAL_DB_TESTS !== "1") {
  console.error("[backup-restore-test] WEXON_ALLOW_LOCAL_DB_TESTS=1 is required");
  process.exit(1);
}

function resolvePgBin(name) {
  const fromEnv = process.env[`WEXON_${name.toUpperCase()}`]?.trim();
  const candidates = [
    fromEnv,
    name,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${name}.exe`,
    `C:\\Program Files\\PostgreSQL\\18\\bin\\${name}.exe`,
    `/usr/lib/postgresql/17/bin/${name}`,
    `/usr/pgsql-17/bin/${name}`,
  ].filter(Boolean);
  for (const bin of candidates) {
    const r = spawnSync(bin, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    if (r.status === 0) {
      const major = parsePostgresMajorVersion(r.stdout || "");
      if (major != null && major >= 17) {
        return { bin, major, versionText: (r.stdout || "").trim() };
      }
    }
  }
  return null;
}

const initdb = resolvePgBin("initdb");
const pgCtl = resolvePgBin("pg_ctl");
const pgRestore = resolvePgBin("pg_restore");
const createdb = resolvePgBin("createdb");
const dropdb = resolvePgBin("dropdb");

if (!initdb || !pgCtl || !pgRestore || !createdb) {
  console.error(
    "[backup-restore-test] FAILED: PostgreSQL 17+ initdb/pg_ctl/pg_restore/createdb not found.",
  );
  process.exit(1);
}

const token = randomBytes(4).toString("hex");
const dataDir = join(tmpdir(), `wexon-restore-${token}`);
const port = String(55432 + (Number.parseInt(token.slice(0, 3), 16) % 200));
const dbName = `wexon_restore_${token}_test`;
const restoreUrl = `postgresql://postgres@127.0.0.1:${port}/${dbName}`;

const targetGuard = evaluateRestoreTargetGuard({
  DATABASE_URL: restoreUrl,
  NODE_ENV: process.env.NODE_ENV || "test",
  VERCEL_ENV: process.env.VERCEL_ENV || "",
  WEXON_ALLOW_LOCAL_DB_TESTS: "1",
});
if (!targetGuard.ok) {
  console.error(`[backup-restore-test] ${targetGuard.reason}`);
  process.exit(1);
}

function run(bin, args, env = {}, timeoutMs = 120_000, stdioMode = "pipe") {
  const stdio =
    stdioMode === "ignore"
      ? "ignore"
      : stdioMode === "inherit"
        ? "inherit"
        : ["ignore", "pipe", "pipe"];
  return spawnSync(bin, args, {
    encoding: stdioMode === "ignore" ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LC_ALL: "C", LANG: "C", ...env },
    windowsHide: true,
    timeout: timeoutMs,
    stdio,
  });
}

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    run(pgCtl.bin, ["-D", dataDir, "-m", "immediate", "stop"], {}, 30_000);
  } catch {
    // ignore
  }
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function fail(msg) {
  console.error(`[backup-restore-test] FAIL: ${sanitizeBackupLog(msg)}`);
  cleanup();
  process.exit(1);
}

process.on("exit", () => cleanup());
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

console.log("[backup-restore-test] Starting ephemeral PostgreSQL 17 cluster");
console.log(`[backup-restore-test] archive=${basename(archivePath)} db=${dbName} port=${port}`);

mkdirSync(dataDir, { recursive: true });
console.log("[backup-restore-test] initdb...");
const init = run(
  initdb.bin,
  ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C", "--no-instructions"],
  {},
  120_000,
);
if (init.error || init.status !== 0) {
  fail(init.error?.message || init.stderr || init.stdout || "initdb failed");
}

console.log("[backup-restore-test] pg_ctl start...");
// On Windows, piping stdio to pg_ctl can prevent the postmaster from detaching.
const start = run(
  pgCtl.bin,
  [
    "-D",
    dataDir,
    "-o",
    `-p ${port} -c listen_addresses=127.0.0.1`,
    "-l",
    join(dataDir, "pg.log"),
    "start",
  ],
  {},
  60_000,
  "ignore",
);
if (start.error || (start.status !== 0 && start.status !== null)) {
  const log = existsSync(join(dataDir, "pg.log"))
    ? readFileSync(join(dataDir, "pg.log"), "utf8").slice(-2000)
    : "";
  fail(`${start.error?.message || `pg_ctl start exit=${start.status}`}\n${log}`);
}

console.log("[backup-restore-test] waiting for accept...");
let ready = false;
for (let i = 0; i < 40; i++) {
  const c = new pg.Client({
    host: "127.0.0.1",
    port: Number(port),
    user: "postgres",
    database: "postgres",
    connectionTimeoutMillis: 1000,
  });
  try {
    await c.connect();
    await c.query("SELECT 1");
    await c.end();
    ready = true;
    break;
  } catch {
    try {
      await c.end();
    } catch {
      // ignore
    }
    await delay(250);
  }
}
if (!ready) fail("ephemeral server did not accept connections");

console.log("[backup-restore-test] createdb...");
const mkdb = run(
  createdb.bin,
  ["-h", "127.0.0.1", "-p", port, "-U", "postgres", dbName],
  { PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres" },
  30_000,
);
if (mkdb.status !== 0) {
  fail(mkdb.stderr || mkdb.stdout || "createdb failed");
}

// Roles referenced by public policies / grants in the archive.
const prep = new pg.Client({
  host: "127.0.0.1",
  port: Number(port),
  user: "postgres",
  database: dbName,
});
await prep.connect();
try {
  await prep.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
        CREATE ROLE wexon_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;
  `);
} finally {
  await prep.end();
}

console.log("[backup-restore-test] pg_restore...");
const restore = run(
  pgRestore.bin,
  [
    "-h",
    "127.0.0.1",
    "-p",
    port,
    "-U",
    "postgres",
    "-d",
    dbName,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    archivePath,
  ],
  { PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres" },
  180_000,
);
const restoreOut = `${restore.stdout || ""}\n${restore.stderr || ""}`;
if (restore.error) fail(restore.error.message);

const errorLines = restoreOut
  .split(/\r?\n/)
  .filter((line) => /ERROR:/i.test(line))
  .filter((line) => !/schema "public" already exists/i.test(line));

if (errorLines.length > 0) {
  fail(restoreOut || "pg_restore failed");
}
if ((restore.status ?? 0) > 1) {
  fail(restoreOut || `pg_restore exit ${restore.status}`);
}
console.log("[backup-restore-test] pg_restore completed (no critical errors)");

const client = new pg.Client({ connectionString: restoreUrl });
await client.connect();

try {
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;
  `);

  const tables = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  if (tables.rows.length !== EXPECTED_PUBLIC_TABLE_COUNT) {
    fail(`expected ${EXPECTED_PUBLIC_TABLE_COUNT} public tables, got ${tables.rows.length}`);
  }

  const rlsOff = tables.rows.filter((r) => !r.rls);
  if (rlsOff.length > 0) {
    fail(`RLS disabled on: ${rlsOff.map((r) => r.table_name).join(", ")}`);
  }

  /** @type {Record<string, number>} */
  const actualCounts = {};
  for (const { table_name } of tables.rows) {
    const q = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${String(table_name).replace(/"/g, '""')}"`,
    );
    actualCounts[table_name] = q.rows[0]?.n ?? 0;
  }

  const stampMatch = basename(archivePath).match(/wexon-full-(.+)\.dump$/);
  const backupsDir = dirname(archivePath);
  let expectedCounts = null;
  if (stampMatch) {
    const manifestFile = join(backupsDir, `wexon-rowcount-manifest-${stampMatch[1]}.json`);
    if (existsSync(manifestFile)) {
      expectedCounts = JSON.parse(readFileSync(manifestFile, "utf8")).rowCounts;
    }
  }
  if (!expectedCounts) fail("row-count manifest not found beside archive");

  const cmp = compareRowCountManifests(expectedCounts, actualCounts);
  if (!cmp.ok) {
    fail(
      `row-count mismatch missing=${cmp.missing.join("|") || "-"} mismatched=${JSON.stringify(cmp.mismatched)}`,
    );
  }

  const migrations = await client.query(
    `SELECT COUNT(*)::int AS n FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL`,
  );
  const migCount = migrations.rows[0]?.n ?? 0;
  if (migCount < 15) {
    fail(`expected >= 15 finished prisma migrations, got ${migCount}`);
  }

  const priv = await client.query(`
    SELECT
      has_table_privilege('anon', 'public."User"', 'SELECT') AS anon_user_select,
      has_table_privilege('anon', 'public."User"', 'INSERT') AS anon_user_insert,
      has_table_privilege('anon', 'public."WexPayProviderCredential"', 'SELECT') AS anon_cred_select,
      has_table_privilege('authenticated', 'public."User"', 'SELECT') AS auth_user_select
  `);
  const p = priv.rows[0];
  if (p.anon_user_select || p.anon_user_insert || p.anon_cred_select || p.auth_user_select) {
    fail(`anon/authenticated privileges still present: ${JSON.stringify(p)}`);
  }

  const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (stampMatch && existsSync(join(backupsDir, `wexon-backup-meta-${stampMatch[1]}.json`))) {
    const metaPath = join(backupsDir, `wexon-backup-meta-${stampMatch[1]}.json`);
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    if (meta.sha256 && !sha256HexEqual(meta.sha256, sha256)) {
      fail("archive SHA-256 does not match meta");
    }
    meta.restoreVerified = true;
    meta.recoveryStatus = RECOVERY_STATUS.RESTORE_VERIFIED;
    meta.offsiteCopyStatus = RECOVERY_STATUS.PENDING_USER_COPY;
    meta.restoreTest = {
      passedAt: new Date().toISOString(),
      tableCount: tables.rows.length,
      prismaMigrationsFinished: migCount,
      ephemeralDb: dbName,
      pgRestoreMajor: pgRestore.major,
    };
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  console.log("[backup-restore-test] PASS");
  console.log(`[backup-restore-test] status=${RECOVERY_STATUS.RESTORE_VERIFIED}`);
  console.log(`[backup-restore-test] tables=${tables.rows.length}`);
  console.log(`[backup-restore-test] rowCounts=matched`);
  console.log(`[backup-restore-test] prismaMigrationsFinished=${migCount}`);
  console.log(`[backup-restore-test] rls=all-enabled anonPrivileges=none`);
  console.log(`[backup-restore-test] sha256=${sha256}`);
  console.log(`[backup-restore-test] offsiteCopyStatus=${RECOVERY_STATUS.PENDING_USER_COPY}`);
} finally {
  await client.end().catch(() => undefined);
  if (dropdb) {
    run(
      dropdb.bin,
      ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "--if-exists", dbName],
      { PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres" },
      30_000,
    );
  }
  cleanup();
}
