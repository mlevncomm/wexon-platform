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
    key: "wexpay_basic",
    name: "Basic",
    description: "Starter package for single-branch cafes.",
    sortOrder: 1,
    priceMonthly: 1490,
    priceYearly: 14900,
    currency: "TRY",
    taxRatePct: 20,
    entitlements: {
      branch_limit: 1,
      table_limit: 20,
      product_limit: 50,
      staff_limit: 3,
      monthly_order_limit: 1500,
      api_request_limit: 10000,
      reporting_level: "basic",
      integration_level: "standard",
      support_level: "standard",
      role_level: "basic",
    },
  },
  {
    key: "wexpay_standard",
    name: "Standard",
    description: "Standard operations package for growing restaurants.",
    sortOrder: 2,
    priceMonthly: 2990,
    priceYearly: 29900,
    currency: "TRY",
    taxRatePct: 20,
    entitlements: {
      branch_limit: 2,
      table_limit: 75,
      product_limit: 250,
      staff_limit: 10,
      monthly_order_limit: 7500,
      api_request_limit: 50000,
      reporting_level: "standard",
      integration_level: "standard",
      support_level: "priority",
      role_level: "standard",
    },
  },
  {
    key: "wexpay_pro",
    name: "Pro",
    description: "Advanced package for multi-branch restaurant operations.",
    sortOrder: 3,
    priceMonthly: 5990,
    priceYearly: 59900,
    currency: "TRY",
    taxRatePct: 20,
    entitlements: {
      branch_limit: 10,
      table_limit: 300,
      product_limit: 1000,
      staff_limit: 50,
      monthly_order_limit: 30000,
      api_request_limit: 200000,
      reporting_level: "advanced",
      integration_level: "advanced",
      support_level: "priority",
      role_level: "advanced",
    },
  },
];

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
        isPublic: true,
        isActive: true,
        sortOrder: plan.sortOrder,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        taxRatePct: plan.taxRatePct,
      },
      create: {
        productId: wexPayProduct.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        billingInterval: "MONTHLY",
        isPublic: true,
        isActive: true,
        sortOrder: plan.sortOrder,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        taxRatePct: plan.taxRatePct,
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
