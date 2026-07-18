/**
 * Safety guard for DB-backed integration tests.
 *
 * Pure and dependency-free (no Prisma import), so it can run BEFORE any database
 * connection is opened. A DB test must call this and refuse to touch the
 * database unless ALL conditions hold:
 *
 * - explicit opt-in `WEXON_ALLOW_LOCAL_DB_TESTS=1`
 * - `NODE_ENV` is not production
 * - `VERCEL_ENV` is not a production/preview deployment environment
 * - `DATABASE_URL` is present and parseable (the URL Prisma actually connects
 *   with; a `DIRECT_URL` fallback must never mask a wrong runtime target)
 * - when `DIRECT_URL` is set, it must also be a safe local test/e2e target
 * - host is a loopback address only (localhost / 127.0.0.1 / ::1)
 * - database name contains `_test` or `_e2e` (not bare `wexon` / `wexon_dev`)
 *
 * Any remote host (Supabase `db.<ref>.supabase.co`, `*.pooler.supabase.com`,
 * Neon, Railway, RDS, …), empty or unparseable URL is rejected.
 * Opt-in never authorizes a remote host.
 */

export type LocalDbTestGuardEnv = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  WEXON_ALLOW_LOCAL_DB_TESTS?: string;
};

export type LocalDbTestGuardResult =
  | { ok: true; url: string; host: string; database: string }
  | { ok: false; reason: string };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Parse a Postgres connection string reliably. Postgres schemes are "non
 * special" for the WHATWG URL parser, which makes host/port/path extraction
 * inconsistent, so we normalize the scheme to `http` purely for parsing.
 */
export function parseConnectionUrl(rawUrl: string): { host: string; database: string } | null {
  try {
    const normalized = rawUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "http://");
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).toLowerCase();
    return { host, database };
  } catch {
    return null;
  }
}

function isSafeLocalTestDatabaseName(database: string): boolean {
  return database.includes("_test") || database.includes("_e2e");
}

function evaluateUrlTarget(label: "DATABASE_URL" | "DIRECT_URL", rawUrl: string): LocalDbTestGuardResult {
  const parsed = parseConnectionUrl(rawUrl);
  if (!parsed) {
    return { ok: false, reason: `${label} parse edilemiyor.` };
  }

  if (!parsed.host || !LOOPBACK_HOSTS.has(parsed.host)) {
    return { ok: false, reason: `${label} loopback olmayan host reddedildi: ${parsed.host || "(boş)"}` };
  }

  if (!parsed.database) {
    return { ok: false, reason: `${label} veritabanı adı belirtilmemiş.` };
  }
  if (!isSafeLocalTestDatabaseName(parsed.database)) {
    return {
      ok: false,
      reason: `${label} veritabanı adı '_test' veya '_e2e' içermeli: ${parsed.database}`,
    };
  }

  return { ok: true, url: rawUrl, host: parsed.host, database: parsed.database };
}

export function evaluateLocalDbTestGuard(env: LocalDbTestGuardEnv): LocalDbTestGuardResult {
  if (env.WEXON_ALLOW_LOCAL_DB_TESTS !== "1") {
    return { ok: false, reason: "Opt-in yok: WEXON_ALLOW_LOCAL_DB_TESTS=1 gerekli." };
  }

  if ((env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    return { ok: false, reason: "NODE_ENV=production altında DB testi çalıştırılamaz." };
  }

  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv === "production" || vercelEnv === "preview") {
    return { ok: false, reason: `VERCEL_ENV=${vercelEnv} bir deployment ortamı; DB testi engellendi.` };
  }

  // Prisma connects with DATABASE_URL when present (see lib/prisma.ts). Require
  // it explicitly so a DIRECT_URL fallback cannot silently point elsewhere.
  const databaseUrl = (env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL tanımlı değil (boş)." };
  }

  const databaseResult = evaluateUrlTarget("DATABASE_URL", databaseUrl);
  if (!databaseResult.ok) return databaseResult;

  const directUrl = (env.DIRECT_URL ?? "").trim();
  if (directUrl) {
    const directResult = evaluateUrlTarget("DIRECT_URL", directUrl);
    if (!directResult.ok) return directResult;
  }

  return databaseResult;
}

/** Throwing wrapper: refuse to proceed (and thus never query) when unsafe. */
export function assertLocalDbTestGuard(env: LocalDbTestGuardEnv): { url: string; host: string; database: string } {
  const result = evaluateLocalDbTestGuard(env);
  if (!result.ok) {
    throw new Error(`[db-test-guard] DB testi reddedildi: ${result.reason}`);
  }
  return { url: result.url, host: result.host, database: result.database };
}
