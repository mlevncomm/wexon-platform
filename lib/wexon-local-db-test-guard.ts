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
 * - host is a loopback address only (localhost / 127.0.0.1 / ::1)
 * - database name contains `test` or `e2e`
 *
 * Any remote host (Supabase `db.<ref>.supabase.co`, `*.pooler.supabase.com`,
 * Neon, Railway, …), empty or unparseable URL is rejected.
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
function parseConnectionUrl(rawUrl: string): { host: string; database: string } | null {
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
  const rawUrl = (env.DATABASE_URL ?? "").trim();
  if (!rawUrl) {
    return { ok: false, reason: "DATABASE_URL tanımlı değil (boş)." };
  }

  const parsed = parseConnectionUrl(rawUrl);
  if (!parsed) {
    return { ok: false, reason: "DATABASE_URL parse edilemiyor." };
  }

  if (!parsed.host || !LOOPBACK_HOSTS.has(parsed.host)) {
    return { ok: false, reason: `Loopback olmayan host reddedildi: ${parsed.host || "(boş)"}` };
  }

  if (!parsed.database) {
    return { ok: false, reason: "Veritabanı adı belirtilmemiş." };
  }
  if (!parsed.database.includes("test") && !parsed.database.includes("e2e")) {
    return { ok: false, reason: `Veritabanı adı 'test' veya 'e2e' içermeli: ${parsed.database}` };
  }

  return { ok: true, url: rawUrl, host: parsed.host, database: parsed.database };
}

/** Throwing wrapper: refuse to proceed (and thus never query) when unsafe. */
export function assertLocalDbTestGuard(env: LocalDbTestGuardEnv): { url: string; host: string; database: string } {
  const result = evaluateLocalDbTestGuard(env);
  if (!result.ok) {
    throw new Error(`[db-test-guard] DB testi reddedildi: ${result.reason}`);
  }
  return { url: result.url, host: result.host, database: result.database };
}
