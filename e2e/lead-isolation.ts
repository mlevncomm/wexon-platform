import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export const E2E_LEAD_PREFIX = "E2E[WXP]";
export const E2E_ELIGIBILITY_SOURCE_BASE = "e2e-eligibility-safety";

export type DbClassification =
  | "local"
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

function databaseUrl() {
  return (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
}

export function classifyE2EDatabase(): DbClassification {
  const url = databaseUrl();
  if (!url) return "missing-db";

  const target = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
  const confirm = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
  const base =
    process.env.E2E_BASE_URL ||
    process.env.SMOKE_BASE_URL ||
    process.env.E2E_PUBLIC_ORIGIN ||
    "";
  const looksProductionHost =
    target === "production" || /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(base);

  if (looksProductionHost && target === "production" && confirm) {
    return "production-confirmed";
  }

  if (/localhost|127\.0\.0\.1|host\.docker\.internal/.test(url)) {
    return "local";
  }

  if (/vercel\.app/i.test(base) || /preview/i.test(base)) {
    return "preview";
  }

  if (/supabase\.com|neon\.tech|amazonaws\.com|pooler/.test(url)) {
    return "shared remote-unverified";
  }

  return "shared remote-unverified";
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
