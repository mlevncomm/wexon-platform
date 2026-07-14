#!/usr/bin/env node
/**
 * Read-only WexPay plan safety audit.
 * Checks tier catalog posture, legacy plan retirement, and entitlement soft-deactivate columns.
 * Does NOT mutate rows.
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

const adapter = new PrismaPg(process.env.DIRECT_URL);
const prisma = new PrismaClient({ adapter });

const EXPECTED_PUBLIC_TIERS = ["essential", "growth", "scale", "business_suite"];
const LEGACY_KEYS = ["wexpay_basic", "wexpay_standard", "wexpay_pro"];

async function main() {
  const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
  if (!product) {
    console.error("FAIL: wexpay product missing");
    process.exitCode = 1;
    return;
  }

  const publicPlans = await prisma.plan.findMany({
    where: { productId: product.id, isPublic: true, isActive: true },
    select: {
      key: true,
      tierKey: true,
      name: true,
      priceMonthly: true,
      entitlements: { select: { id: true, key: true, isActive: true, deactivatedAt: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const publicTierKeys = publicPlans.map((plan) => plan.tierKey).filter(Boolean);
  const missingTiers = EXPECTED_PUBLIC_TIERS.filter((tier) => !publicTierKeys.includes(tier));

  console.log("=== WexPay public active plans ===");
  for (const plan of publicPlans) {
    const inactiveEntitlements = plan.entitlements.filter((entry) => !entry.isActive).length;
    console.log(
      `- ${plan.key} (${plan.tierKey ?? "?"}) monthly=${plan.priceMonthly ?? "n/a"} inactive_entitlements=${inactiveEntitlements}`,
    );
  }

  if (missingTiers.length) {
    console.warn(`WARN: missing public tiers: ${missingTiers.join(", ")}`);
  }

  const legacyPlans = await prisma.plan.findMany({
    where: { productId: product.id, key: { in: LEGACY_KEYS } },
    select: {
      key: true,
      isPublic: true,
      isActive: true,
      _count: {
        select: {
          licenses: true,
          subscriptions: true,
        },
      },
    },
  });

  console.log("\n=== Legacy plan retirement ===");
  for (const plan of legacyPlans) {
    const posture = plan.isPublic ? "PUBLIC (unexpected)" : "private";
    console.log(
      `- ${plan.key}: ${posture}, isActive=${plan.isActive}, licenses=${plan._count.licenses}, subscriptions=${plan._count.subscriptions}`,
    );
    if (plan.isPublic) process.exitCode = 1;
    if (!plan.isActive && (plan._count.licenses > 0 || plan._count.subscriptions > 0)) {
      console.warn(`WARN: ${plan.key} inactive but still referenced`);
    }
  }

  const sampleEntitlement = await prisma.entitlement.findFirst({
    select: { isActive: true, deactivatedAt: true },
  });
  if (!sampleEntitlement || sampleEntitlement.isActive === undefined) {
    console.error("FAIL: Entitlement.isActive column unavailable — run migrations");
    process.exitCode = 1;
  } else {
    console.log("\nOK: Entitlement soft-deactivate columns present");
  }

  console.log("\nAudit complete (read-only).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
