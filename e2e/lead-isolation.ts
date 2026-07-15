import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export const E2E_LEAD_PREFIX = "E2E[WXP]";
export const E2E_ELIGIBILITY_SOURCE_BASE = "e2e-eligibility-safety";

export type DbClassification =
  | "local"
  | "isolated"
  | "preview"
  | "shared remote-unverified"
  | "production-confirmed"
  | "missing-db";

export type E2ELeadMarker = {
  runId: string;
  source: string;
  email: string;
  company: string;
  fullName: string;
  message: string;
};

export type SafeDbDescriptor = {
  host: string;
  port: string;
  database: string;
};

function databaseUrl() {
  return (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
}

function poolerOrDirectUrl() {
  return (process.env.DATABASE_URL || "").trim();
}

function directUrl() {
  return (process.env.DIRECT_URL || "").trim();
}

/** Parse connection URL without exposing credentials. */
export function describeDatabaseSafely(rawUrl: string): SafeDbDescriptor | null {
  const url = rawUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: (parsed.hostname || "unknown").toLowerCase(),
      port: parsed.port || (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:" ? "5432" : ""),
      database: decodeURIComponent((parsed.pathname || "/").replace(/^\//, "").split("?")[0] || "").toLowerCase(),
    };
  } catch {
    // Fallback for non-URL forms: never echo the raw string.
    return { host: "unparseable", port: "", database: "unparseable" };
  }
}

function e2eBaseUrl() {
  return (
    process.env.E2E_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.E2E_PUBLIC_ORIGIN ||
    ""
  );
}

function looksProductionHost(base: string, target: string) {
  return target === "production" || /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(base);
}

export function isLocalDatabaseHost(url: string): boolean {
  const desc = describeDatabaseSafely(url);
  if (!desc) return false;
  return /^(localhost|127\.0\.0\.1|host\.docker\.internal)$/i.test(desc.host);
}

export function isRemoteSharedDatabaseHost(url: string): boolean {
  const desc = describeDatabaseSafely(url);
  if (!desc) return true;
  if (isLocalDatabaseHost(url)) return false;
  return /supabase\.com|neon\.tech|amazonaws\.com|pooler|vercel-storage|railway\.app|render\.com/i.test(
    `${desc.host} ${url}`,
  );
}

/** Dedicated E2E/test database name — fail closed on generic `postgres` / prod names. */
export function isE2eTestDatabaseName(url: string): boolean {
  const desc = describeDatabaseSafely(url);
  if (!desc?.database) return false;
  const name = desc.database;
  if (name === "postgres" || name === "template0" || name === "template1") return false;
  return /(^|[_\-])(e2e|test)([_\-]|$)/i.test(name) || /^wexon_e2e$/i.test(name);
}

export function databaseUrlsPointAtSameIsolatedDb(): boolean {
  const a = describeDatabaseSafely(poolerOrDirectUrl() || databaseUrl());
  const b = describeDatabaseSafely(directUrl() || databaseUrl());
  if (!a || !b) return false;
  if (a.host === "unparseable" || b.host === "unparseable") return false;
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

export function classifyE2EDatabase(): DbClassification {
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

  // Remote shared hosts can never be "isolated" — even when TARGET=isolated.
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

/**
 * Fail-closed gate for WexPay seed/mutation/cleanup against real customer data.
 * Production-confirmed cannot be bypassed by any allow flag.
 */
export function wexPayMutationBlockedReason(): string | null {
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

/** Alias used by suites that previously checked guest-only flags. */
export function guestMutationBlockedReason(): string | null {
  return wexPayMutationBlockedReason();
}

export function assertIsolatedWexPayDatabase(actionLabel = "WexPay E2E"): void {
  const reason = wexPayMutationBlockedReason();
  if (reason) {
    const desc = describeDatabaseSafely(databaseUrl());
    const safeWhere = desc
      ? `host=${desc.host} port=${desc.port || "?"} db=${desc.database}`
      : "db=missing";
    throw new Error(`${actionLabel} refused (${safeWhere}): ${reason}`);
  }
}

export function leadMutationBlockedReason(): string | null {
  const classification = classifyE2EDatabase();
  if (classification === "production-confirmed") {
    return "Lead-mutating E2E is blocked on production-confirmed targets.";
  }
  if (classification === "missing-db") {
    return "DATABASE_URL/DIRECT_URL missing; cannot isolate or clean E2E leads.";
  }
  if (
    classification === "shared remote-unverified" &&
    process.env.WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION !== "true"
  ) {
    return [
      "Lead-mutating E2E skipped on shared remote-unverified DB.",
      "Set WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION=true only when intentional,",
      "and rely on after-test cleanup of this run's markers.",
    ].join(" ");
  }
  if (process.env.WEXON_E2E_SKIP_LEAD_MUTATION === "true") {
    return "WEXON_E2E_SKIP_LEAD_MUTATION=true";
  }
  return null;
}

export function createEligibilityLeadMarker(runId = `${Date.now().toString(36)}`): E2ELeadMarker {
  return {
    runId,
    source: `${E2E_ELIGIBILITY_SOURCE_BASE}.${runId}`,
    email: `e2e.elig.${runId}@example.com`,
    company: `${E2E_LEAD_PREFIX} Eligibility Co ${runId}`,
    fullName: `${E2E_LEAD_PREFIX} Eligibility Applicant ${runId}`,
    message: `${E2E_LEAD_PREFIX} eligibility applicant-facing response must never include internal risk reason keys. run=${runId}`,
  };
}

export function createWexPayRunMarker(runId = `${Date.now().toString(36)}`) {
  const token = `${E2E_LEAD_PREFIX}.${runId}`;
  return {
    runId,
    token,
    note: `${token} isolated WexPay E2E run`,
  };
}

function createPrisma() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL or DIRECT_URL required for lead cleanup");
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    pool,
  };
}

function metaMatchesMarker(metadataJson: unknown, marker: E2ELeadMarker) {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const meta = metadataJson as Record<string, unknown>;
  return (
    String(meta.source ?? "") === marker.source &&
    String(meta.email ?? "").toLowerCase() === marker.email.toLowerCase() &&
    String(meta.company ?? "") === marker.company
  );
}

/**
 * Deletes only audit rows created by this exact marker (source+email+company).
 * Never runs bulk/unfiltered deletes. Refuses production-confirmed.
 */
export async function cleanupOwnDemoLeadMarker(marker: E2ELeadMarker): Promise<{
  deletedCreated: number;
  deletedRelated: number;
  ids: string[];
}> {
  if (classifyE2EDatabase() === "production-confirmed") {
    throw new Error("Refusing cleanup on production-confirmed database.");
  }

  const { prisma, pool } = createPrisma();
  try {
    const created = await prisma.auditLog.findMany({
      where: { action: "public.demo_request.created" },
      select: { id: true, metadataJson: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const ids = created.filter((row) => metaMatchesMarker(row.metadataJson, marker)).map((row) => row.id);
    if (ids.length === 0) {
      return { deletedCreated: 0, deletedRelated: 0, ids: [] };
    }

    if (ids.length > 5) {
      throw new Error(`Cleanup abort: marker matched ${ids.length} rows (expected <=5).`);
    }

    const relatedCandidates = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "public.demo_request.status_updated",
            "public.demo_request.followup_updated",
            "public.demo_request.recorded",
          ],
        },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, entityId: true, metadataJson: true },
      take: 500,
    });

    const relatedIds = relatedCandidates
      .filter((row) => {
        if (row.entityId && ids.includes(row.entityId)) return true;
        const meta =
          row.metadataJson && typeof row.metadataJson === "object"
            ? (row.metadataJson as Record<string, unknown>)
            : {};
        const leadId = String(meta.originalDemoRequestId ?? meta.leadId ?? "");
        return ids.includes(leadId);
      })
      .map((row) => row.id);

    let deletedRelated = 0;
    if (relatedIds.length > 0) {
      const result = await prisma.auditLog.deleteMany({
        where: { id: { in: relatedIds } },
      });
      deletedRelated = result.count;
    }

    const deletedCreated = await prisma.auditLog.deleteMany({
      where: {
        id: { in: ids },
        action: "public.demo_request.created",
      },
    });

    return {
      deletedCreated: deletedCreated.count,
      deletedRelated,
      ids,
    };
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
