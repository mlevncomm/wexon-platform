import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
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

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("prisma seed production ortaminda calistirilamaz.");
}

const adapter = new PrismaPg(process.env.DIRECT_URL);
const prisma = new PrismaClient({ adapter });

const wexonProducts = [
  {
    key: "wexpay",
    name: "WexPay",
    status: "ACTIVE",
    description: "QR menu, order, payment and restaurant operations product.",
  },
  {
    key: "wexhotel",
    name: "WexHotel",
    status: "UPCOMING",
    description: "Hotel and accommodation management product.",
  },
  {
    key: "wexb2b",
    name: "WexB2B",
    status: "UPCOMING",
    description: "Dealer, wholesale and B2B order management product.",
  },
];

/** Canonical catalog — shared with TypeScript via data/wexpay-canonical-catalog.json */
const canonicalCatalog = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/wexpay-canonical-catalog.json"), "utf8"),
);
const MINOR = Number(canonicalCatalog.minorUnitsPerMajor) || 100;
function majorFromMinor(minor) {
  return minor / MINOR;
}

const wexPayPlans = canonicalCatalog.tiers.map((tier) => ({
  key: tier.planKey,
  tierKey: tier.tierKey,
  name: tier.displayName,
  description: tier.audience,
  sortOrder: tier.sortOrder,
  priceMonthly: majorFromMinor(tier.monthlyPriceMinor),
  priceYearly: tier.yearlyPriceMinor == null ? null : majorFromMinor(tier.yearlyPriceMinor),
  setupFee: majorFromMinor(tier.activationFeeMinor),
  processingFeePct: tier.processingFeePct,
  minimumTransactionCommitment: majorFromMinor(tier.minimumTransactionCommitmentMinor),
  requiresManualReview: tier.requiresManualReview,
  settlementDisplay: tier.settlementDisplay,
  currency: canonicalCatalog.currency || "TRY",
  taxRatePct: Math.round((canonicalCatalog.taxPolicy?.taxRateBps ?? 2000) / 100),
  isPublic: tier.isPublic,
  isActive: tier.isActive,
  entitlements: { ...tier.entitlements },
}));

/** Legacy SKUs kept for FK safety — unpublished and inactive for public cards. */
const legacyWexPayPlansToRetire = ["wexpay_basic", "wexpay_standard", "wexpay_pro"];

function entitlementValue(key, value) {
  if (typeof value === "boolean") {
    return { key, valueType: "BOOLEAN", valueBool: value };
  }

  if (typeof value === "number") {
    return { key, valueType: "INTEGER", valueInt: value };
  }

  return { key, valueType: "STRING", valueString: String(value) };
}

async function seedProductsAndPlans() {
  const productByKey = new Map();

  for (const product of wexonProducts) {
    const createdProduct = await prisma.product.upsert({
      where: { key: product.key },
      update: {
        name: product.name,
        status: product.status,
        description: product.description,
        isActive: true,
      },
      create: {
        key: product.key,
        name: product.name,
        status: product.status,
        description: product.description,
        isActive: true,
      },
    });

    productByKey.set(product.key, createdProduct);
  }

  const wexPayProduct = productByKey.get("wexpay");
  const planByKey = new Map();

  for (const plan of wexPayPlans) {
    const createdPlan = await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        productId: wexPayProduct.id,
        name: plan.name,
        description: plan.description,
        billingInterval: "MONTHLY",
        isPublic: plan.isPublic,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        taxRatePct: plan.taxRatePct,
        tierKey: plan.tierKey,
        setupFee: plan.setupFee,
        processingFeePct: plan.processingFeePct,
        minimumTransactionCommitment: plan.minimumTransactionCommitment,
        requiresManualReview: plan.requiresManualReview,
        settlementDisplay: plan.settlementDisplay,
      },
      create: {
        productId: wexPayProduct.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        billingInterval: "MONTHLY",
        isPublic: plan.isPublic,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        taxRatePct: plan.taxRatePct,
        tierKey: plan.tierKey,
        setupFee: plan.setupFee,
        processingFeePct: plan.processingFeePct,
        minimumTransactionCommitment: plan.minimumTransactionCommitment,
        requiresManualReview: plan.requiresManualReview,
        settlementDisplay: plan.settlementDisplay,
      },
    });

    planByKey.set(plan.key, createdPlan);

    for (const [key, value] of Object.entries(plan.entitlements)) {
      await prisma.entitlement.upsert({
        where: {
          planId_key: {
            planId: createdPlan.id,
            key,
          },
        },
        update: entitlementValue(key, value),
        create: {
          planId: createdPlan.id,
          ...entitlementValue(key, value),
        },
      });
    }
  }

  for (const legacyKey of legacyWexPayPlansToRetire) {
    const legacyPlans = await prisma.plan.findMany({
      where: { key: legacyKey },
      select: { id: true },
    });

    for (const legacyPlan of legacyPlans) {
      const [activeLicenseCount, activeSubscriptionCount] = await Promise.all([
        prisma.license.count({
          where: {
            planId: legacyPlan.id,
            status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
          },
        }),
        prisma.subscription.count({
          where: {
            planId: legacyPlan.id,
            status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
          },
        }),
      ]);

      await prisma.plan.update({
        where: { id: legacyPlan.id },
        data: {
          isPublic: false,
          isActive: activeLicenseCount > 0 || activeSubscriptionCount > 0,
        },
      });
    }
  }

  return { productByKey, planByKey };
}

async function main() {
  // Catalog bootstrap only. Real WexPay tenants come from prisma:seed:real /
  // admin provisioning — public interactive demo sandbox is removed.
  await seedProductsAndPlans();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
