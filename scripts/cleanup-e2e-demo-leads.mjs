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
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

const EXPECTED_MATCH_COUNT = Number(process.env.E2E_LEAD_EXPECTED_COUNT ?? 25);

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

  // ALL three required (no partial matches).
  const sourceOk =
    source.startsWith("e2e-") ||
    KNOWN_E2E_SOURCES.has(source) ||
    source.startsWith("e2e-eligibility-safety.");

  const emailOk =
    (email.endsWith("@example.com") && email.includes("e2e")) ||
    /^e2e[.+_-]/i.test(email);

  const nameOk =
    company.startsWith("E2E[WXP]") ||
    /^E2E\b/.test(company) ||
    /^E2E\b/.test(fullName) ||
    company.includes("E2E Wexon Test Org") ||
    /E2E\[WXP\]/.test(company) ||
    /E2E\[WXP\]/.test(fullName);

  return sourceOk && emailOk && nameOk;
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
      // Collapse unique run suffixes for eligibility-safety.* into base bucket for reporting.
      const bucket = source.startsWith("e2e-eligibility-safety")
        ? "e2e-eligibility-safety"
        : source;
      bySource[bucket] = (bySource[bucket] ?? 0) + 1;
    }
    const dates = matches.map((r) => r.createdAt.getTime());

    const exportPath =
      process.env.E2E_LEAD_EXPORT_PATH?.trim() ||
      join(tmpdir(), `wexon-e2e-lead-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

    writeFileSync(
      exportPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          classification,
          matched: matches.length,
          bySource,
          rows: matches.map((row) => ({
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            metadataJson: row.metadataJson,
          })),
        },
        null,
        2,
      ),
      "utf8",
    );

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
      exportPath,
      remainingNonE2ePreview: rows.length - matches.length,
    };

    if (!apply) {
      console.log(JSON.stringify({ ...report, note: "Dry-run only. No deletes. Export written." }, null, 2));
      return;
    }

    if (matches.length !== EXPECTED_MATCH_COUNT) {
      console.error(
        `REFUSED apply: matched ${matches.length} !== expected ${EXPECTED_MATCH_COUNT}. Export at ${exportPath}`,
      );
      process.exit(3);
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

      const remaining = await prisma.auditLog.findMany({
        where: { action: "public.demo_request.created" },
        select: { id: true, metadataJson: true },
      });
      const remainingE2e = remaining.filter((row) => isE2eLead(row.metadataJson));

      console.log(
        JSON.stringify(
          {
            ...report,
            deletedCreated: deletedCreated.count,
            deletedRelated,
            remainingDemoRequests: remaining.length,
            remainingE2eMarkers: remainingE2e.length,
            remainingNonE2eIds: remaining
              .filter((row) => !isE2eLead(row.metadataJson))
              .map((row) => row.id),
            note: "Applied marker-scoped cleanup only. Export retained locally (not committed).",
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
