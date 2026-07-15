/**
 * Fail-closed isolated E2E database guards (shared by seed scripts + Playwright).
 * Never logs full connection URLs or passwords.
 */

/**
 * @typedef {{ host: string, port: string, database: string }} SafeDbDescriptor
 */

/**
 * @param {string} rawUrl
 * @returns {SafeDbDescriptor | null}
 */
export function describeDatabaseSafely(rawUrl) {
  const url = (rawUrl || "").trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: (parsed.hostname || "unknown").toLowerCase(),
      port: parsed.port || (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:" ? "5432" : ""),
      database: decodeURIComponent((parsed.pathname || "/").replace(/^\//, "").split("?")[0] || "").toLowerCase(),
    };
  } catch {
    return { host: "unparseable", port: "", database: "unparseable" };
  }
}

export function isLocalDatabaseHost(url) {
  const desc = describeDatabaseSafely(url);
  if (!desc) return false;
  return /^(localhost|127\.0\.0\.1|host\.docker\.internal)$/i.test(desc.host);
}

export function isRemoteSharedDatabaseHost(url) {
  const desc = describeDatabaseSafely(url);
  if (!desc) return true;
  if (isLocalDatabaseHost(url)) return false;
  return /supabase\.com|neon\.tech|amazonaws\.com|pooler|vercel-storage|railway\.app|render\.com/i.test(
    `${desc.host} ${url}`,
  );
}

export function isE2eTestDatabaseName(url) {
  const desc = describeDatabaseSafely(url);
  if (!desc?.database) return false;
  const name = desc.database;
  if (name === "postgres" || name === "template0" || name === "template1") return false;
  return /(^|[_\-])(e2e|test)([_\-]|$)/i.test(name) || /^wexon_e2e$/i.test(name);
}

function databaseUrl() {
  return (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
}

function poolerOrDirectUrl() {
  return (process.env.DATABASE_URL || "").trim();
}

function directUrl() {
  return (process.env.DIRECT_URL || "").trim();
}

export function databaseUrlsPointAtSameIsolatedDb() {
  const a = describeDatabaseSafely(poolerOrDirectUrl() || databaseUrl());
  const b = describeDatabaseSafely(directUrl() || databaseUrl());
  if (!a || !b) return false;
  if (a.host === "unparseable" || b.host === "unparseable") return false;
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

function e2eBaseUrl() {
  return (
    process.env.E2E_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.E2E_PUBLIC_ORIGIN ||
    ""
  );
}

function looksProductionHost(base, target) {
  return target === "production" || /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(base);
}

/** @returns {"local"|"isolated"|"preview"|"shared remote-unverified"|"production-confirmed"|"missing-db"} */
export function classifyE2EDatabase() {
  const url = databaseUrl();
  if (!url) return "missing-db";

  const target = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
  const confirmProduction = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
  const confirmIsolated = process.env.WEXON_E2E_CONFIRM_ISOLATED === "true";
  const base = e2eBaseUrl();

  if (looksProductionHost(base, target) && target === "production" && confirmProduction) {
    return "production-confirmed";
  }

  if (process.env.VERCEL_ENV === "production" && target === "production" && confirmProduction) {
    return "production-confirmed";
  }

  if (isRemoteSharedDatabaseHost(url)) {
    return "shared remote-unverified";
  }

  if (isLocalDatabaseHost(url)) {
    const isolatedReady =
      target === "isolated" &&
      confirmIsolated &&
      process.env.VERCEL_ENV !== "production" &&
      isE2eTestDatabaseName(url) &&
      databaseUrlsPointAtSameIsolatedDb() &&
      !looksProductionHost(base, target);

    if (isolatedReady) return "isolated";
    return "local";
  }

  if (/vercel\.app/i.test(base) || /preview/i.test(base)) {
    return "preview";
  }

  return "shared remote-unverified";
}

export function wexPayMutationBlockedReason() {
  if (process.env.VERCEL_ENV === "production") {
    return "WexPay E2E mutation blocked while VERCEL_ENV=production.";
  }

  const classification = classifyE2EDatabase();

  if (classification === "production-confirmed") {
    return "WexPay E2E mutation is hard-blocked on production-confirmed targets (no allow-flag bypass).";
  }

  if (classification === "missing-db") {
    return "DATABASE_URL/DIRECT_URL missing; cannot run WexPay E2E mutations.";
  }

  if (classification === "shared remote-unverified") {
    return [
      "WexPay E2E mutation blocked on shared remote-unverified database.",
      "Use WEXON_E2E_TARGET=isolated with a local e2e Postgres (see npm run e2e:db:prepare).",
    ].join(" ");
  }

  if (classification !== "isolated") {
    return [
      `WexPay E2E mutation requires confirmed isolated DB (got ${classification}).`,
      "Set WEXON_E2E_TARGET=isolated, WEXON_E2E_CONFIRM_ISOLATED=true,",
      "point DATABASE_URL/DIRECT_URL at local wexon_e2e, and avoid production hosts.",
    ].join(" ");
  }

  if (process.env.WEXON_E2E_CONFIRM_ISOLATED !== "true") {
    return "WEXON_E2E_CONFIRM_ISOLATED=true is required for WexPay E2E mutations.";
  }

  return null;
}

export function assertIsolatedWexPayDatabase(actionLabel = "WexPay E2E") {
  const reason = wexPayMutationBlockedReason();
  if (reason) {
    const desc = describeDatabaseSafely(databaseUrl());
    const safeWhere = desc
      ? `host=${desc.host} port=${desc.port || "?"} db=${desc.database}`
      : "db=missing";
    throw new Error(`${actionLabel} refused (${safeWhere}): ${reason}`);
  }
}

/** Canonical local E2E Postgres endpoints (dev-only credentials — not production). */
export const ISOLATED_E2E_DB = {
  composeFile: "docker-compose.e2e.yml",
  service: "e2e-postgres",
  host: "127.0.0.1",
  port: "5433",
  user: "wexon_e2e",
  password: "wexon_e2e_dev_only",
  database: "wexon_e2e",
};

export function isolatedE2eConnectionUrl() {
  const { user, password, host, port, database } = ISOLATED_E2E_DB;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/** Apply isolated env pins without clobberable secrets printing. */
export function applyIsolatedE2eEnv() {
  const url = isolatedE2eConnectionUrl();
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.env.WEXON_E2E_TARGET = "isolated";
  process.env.WEXON_E2E_CONFIRM_ISOLATED = "true";
  delete process.env.WEXON_E2E_CONFIRM_PRODUCTION;
  if (!process.env.E2E_BASE_URL && !process.env.SMOKE_BASE_URL) {
    process.env.SMOKE_BASE_URL = `http://localhost:${process.env.SMOKE_PORT || "3100"}`;
  }
  return url;
}
