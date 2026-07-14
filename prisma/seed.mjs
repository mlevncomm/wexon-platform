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

const wexPayPlans = [
  {
    key: "wexpay_essential",
    tierKey: "essential",
    name: "WexPay Essential",
    description: "Tek lokasyon, basit operasyonlu küçük işletmeler",
    sortOrder: 1,
    priceMonthly: 7000,
    priceYearly: 70000,
    setupFee: 12000,
    processingFeePct: 2.89,
    minimumTransactionCommitment: 10000,
    requiresManualReview: false,
    settlementDisplay: "Standart settlement · uygunluk ve sağlayıcı onayına bağlı",
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    entitlements: {
      branch_limit: 1,
      table_limit: 30,
      product_limit: 80,
      staff_limit: 5,
      monthly_order_limit: 3000,
      api_request_limit: 0,
      reporting_level: "basic",
      integration_level: "none",
      support_level: "standard",
      role_level: "basic",
      feature_subscriptions: false,
      feature_qr_basic: true,
      feature_qr_advanced: false,
      feature_pos_bridge: false,
      feature_multi_location: false,
      feature_reporting_advanced: false,
      feature_api_access: false,
      feature_priority_support: false,
      feature_fast_settlement_eligible: false,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    key: "wexpay_growth",
    tierKey: "growth",
    name: "WexPay Growth",
    description: "1–5 lokasyon, düzenli tahsilat yapan orta ölçekli işletmeler",
    sortOrder: 2,
    priceMonthly: 15000,
    priceYearly: 150000,
    setupFee: 25000,
    processingFeePct: 2.59,
    minimumTransactionCommitment: 20000,
    requiresManualReview: false,
    settlementDisplay: "Standart / hızlı settlement · teklif bazlı",
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    entitlements: {
      branch_limit: 5,
      table_limit: 120,
      product_limit: 400,
      staff_limit: 25,
      monthly_order_limit: 15000,
      api_request_limit: 50000,
      reporting_level: "standard",
      integration_level: "basic",
      support_level: "priority",
      role_level: "standard",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: false,
      feature_multi_location: true,
      feature_reporting_advanced: false,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: false,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    key: "wexpay_scale",
    tierKey: "scale",
    name: "WexPay Scale",
    description: "5+ lokasyon, zincirleşen veya yüksek hacimli işletmeler",
    sortOrder: 3,
    priceMonthly: 35000,
    priceYearly: 350000,
    setupFee: 60000,
    processingFeePct: 2.35,
    minimumTransactionCommitment: 45000,
    requiresManualReview: true,
    settlementDisplay: "Hızlı / teklif bazlı settlement · underwriting sonrası",
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    entitlements: {
      branch_limit: 25,
      table_limit: 500,
      product_limit: 2000,
      staff_limit: 100,
      monthly_order_limit: 60000,
      api_request_limit: 250000,
      reporting_level: "advanced",
      integration_level: "advanced",
      support_level: "priority",
      role_level: "advanced",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: true,
      feature_multi_location: true,
      feature_reporting_advanced: true,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: true,
      feature_custom_settlement: false,
      feature_invoicing_exports: true,
    },
  },
  {
    key: "wexpay_business_suite",
    tierKey: "business_suite",
    name: "WexPay Business Suite",
    description: "Franchise, grup şirketi veya yüksek hacimli zincir — invite-only",
    sortOrder: 4,
    priceMonthly: 99000,
    priceYearly: null,
    setupFee: 150000,
    processingFeePct: 2.05,
    minimumTransactionCommitment: 90000,
    requiresManualReview: true,
    settlementDisplay: "Özel settlement modeli · sözleşme ve reserve ile",
    currency: "TRY",
    taxRatePct: 20,
    isPublic: true,
    isActive: true,
    entitlements: {
      branch_limit: -1,
      table_limit: -1,
      product_limit: -1,
      staff_limit: -1,
      monthly_order_limit: -1,
      api_request_limit: -1,
      reporting_level: "custom",
      integration_level: "custom",
      support_level: "enterprise",
      role_level: "enterprise",
      feature_subscriptions: true,
      feature_qr_basic: true,
      feature_qr_advanced: true,
      feature_pos_bridge: true,
      feature_multi_location: true,
      feature_reporting_advanced: true,
      feature_api_access: true,
      feature_priority_support: true,
      feature_fast_settlement_eligible: true,
      feature_custom_settlement: true,
      feature_invoicing_exports: true,
    },
  },
];

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
    await prisma.plan.updateMany({
      where: { key: legacyKey },
      data: { isPublic: false, isActive: false },
    });
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
