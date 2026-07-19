/**
 * Pure helpers for disaster-recovery backups — ESM twin of lib/wexon-db-backup-guards.ts
 * Keep behavior in sync; unit tests import the TypeScript module.
 */

export const MIN_PG_DUMP_MAJOR = 17;
/** Current public schema expectation after ActivationFeeLedger migration. */
export const EXPECTED_PUBLIC_TABLE_COUNT = 34;
/** Pre-ActivationFeeLedger recovery archives remain valid via their own manifests. */
export const HISTORICAL_PUBLIC_TABLE_COUNT_PRE_ACTIVATION_LEDGER = 33;
export const RECOVERY_STATUS = {
  NOT_VERIFIED: "RECOVERY BACKUP OLARAK DOĞRULANMADI",
  RESTORE_VERIFIED: "RESTORE VERIFIED",
  PENDING_USER_COPY: "PENDING USER COPY",
  NOT_DISASTER_RECOVERY: "NOT A DISASTER-RECOVERY BACKUP",
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

export function sanitizeBackupLog(text) {
  return String(text ?? "")
    .replace(/postgresql:\/\/[^\s"']+/gi, "postgresql://***")
    .replace(/PGPASSWORD=[^\s]+/gi, "PGPASSWORD=***")
    .replace(/password=[^\s&]+/gi, "password=***");
}

export function connectionUrlToLibpqEnv(rawUrl) {
  const raw = (rawUrl || "").trim();
  if (!raw) return { ok: false, reason: "connection URL is empty" };
  try {
    const normalized = raw.replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    const host = (u.hostname || "").toLowerCase();
    const port = u.port || "5432";
    const user = decodeURIComponent(u.username || "");
    const password = decodeURIComponent(u.password || "");
    const database = decodeURIComponent(
      (u.pathname || "/").replace(/^\//, "").split("?")[0] || "",
    );
    if (!host || !user || !database) {
      return { ok: false, reason: "connection URL missing host, user, or database" };
    }
    const sslmode = u.searchParams.get("sslmode");
    const ssl =
      /supabase\.(com|co)/i.test(host) ||
      sslmode === "require" ||
      sslmode === "verify-full" ||
      sslmode === "verify-ca";
    const env = {
      PGHOST: host,
      PGPORT: port,
      PGUSER: user,
      PGDATABASE: database,
    };
    if (password) env.PGPASSWORD = password;
    if (ssl) env.PGSSLMODE = sslmode || "require";
    return { ok: true, env, host, port, user, database, ssl };
  } catch {
    return { ok: false, reason: "connection URL is not parseable" };
  }
}

export function parsePostgresMajorVersion(versionText) {
  const m = String(versionText || "").match(/(\d+)\.\d+/);
  if (!m) return null;
  return Number(m[1]);
}

export function evaluatePgDumpVersionGate({
  clientMajor,
  serverMajor,
  minMajor = MIN_PG_DUMP_MAJOR,
}) {
  if (clientMajor == null) {
    return { ok: false, reason: "unable to parse pg_dump client major version" };
  }
  if (serverMajor == null) {
    return { ok: false, reason: "unable to parse PostgreSQL server major version" };
  }
  if (clientMajor < minMajor) {
    return {
      ok: false,
      reason: `pg_dump major ${clientMajor} is below required ${minMajor}`,
    };
  }
  if (clientMajor < serverMajor) {
    return {
      ok: false,
      reason: `pg_dump major ${clientMajor} is older than server major ${serverMajor}`,
    };
  }
  return { ok: true };
}

export function classifyRecoveryBackup(meta) {
  const method = String(meta?.method || "");
  const format = String(meta?.format || "");
  const dumpMajor = meta?.pgDumpMajor ?? null;
  const serverMajor = meta?.serverMajor ?? null;

  if (/node|jsonl/i.test(method) || format === "jsonl" || format === "json") {
    return {
      ok: false,
      status: RECOVERY_STATUS.NOT_VERIFIED,
      reason: "method is Node/JSONL export, not a pg_dump custom archive",
    };
  }
  if (dumpMajor == null || dumpMajor < MIN_PG_DUMP_MAJOR) {
    return {
      ok: false,
      status: RECOVERY_STATUS.NOT_VERIFIED,
      reason: `pg_dump major ${dumpMajor ?? "unknown"} is below ${MIN_PG_DUMP_MAJOR}`,
    };
  }
  if (serverMajor != null && dumpMajor < serverMajor) {
    return {
      ok: false,
      status: RECOVERY_STATUS.NOT_VERIFIED,
      reason: `pg_dump major ${dumpMajor} older than server ${serverMajor}`,
    };
  }
  if (format && format !== "custom" && format !== "Fc") {
    return {
      ok: false,
      status: RECOVERY_STATUS.NOT_VERIFIED,
      reason: `format ${format} is not pg_dump custom (-Fc)`,
    };
  }
  if (!meta?.restoreVerified) {
    return {
      ok: false,
      status: RECOVERY_STATUS.NOT_VERIFIED,
      reason: "isolated restore verification has not passed",
    };
  }
  return { ok: true, status: RECOVERY_STATUS.RESTORE_VERIFIED };
}

export function evaluateRestoreTargetGuard(env = {}) {
  if (env.WEXON_ALLOW_LOCAL_DB_TESTS !== "1") {
    return { ok: false, reason: "WEXON_ALLOW_LOCAL_DB_TESTS=1 is required" };
  }
  if ((env.NODE_ENV || "").toLowerCase() === "production") {
    return { ok: false, reason: "NODE_ENV=production restore targets are forbidden" };
  }
  const vercelEnv = (env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv === "production" || vercelEnv === "preview") {
    return { ok: false, reason: `VERCEL_ENV=${vercelEnv} restore targets are forbidden` };
  }

  const raw = (env.DATABASE_URL || env.DIRECT_URL || "").trim();
  if (!raw) {
    return { ok: false, reason: "DATABASE_URL (or DIRECT_URL) is required for restore target" };
  }

  const parsed = connectionUrlToLibpqEnv(raw);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  if (!LOOPBACK.has(parsed.host)) {
    return { ok: false, reason: `restore host ${parsed.host} is not loopback` };
  }
  if (/supabase|neon\.tech|railway|amazonaws|pooler|vercel|render\.com/i.test(parsed.host)) {
    return { ok: false, reason: "remote/cloud restore hosts are forbidden" };
  }
  if (
    !/(^|[_\-])(test|e2e)([_\-]|$)/i.test(parsed.database) &&
    !/_test|_e2e/i.test(parsed.database)
  ) {
    return {
      ok: false,
      reason: `database name "${parsed.database}" must contain _test or _e2e`,
    };
  }
  return {
    ok: true,
    host: parsed.host,
    database: parsed.database,
    url: raw,
  };
}

export function sha256HexEqual(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

export function assertCurrentSchemaPublicTableCount(
  actual,
  expected = EXPECTED_PUBLIC_TABLE_COUNT,
) {
  if (!Number.isFinite(actual) || actual !== expected) {
    return {
      ok: false,
      reason: `public table count ${actual} does not match current schema expectation ${expected}`,
    };
  }
  return { ok: true };
}

export function evaluateRestoreTableCountContract(input) {
  const manifest = input?.manifest;
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, reason: "row-count manifest missing or invalid" };
  }
  const rowCounts = manifest.rowCounts;
  if (!rowCounts || typeof rowCounts !== "object" || Array.isArray(rowCounts)) {
    return { ok: false, reason: "row-count manifest missing rowCounts object" };
  }
  const rowKeyCount = Object.keys(rowCounts).length;
  const declared = manifest.tableCount;
  if (declared == null || !Number.isFinite(Number(declared))) {
    return { ok: false, reason: "row-count manifest missing tableCount" };
  }
  const expectedTableCount = Number(declared);
  if (expectedTableCount !== rowKeyCount) {
    return {
      ok: false,
      reason: `manifest tableCount ${expectedTableCount} != rowCounts keys ${rowKeyCount}`,
    };
  }
  if (input.restoredTableCount !== expectedTableCount) {
    return {
      ok: false,
      reason: `restored table count ${input.restoredTableCount} != manifest tableCount ${expectedTableCount}`,
    };
  }
  return { ok: true, expectedTableCount };
}

export function evaluateActivationFeeLedgerRls(input) {
  if (!input?.present) return { ok: true };
  if (!input.relrowsecurity) {
    return { ok: false, reason: "ActivationFeeLedger exists but ROW LEVEL SECURITY is disabled" };
  }
  return { ok: true };
}

export function compareRowCountManifests(expected, actual) {
  const missing = [];
  const mismatched = [];
  for (const [table, count] of Object.entries(expected || {})) {
    if (!(table in (actual || {}))) missing.push(table);
    else if (actual[table] !== count) {
      mismatched.push({ table, expected: count, actual: actual[table] });
    }
  }
  const unexpected = Object.keys(actual || {}).filter((t) => !(t in (expected || {})));
  const ok = missing.length === 0 && mismatched.length === 0 && unexpected.length === 0;
  return { ok, missing, mismatched, unexpected };
}
