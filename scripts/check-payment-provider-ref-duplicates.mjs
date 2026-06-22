#!/usr/bin/env node
/**
 * Preflight check before migration 20260609120000_payment_provider_ref_unique.
 * Detects duplicate (provider, providerRef) pairs that would block:
 *   CREATE UNIQUE INDEX ... ON "Payment" (provider, providerRef) WHERE providerRef IS NOT NULL
 *
 * Logs provider names and payment IDs only — never secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Preflight failed: DIRECT_URL or DATABASE_URL is not configured.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

function formatPaymentIds(ids) {
  if (Array.isArray(ids)) return ids.map(String).join(", ");
  return String(ids ?? "");
}

async function main() {
  try {
    const duplicates = await prisma.$queryRaw`
      SELECT
        provider,
        "providerRef",
        COUNT(*)::int AS count,
        array_agg(id ORDER BY "createdAt" ASC) AS payment_ids
      FROM "Payment"
      WHERE "providerRef" IS NOT NULL
      GROUP BY provider, "providerRef"
      HAVING COUNT(*) > 1
      ORDER BY provider ASC, "providerRef" ASC
    `;

    if (!Array.isArray(duplicates) || duplicates.length === 0) {
      console.log("Payment providerRef preflight passed: no duplicate (provider, providerRef) pairs.");
      return;
    }

    console.error(`Payment providerRef preflight failed: ${duplicates.length} duplicate group(s) found.`);
    console.error("Migration 20260609120000_payment_provider_ref_unique would fail.");
    console.error("");
    console.error("Duplicate groups:");

    for (const row of duplicates) {
      const provider = row.provider ?? "(null)";
      const providerRef = row.providerRef ?? "(null)";
      const count = row.count ?? 0;
      const paymentIds = formatPaymentIds(row.payment_ids);
      console.error(`  - provider=${provider} providerRef=${providerRef} count=${count}`);
      console.error(`    paymentIds: ${paymentIds}`);
    }

    console.error("");
    console.error("Remediation (manual review required before migrate deploy):");
    console.error("  1. Keep the canonical Payment row (usually newest PAID or active PENDING).");
    console.error("  2. Clear providerRef on duplicate rows OR delete orphan test rows:");
    console.error('     UPDATE "Payment" SET "providerRef" = NULL WHERE id = \'<duplicate-payment-id>\';');
    console.error("  3. Re-run: npm run db:check:payment-provider-ref");
    console.error("  4. Then: npm run production:preflight");
    console.error("     (or: npm run prisma:migrate:deploy after checks pass separately)");

    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("database")) {
      console.error("Payment providerRef preflight: database unreachable.");
      console.error("Set DIRECT_URL (or DATABASE_URL) and retry before staging/production migrate deploy.");
    } else {
      console.error("Payment providerRef preflight error:", message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
