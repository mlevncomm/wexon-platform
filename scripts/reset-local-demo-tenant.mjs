#!/usr/bin/env node
/**
 * Local-only: wipe all tenant organizations, then seed ONE usable WexPay demo business
 * with sample categories/products/tables.
 *
 * Fail-closed — isolated e2e DB only (127.0.0.1:5433 / wexon_e2e).
 *
 *   node --import ./scripts/load-local-env.mjs scripts/reset-local-demo-tenant.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  assertIsolatedWexPayDatabase,
  describeDatabaseSafely,
} from "./e2e-isolated-guards.mjs";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("reset-local-demo-tenant cannot run in production.");
}

process.env.WEXON_ALLOW_LOCAL_DB_TESTS = "1";
process.env.WEXON_E2E_TARGET = "isolated";
process.env.WEXON_E2E_CONFIRM_ISOLATED = "true";
assertIsolatedWexPayDatabase("reset-local-demo-tenant");
{
  const desc = describeDatabaseSafely(process.env.DIRECT_URL || process.env.DATABASE_URL || "");
  console.log(
    `[reset-demo] isolated OK host=${desc?.host ?? "?"} port=${desc?.port || "?"} db=${desc?.database ?? "?"}`,
  );
}

const scryptAsync = promisify(scrypt);
const adapter = new PrismaPg(process.env.DIRECT_URL || process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const DEMO = {
  organizationName: "Demo Kebap Evi",
  organizationSlug: "demo-kebap-evi",
  organizationEmail: "demo@wexon.dev",
  userEmail: "demo@wexon.dev",
  userName: "Demo İşletme Sahibi",
  userPassword: "Wexon-Demo-2026",
  restaurantSlug: "demo-kebap-evi-restoran",
  restaurantName: "Demo Kebap Evi",
  branchSlug: "merkez",
  branchName: "Merkez Şube",
  tables: [
    { label: "Masa 01", seats: 4, qrCode: "WEXPAY-demo-kebap-MASA-01" },
    { label: "Masa 02", seats: 2, qrCode: "WEXPAY-demo-kebap-MASA-02" },
    { label: "Masa 03", seats: 6, qrCode: "WEXPAY-demo-kebap-MASA-03" },
  ],
};

const MENU = [
  {
    name: "Çorbalar",
    products: [
      { id: "mercimek", name: "Mercimek Çorbası", description: "Günlük taze mercimek çorbası.", price: "90.00", popular: true },
      { id: "ezogelin", name: "Ezogelin Çorbası", description: "Nane ve kırmızı biberli.", price: "95.00", popular: false },
      { id: "yayla", name: "Yayla Çorbası", description: "Yoğurtlu, ferah.", price: "95.00", popular: false },
    ],
  },
  {
    name: "Başlangıçlar",
    products: [
      { id: "humus", name: "Humus", description: "Zeytinyağı ve pul biber ile.", price: "120.00", popular: false },
      { id: "cacik", name: "Cacık", description: "Naneli yoğurtlu cacık.", price: "90.00", popular: false },
      { id: "sigara", name: "Sigara Böreği", description: "4 adet, çıtır.", price: "140.00", popular: true },
    ],
  },
  {
    name: "Ana Yemekler",
    products: [
      { id: "adana", name: "Adana Kebap", description: "Acılı kıyma, lavaş ve salata ile.", price: "420.00", popular: true },
      { id: "urfa", name: "Urfa Kebap", description: "Acısız kıyma kebap.", price: "420.00", popular: true },
      { id: "tavuk", name: "Izgara Tavuk Şiş", description: "Mevsim garnitür ile.", price: "360.00", popular: true },
      { id: "kofte", name: "Izgara Köfte", description: "Pirinç pilavı ile servis.", price: "380.00", popular: false },
      { id: "lahmacun", name: "Lahmacun", description: "İnce hamur, bol malzeme.", price: "110.00", popular: true },
    ],
  },
  {
    name: "Tatlılar",
    products: [
      { id: "kunefe", name: "Künefe", description: "Antep fıstıklı, sıcak servis.", price: "220.00", popular: true },
      { id: "sutlac", name: "Sütlaç", description: "Fırın sütlaç.", price: "140.00", popular: false },
      { id: "baklava", name: "Baklava", description: "2 dilim.", price: "180.00", popular: true },
    ],
  },
  {
    name: "İçecekler",
    products: [
      { id: "ayran", name: "Ayran", description: "Ev yapımı.", price: "40.00", popular: true },
      { id: "cola", name: "Kola", description: "330 ml.", price: "55.00", popular: false },
      { id: "su", name: "Su", description: "0.5 L.", price: "25.00", popular: false },
      { id: "cay", name: "Çay", description: "Demlik çay.", price: "30.00", popular: true },
    ],
  },
];

const entitlements = {
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
};

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:v1:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

function addPeriod(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function entitlementValue(key, value) {
  if (typeof value === "boolean") return { key, valueType: "BOOLEAN", valueBool: value };
  if (typeof value === "number") return { key, valueType: "INTEGER", valueInt: value };
  return { key, valueType: "STRING", valueString: String(value) };
}

async function wipeTenants() {
  const before = await prisma.organization.count();
  const userBefore = await prisma.user.count();
  const restaurantBefore = await prisma.restaurant.count();

  // Organization → Restaurant is onDelete: SetNull, so clear restaurants first
  // (cascades branches → tables / menu / modifiers).
  const deletedRestaurants = await prisma.restaurant.deleteMany({});

  // Cascade removes licenses, memberships, journeys, installations, etc.
  const deletedOrgs = await prisma.organization.deleteMany({});

  // Orphan customer users (PlatformAdmin is a separate table).
  const deletedUsers = await prisma.user.deleteMany({});

  console.log(
    `[reset-demo] wiped organizations=${deletedOrgs.count}/${before} restaurants=${deletedRestaurants.count}/${restaurantBefore} users=${deletedUsers.count}/${userBefore}`,
  );
}

async function ensureWexPayPlan() {
  const product = await prisma.product.upsert({
    where: { key: "wexpay" },
    update: {
      name: "WexPay",
      status: "ACTIVE",
      isActive: true,
      description: "QR menu, order, payment and restaurant operations product.",
    },
    create: {
      key: "wexpay",
      name: "WexPay",
      status: "ACTIVE",
      isActive: true,
      description: "QR menu, order, payment and restaurant operations product.",
    },
  });

  const plan = await prisma.plan.upsert({
    where: { key: "wexpay_growth" },
    update: {
      productId: product.id,
      name: "WexPay Growth",
      description: "Growth operations package for expanding venues.",
      billingInterval: "MONTHLY",
      isPublic: true,
      isActive: true,
      sortOrder: 2,
      priceMonthly: 15000,
      priceYearly: 150000,
      currency: "TRY",
      taxRatePct: 20,
      tierKey: "growth",
    },
    create: {
      productId: product.id,
      key: "wexpay_growth",
      name: "WexPay Growth",
      description: "Growth operations package for expanding venues.",
      billingInterval: "MONTHLY",
      isPublic: true,
      isActive: true,
      sortOrder: 2,
      priceMonthly: 15000,
      priceYearly: 150000,
      currency: "TRY",
      taxRatePct: 20,
      tierKey: "growth",
    },
  });

  for (const [key, value] of Object.entries(entitlements)) {
    await prisma.entitlement.upsert({
      where: { planId_key: { planId: plan.id, key } },
      update: entitlementValue(key, value),
      create: { planId: plan.id, ...entitlementValue(key, value) },
    });
  }

  return { product, plan };
}

async function seedDemo({ product, plan }) {
  const now = new Date();
  const periodEnd = addPeriod(now, 12);
  const passwordHash = await hashPassword(DEMO.userPassword);

  const organization = await prisma.organization.create({
    data: {
      name: DEMO.organizationName,
      slug: DEMO.organizationSlug,
      email: DEMO.organizationEmail,
      country: "TR",
      // Public /wexpay/t/* resolves reject isDemo orgs — local guest QR needs a real-shaped tenant.
      isDemo: false,
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: DEMO.userEmail,
      name: DEMO.userName,
      isActive: true,
      passwordHash,
      passwordSetAt: now,
      mustChangePassword: false,
    },
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      acceptedAt: now,
    },
  });

  const license = await prisma.license.create({
    data: {
      id: "demo-kebap-evi-wexpay-license",
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "YEARLY",
      startsAt: now,
      endsAt: periodEnd,
    },
  });

  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      licenseId: license.id,
      planId: plan.id,
      status: "ACTIVE",
      interval: "YEARLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider: "manual",
      providerRef: "reset-local-demo-tenant",
    },
  });

  await prisma.appInstallation.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      licenseId: license.id,
      status: "ACTIVE",
      settingsJson: {
        environment: "local_demo",
        onboardingStatus: "READY",
      },
    },
  });

  const stepKeys = [
    "BUSINESS_PROFILE",
    "BRANCH_SETUP",
    "TABLE_SETUP",
    "STAFF_INVITE",
    "MENU_IMPORT",
    "PAYMENT_PROVIDER",
    "VALIDATION",
    "GO_LIVE",
  ];
  const journey = await prisma.activationJourney.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      status: "ACTIVE",
      source: "LEGACY_BACKFILL",
      currentStep: "GO_LIVE",
      completedAt: now,
    },
  });
  for (const stepKey of stepKeys) {
    await prisma.activationJourneyStep.create({
      data: {
        journeyId: journey.id,
        stepKey,
        status: ["STAFF_INVITE", "MENU_IMPORT"].includes(stepKey) ? "SKIPPED" : "COMPLETED",
        attemptCount: 0,
        completedAt: now,
      },
    });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: DEMO.restaurantName,
      slug: DEMO.restaurantSlug,
      isActive: true,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: DEMO.branchName,
      slug: DEMO.branchSlug,
      isActive: true,
    },
  });

  for (const table of DEMO.tables) {
    await prisma.restaurantTable.create({
      data: {
        branchId: branch.id,
        label: table.label,
        seats: table.seats,
        qrCode: table.qrCode,
        isActive: true,
      },
    });
  }

  let productCount = 0;
  for (const [catIndex, categoryDef] of MENU.entries()) {
    const category = await prisma.menuCategory.create({
      data: {
        branchId: branch.id,
        name: categoryDef.name,
        sortOrder: catIndex,
        isActive: true,
      },
    });

    for (const [prodIndex, item] of categoryDef.products.entries()) {
      await prisma.menuProduct.create({
        data: {
          id: `${branch.id}-${item.id}`,
          branchId: branch.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: "TRY",
          isActive: true,
          inStock: true,
          isPopular: item.popular,
          sortOrder: prodIndex,
        },
      });
      productCount += 1;
    }
  }

  // Sample modifier on Adana Kebap
  const adanaId = `${branch.id}-adana`;
  const sizeGroup = await prisma.menuModifierGroup.create({
    data: {
      id: `${branch.id}-mod-porsiyon`,
      branchId: branch.id,
      name: "Porsiyon",
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      isActive: true,
    },
  });
  await prisma.menuModifierOption.createMany({
    data: [
      {
        id: `${branch.id}-opt-tek`,
        groupId: sizeGroup.id,
        name: "Tek",
        priceDelta: "0.00",
        sortOrder: 0,
        isActive: true,
      },
      {
        id: `${branch.id}-opt-1-5`,
        groupId: sizeGroup.id,
        name: "1.5 Porsiyon",
        priceDelta: "120.00",
        sortOrder: 1,
        isActive: true,
      },
    ],
  });
  await prisma.menuProductModifierGroup.create({
    data: {
      id: `${branch.id}-link-adana-porsiyon`,
      branchId: branch.id,
      productId: adanaId,
      groupId: sizeGroup.id,
      sortOrder: 0,
      isActive: true,
    },
  });

  return {
    organization,
    userEmail: DEMO.userEmail,
    userPassword: DEMO.userPassword,
    categories: MENU.length,
    products: productCount,
    tables: DEMO.tables.map((t) => t.qrCode),
    guestUrl: `/wexpay/t/${DEMO.tables[0].qrCode}`,
  };
}

async function main() {
  await wipeTenants();
  const catalog = await ensureWexPayPlan();
  const result = await seedDemo(catalog);

  const orgCount = await prisma.organization.count();
  const catCount = await prisma.menuCategory.count();
  const prodCount = await prisma.menuProduct.count();

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationsLeft: orgCount,
        organization: {
          name: result.organization.name,
          slug: result.organization.slug,
          isDemo: false,
        },
        login: {
          email: result.userEmail,
          password: result.userPassword,
          dashboard: "/dashboard/login",
        },
        menu: { categories: catCount, products: prodCount },
        guestQrCodes: result.tables,
        sampleGuestPath: result.guestUrl,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[reset-demo] failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
