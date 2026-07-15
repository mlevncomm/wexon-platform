#!/usr/bin/env node
/**
 * Dry-run by default. Deletes ONLY audit rows that match known E2E demo lead markers.
 *
 * Usage:
 *   node --import ./scripts/load-local-env.mjs scripts/cleanup-e2e-demo-leads.mjs
 *   CONFIRM_E2E_LEAD_CLEANUP=true ALLOW_SHARED_REMOTE_E2E_CLEANUP=true \
 *     node --import ./scripts/load-local-env.mjs scripts/cleanup-e2e-demo-leads.mjs
 *
 * Guards:
 * - Never runs against production-confirmed (WEXON_E2E_TARGET=production + confirm).
 * - shared remote-unverified requires ALLOW_SHARED_REMOTE_E2E_CLEANUP=true.
 * - No unfiltered deletes; matches source prefix / E2E company / e2e.@example.com only.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true, quiet: true });

const KNOWN_E2E_SOURCES = new Set([
  "e2e-eligibility-safety",
  "e2e-admin-crm",
  "e2e-audit",
]);

function classify() {
  const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
  const target = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
  const confirm = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
  const base = process.env.E2E_BASE_URL || process.env.SMOKE_BASE_URL || "";
  if (target === "production" && confirm) return "production-confirmed";
  if (/localhost|127\.0\.0\.1|host\.docker\.internal/.test(url)) return "local";
  if (/vercel\.app|preview/i.test(base)) return "preview";
  if (/supabase\.com|neon\.tech|pooler/.test(url)) return "shared remote-unverified";
  return url ? "shared remote-unverified" : "missing-db";
}

function isE2eLead(meta) {
  if (!meta || typeof meta !== "object") return false;
  const source = String(meta.source ?? "").toLowerCase();
  const email = String(meta.email ?? "").toLowerCase();
  const company = String(meta.company ?? "");
  const fullName = String(meta.fullName ?? "");
  const message = String(meta.message ?? "");

  const sourceOk =
    KNOWN_E2E_SOURCES.has(source) ||
    source.startsWith("e2e-eligibility-safety.") ||
    source.startsWith("e2e-");
  const identityOk =
    (email.endsWith("@example.com") && email.includes("e2e")) ||
    company.startsWith("E2E[WXP]") ||
    /^E2E\b/.test(company) ||
    /^E2E\b/.test(fullName) ||
    company.includes("E2E Wexon Test Org") ||
    /E2E eligibility|E2E audit|E2E admin CRM|E2E\[WXP\]/i.test(message);

  return sourceOk && identityOk;
}

async function main() {
  const classification = classify();
  const apply = process.env.CONFIRM_E2E_LEAD_CLEANUP === "true";
  const allowShared = process.env.ALLOW_SHARED_REMOTE_E2E_CLEANUP === "true";

  if (classification === "production-confirmed") {
    console.error("REFUSED: production-confirmed — no cleanup.");
    process.exit(2);
  }
  if (classification === "missing-db") {
    console.error("REFUSED: missing database URL.");
    process.exit(2);
  }
  if (classification === "shared remote-unverified" && apply && !allowShared) {
    console.error(
      "REFUSED apply on shared remote-unverified without ALLOW_SHARED_REMOTE_E2E_CLEANUP=true.",
    );
    process.exit(2);
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    ssl: String(url).includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: "public.demo_request.created" },
      select: { id: true, createdAt: true, metadataJson: true },
      orderBy: { createdAt: "asc" },
    });

    const matches = rows.filter((row) => isE2eLead(row.metadataJson));
    const bySource = {};
    for (const row of matches) {
      const meta = row.metadataJson && typeof row.metadataJson === "object" ? row.metadataJson : {};
      const source = String(meta.source ?? "unknown");
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
    const dates = matches.map((r) => r.createdAt.getTime());

    const report = {
      mode: apply ? "APPLY" : "DRY_RUN",
      classification,
      matched: matches.length,
      bySource,
      dateRange:
        dates.length === 0
          ? null
          : {
              earliest: new Date(Math.min(...dates)).toISOString(),
              latest: new Date(Math.max(...dates)).toISOString(),
            },
      ids: matches.map((r) => r.id),
    };

    if (!apply) {
      console.log(JSON.stringify({ ...report, note: "Dry-run only. No deletes." }, null, 2));
      return;
    }

    const ids = matches.map((r) => r.id);
    let deletedRelated = 0;
    if (ids.length > 0) {
      const related = await prisma.auditLog.findMany({
        where: {
          action: {
            in: [
              "public.demo_request.status_updated",
              "public.demo_request.followup_updated",
              "public.demo_request.recorded",
            ],
          },
        },
        select: { id: true, entityId: true, metadataJson: true },
        take: 2000,
      });
      const relatedIds = related
        .filter((row) => {
          if (row.entityId && ids.includes(row.entityId)) return true;
          const meta =
            row.metadataJson && typeof row.metadataJson === "object"
              ? row.metadataJson
              : {};
          const leadId = String(meta.originalDemoRequestId ?? meta.leadId ?? "");
          return ids.includes(leadId);
        })
        .map((row) => row.id);
      if (relatedIds.length) {
        deletedRelated = (await prisma.auditLog.deleteMany({ where: { id: { in: relatedIds } } })).count;
      }
      const deletedCreated = await prisma.auditLog.deleteMany({
        where: { id: { in: ids }, action: "public.demo_request.created" },
      });
      console.log(
        JSON.stringify(
          {
            ...report,
            deletedCreated: deletedCreated.count,
            deletedRelated,
            note: "Applied marker-scoped cleanup only.",
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(JSON.stringify({ ...report, deletedCreated: 0, deletedRelated: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
