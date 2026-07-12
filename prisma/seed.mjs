import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { WEXPAY_PLAN_CATALOG } from "../lib/wexon-plan-catalog.mjs";

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

// WexPay plans are derived from the canonical catalog so seeded prices,
// entitlement limits and the runtime checkout/marketing values never diverge.
const wexPayPlans = WEXPAY_PLAN_CATALOG.map((plan) => ({
  key: plan.dbKey,
  name: plan.name,
  description: plan.description,
  sortOrder: plan.sortOrder,
  priceMonthly: plan.priceMonthly,
  priceYearly: plan.priceYearly,
  currency: plan.currency,
  entitlements: plan.entitlements,
}));

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
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        isPublic: true,
        isActive: true,
        sortOrder: plan.sortOrder,
      },
      create: {
        productId: wexPayProduct.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        billingInterval: "MONTHLY",
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        isPublic: true,
        isActive: true,
        sortOrder: plan.sortOrder,
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
