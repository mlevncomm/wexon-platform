import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  assertIsolatedWexPayDatabase,
  describeDatabaseSafely,
} from "../scripts/e2e-isolated-guards.mjs";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  const isolatedPinned = process.env.WEXON_E2E_CONFIRM_ISOLATED === "true";
  for (const [key, value] of Object.entries(parsed)) {
    if (isolatedPinned && (key === "DATABASE_URL" || key === "DIRECT_URL" || key === "WEXON_E2E_TARGET")) {
      continue;
    }
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("seed-real-tenant production ortaminda calistirilamaz.");
}

// Fail-closed: never seed shared remote / production. Isolated local e2e DB only.
assertIsolatedWexPayDatabase("prisma:seed:real");
{
  const desc = describeDatabaseSafely(process.env.DIRECT_URL || process.env.DATABASE_URL || "");
  console.log(
    `[seed-real-tenant] isolated OK host=${desc?.host ?? "?"} port=${desc?.port || "?"} db=${desc?.database ?? "?"}`,
  );
}

const scryptAsync = promisify(scrypt);
const adapter = new PrismaPg(process.env.DIRECT_URL);
const prisma = new PrismaClient({ adapter });

const REAL_TENANT = {
  organizationName: "WexPay Real Test Organization",
  organizationSlug: "wexpay-real-test",
  organizationEmail: "real@wexon.dev",
  userEmail: "real@wexon.dev",
  userName: "WexPay Real Owner",
  userPassword: "Wexon-Customer-2026",
};

const INACTIVE_TENANT = {
  organizationName: "WexPay Inactive License Test",
  organizationSlug: "wexpay-inactive-test",
  organizationEmail: "inactive@wexon.dev",
};

const INACTIVE_OPS = {
  restaurantSlug: "wexpay-inactive-restaurant",
  restaurantName: "WexPay Inactive Test Restaurant",
  branchSlug: "inactive-sube",
  branchName: "Inactive Şube",
  tableLabel: "Masa 01",
  qrCode: "WEXPAY-inactive-test-MASA-01",
};

/** Deterministic smoke / public QR fixture (non-demo org). */
const REAL_OPS = {
  restaurantSlug: "wexpay-real-restaurant",
  restaurantName: "WexPay Real Test Restaurant",
  branchSlug: "merkez-sube",
  branchName: "Merkez Şube",
  tables: [
    { label: "Masa 01", seats: 4, qrCode: "WEXPAY-real-test-MASA-01" },
    { label: "Masa 02", seats: 2, qrCode: "WEXPAY-real-test-MASA-02" },
  ],
  categoryName: "Ana Yemekler",
  products: [
    {
      idSuffix: "mercimek-corbasi",
      name: "Mercimek Corbasi",
      description: "Gunluk hazirlanan sicak mercimek corbasi.",
      price: "120.00",
      isPopular: true,
    },
    {
      idSuffix: "izgara-tavuk",
      name: "Izgara Tavuk",
      description: "Mevsim garnituru ile servis edilir.",
      price: "390.00",
      isPopular: true,
    },
  ],
};

const wexPayEntitlements = {
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
  if (typeof value === "boolean") {
    return { key, valueType: "BOOLEAN", valueBool: value };
  }

  if (typeof value === "number") {
    return { key, valueType: "INTEGER", valueInt: value };
  }

  return { key, valueType: "STRING", valueString: String(value) };
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

  for (const [key, value] of Object.entries(wexPayEntitlements)) {
    await prisma.entitlement.upsert({
      where: {
        planId_key: {
          planId: plan.id,
          key,
        },
      },
      update: entitlementValue(key, value),
      create: {
        planId: plan.id,
        ...entitlementValue(key, value),
      },
    });
  }

  return { product, plan };
}

async function seedRealWexPayOperations(organization) {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: REAL_OPS.restaurantSlug },
    update: {
      organizationId: organization.id,
      name: REAL_OPS.restaurantName,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      name: REAL_OPS.restaurantName,
      slug: REAL_OPS.restaurantSlug,
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      restaurantId_slug: {
        restaurantId: restaurant.id,
        slug: REAL_OPS.branchSlug,
      },
    },
    update: {
      name: REAL_OPS.branchName,
      isActive: true,
    },
    create: {
      restaurantId: restaurant.id,
      name: REAL_OPS.branchName,
      slug: REAL_OPS.branchSlug,
      isActive: true,
    },
  });

  for (const table of REAL_OPS.tables) {
    await prisma.restaurantTable.upsert({
      where: {
        branchId_label: {
          branchId: branch.id,
          label: table.label,
        },
      },
      update: {
        qrCode: table.qrCode,
        isActive: true,
        seats: table.seats,
      },
      create: {
        branchId: branch.id,
        label: table.label,
        seats: table.seats,
        qrCode: table.qrCode,
        isActive: true,
      },
    });
  }

  const category = await prisma.menuCategory.upsert({
    where: {
      branchId_name: {
        branchId: branch.id,
        name: REAL_OPS.categoryName,
      },
    },
    update: { sortOrder: 0, isActive: true },
    create: {
      branchId: branch.id,
      name: REAL_OPS.categoryName,
      sortOrder: 0,
      isActive: true,
    },
  });

  for (const [index, product] of REAL_OPS.products.entries()) {
    const productId = `${branch.id}-${product.idSuffix}`;
    await prisma.menuProduct.upsert({
      where: { id: productId },
      update: {
        categoryId: category.id,
        description: product.description,
        price: product.price,
        isActive: true,
        inStock: true,
        isPopular: product.isPopular,
        sortOrder: index,
      },
      create: {
        id: productId,
        branchId: branch.id,
        categoryId: category.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: "TRY",
        isActive: true,
        inStock: true,
        isPopular: product.isPopular,
        sortOrder: index,
      },
    });
  }

  // Fixture modifiers (isolated E2E):
  // Mercimek: required SINGLE size (Standart 0 / Büyük +25)
  // Izgara Tavuk: optional MULTI extras (min 0, max 2)
  const mercimekId = `${branch.id}-mercimek-corbasi`;
  const izgaraId = `${branch.id}-izgara-tavuk`;

  const sizeGroup = await prisma.menuModifierGroup.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Boyut" } },
    update: {
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      isActive: true,
    },
    create: {
      id: `${branch.id}-mod-boyut`,
      branchId: branch.id,
      name: "Boyut",
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      isActive: true,
    },
  });

  const sizeStd = await prisma.menuModifierOption.upsert({
    where: { groupId_name: { groupId: sizeGroup.id, name: "Standart" } },
    update: { priceDelta: "0.00", sortOrder: 0, isActive: true },
    create: {
      id: `${branch.id}-opt-standart`,
      groupId: sizeGroup.id,
      name: "Standart",
      priceDelta: "0.00",
      sortOrder: 0,
      isActive: true,
    },
  });

  const sizeLarge = await prisma.menuModifierOption.upsert({
    where: { groupId_name: { groupId: sizeGroup.id, name: "Büyük" } },
    update: { priceDelta: "25.00", sortOrder: 1, isActive: true },
    create: {
      id: `${branch.id}-opt-buyuk`,
      groupId: sizeGroup.id,
      name: "Büyük",
      priceDelta: "25.00",
      sortOrder: 1,
      isActive: true,
    },
  });

  await prisma.menuProductModifierGroup.upsert({
    where: { productId_groupId: { productId: mercimekId, groupId: sizeGroup.id } },
    update: { branchId: branch.id, sortOrder: 0, isActive: true },
    create: {
      id: `${branch.id}-link-mercimek-boyut`,
      branchId: branch.id,
      productId: mercimekId,
      groupId: sizeGroup.id,
      sortOrder: 0,
      isActive: true,
    },
  });

  const extrasGroup = await prisma.menuModifierGroup.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Ekstra" } },
    update: {
      selectionType: "MULTI",
      minSelect: 0,
      maxSelect: 2,
      sortOrder: 1,
      isActive: true,
    },
    create: {
      id: `${branch.id}-mod-ekstra`,
      branchId: branch.id,
      name: "Ekstra",
      selectionType: "MULTI",
      minSelect: 0,
      maxSelect: 2,
      sortOrder: 1,
      isActive: true,
    },
  });

  const extraCheese = await prisma.menuModifierOption.upsert({
    where: { groupId_name: { groupId: extrasGroup.id, name: "Peynir" } },
    update: { priceDelta: "15.00", sortOrder: 0, isActive: true },
    create: {
      id: `${branch.id}-opt-peynir`,
      groupId: extrasGroup.id,
      name: "Peynir",
      priceDelta: "15.00",
      sortOrder: 0,
      isActive: true,
    },
  });

  const extraSauce = await prisma.menuModifierOption.upsert({
    where: { groupId_name: { groupId: extrasGroup.id, name: "Sos" } },
    update: { priceDelta: "10.00", sortOrder: 1, isActive: true },
    create: {
      id: `${branch.id}-opt-sos`,
      groupId: extrasGroup.id,
      name: "Sos",
      priceDelta: "10.00",
      sortOrder: 1,
      isActive: true,
    },
  });

  await prisma.menuProductModifierGroup.upsert({
    where: { productId_groupId: { productId: izgaraId, groupId: extrasGroup.id } },
    update: { branchId: branch.id, sortOrder: 0, isActive: true },
    create: {
      id: `${branch.id}-link-izgara-ekstra`,
      branchId: branch.id,
      productId: izgaraId,
      groupId: extrasGroup.id,
      sortOrder: 0,
      isActive: true,
    },
  });

  return {
    restaurant,
    branch,
    qrCode: REAL_OPS.tables[0].qrCode,
    secondaryQrCode: REAL_OPS.tables[1].qrCode,
    products: {
      mercimekId,
      izgaraId,
    },
    modifiers: {
      sizeGroupId: sizeGroup.id,
      sizeStdId: sizeStd.id,
      sizeLargeId: sizeLarge.id,
      extrasGroupId: extrasGroup.id,
      extraCheeseId: extraCheese.id,
      extraSauceId: extraSauce.id,
    },
  };
}

async function seedInactiveWexPayTenant(product) {
  const organization = await prisma.organization.upsert({
    where: { slug: INACTIVE_TENANT.organizationSlug },
    update: {
      name: INACTIVE_TENANT.organizationName,
      email: INACTIVE_TENANT.organizationEmail,
      country: "TR",
      isDemo: false,
      isActive: true,
    },
    create: {
      name: INACTIVE_TENANT.organizationName,
      slug: INACTIVE_TENANT.organizationSlug,
      email: INACTIVE_TENANT.organizationEmail,
      country: "TR",
      isDemo: false,
      isActive: true,
    },
  });

  await prisma.appInstallation.upsert({
    where: {
      organizationId_productId: {
        organizationId: organization.id,
        productId: product.id,
      },
    },
    update: {
      status: "DISABLED",
      settingsJson: {
        environment: "inactive_test",
        onboardingStatus: "READY",
      },
    },
    create: {
      organizationId: organization.id,
      productId: product.id,
      status: "DISABLED",
      settingsJson: {
        environment: "inactive_test",
        onboardingStatus: "READY",
      },
    },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: INACTIVE_OPS.restaurantSlug },
    update: {
      organizationId: organization.id,
      name: INACTIVE_OPS.restaurantName,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      name: INACTIVE_OPS.restaurantName,
      slug: INACTIVE_OPS.restaurantSlug,
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      restaurantId_slug: {
        restaurantId: restaurant.id,
        slug: INACTIVE_OPS.branchSlug,
      },
    },
    update: {
      name: INACTIVE_OPS.branchName,
      isActive: true,
    },
    create: {
      restaurantId: restaurant.id,
      name: INACTIVE_OPS.branchName,
      slug: INACTIVE_OPS.branchSlug,
      isActive: true,
    },
  });

  await prisma.restaurantTable.upsert({
    where: {
      branchId_label: {
        branchId: branch.id,
        label: INACTIVE_OPS.tableLabel,
      },
    },
    update: {
      qrCode: INACTIVE_OPS.qrCode,
      isActive: true,
      seats: 2,
    },
    create: {
      branchId: branch.id,
      label: INACTIVE_OPS.tableLabel,
      seats: 2,
      qrCode: INACTIVE_OPS.qrCode,
      isActive: true,
    },
  });

  return { ...organization, inactiveQrCode: INACTIVE_OPS.qrCode };
}

async function main() {
  const now = new Date();
  const periodEnd = addPeriod(now, 1);
  const { product, plan } = await ensureWexPayPlan();
  const passwordHash = await hashPassword(REAL_TENANT.userPassword);

  const organization = await prisma.organization.upsert({
    where: { slug: REAL_TENANT.organizationSlug },
    update: {
      name: REAL_TENANT.organizationName,
      email: REAL_TENANT.organizationEmail,
      country: "TR",
      isDemo: false,
      isActive: true,
    },
    create: {
      name: REAL_TENANT.organizationName,
      slug: REAL_TENANT.organizationSlug,
      email: REAL_TENANT.organizationEmail,
      country: "TR",
      isDemo: false,
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: REAL_TENANT.userEmail },
    update: {
      name: REAL_TENANT.userName,
      isActive: true,
      passwordHash,
      passwordSetAt: now,
      mustChangePassword: false,
    },
    create: {
      email: REAL_TENANT.userEmail,
      name: REAL_TENANT.userName,
      isActive: true,
      passwordHash,
      passwordSetAt: now,
      mustChangePassword: false,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      acceptedAt: now,
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      acceptedAt: now,
    },
  });

  const license = await prisma.license.upsert({
    where: { id: "real-wexpay-standard-license" },
    update: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: now,
      endsAt: periodEnd,
    },
    create: {
      id: "real-wexpay-standard-license",
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: now,
      endsAt: periodEnd,
    },
  });

  const subscription = await prisma.subscription.upsert({
    where: { licenseId: license.id },
    update: {
      organizationId: organization.id,
      planId: plan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider: "manual",
      providerRef: "seed-real-tenant-subscription",
    },
    create: {
      organizationId: organization.id,
      licenseId: license.id,
      planId: plan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider: "manual",
      providerRef: "seed-real-tenant-subscription",
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { invoiceNo: "INV-REAL-WEXPAY-0001" },
    update: {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      status: "PAID",
      subtotal: "999.00",
      tax: "199.80",
      total: "1198.80",
      currency: "TRY",
      issuedAt: now,
      paidAt: now,
    },
    create: {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      invoiceNo: "INV-REAL-WEXPAY-0001",
      status: "PAID",
      subtotal: "999.00",
      tax: "199.80",
      total: "1198.80",
      currency: "TRY",
      issuedAt: now,
      paidAt: now,
    },
  });

  await prisma.billingPayment.deleteMany({
    where: {
      organizationId: organization.id,
      provider: "manual",
      providerRef: "seed-real-tenant-payment",
    },
  });

  await prisma.billingPayment.create({
    data: {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      amount: "1198.80",
      currency: "TRY",
      status: "PAID",
      provider: "manual",
      providerRef: "seed-real-tenant-payment",
      paidAt: now,
    },
  });

  await prisma.appInstallation.upsert({
    where: {
      organizationId_productId: {
        organizationId: organization.id,
        productId: product.id,
      },
    },
    update: {
      licenseId: license.id,
      status: "ACTIVE",
      settingsJson: {
        environment: "real_test",
        onboardingStatus: "READY",
      },
    },
    create: {
      organizationId: organization.id,
      productId: product.id,
      licenseId: license.id,
      status: "ACTIVE",
      settingsJson: {
        environment: "real_test",
        onboardingStatus: "READY",
      },
    },
  });

  // Isolated E2E fixtures are created AFTER migrations, so legacy backfill does not
  // cover them. Seed an ACTIVE journey so public QR/order stays open without
  // relaxing the production public-live gate.
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
  const existingJourney = await prisma.activationJourney.findUnique({
    where: {
      organizationId_productId: {
        organizationId: organization.id,
        productId: product.id,
      },
    },
    select: { id: true },
  });
  if (existingJourney) {
    await prisma.activationJourney.update({
      where: { id: existingJourney.id },
      data: {
        status: "ACTIVE",
        source: "LEGACY_BACKFILL",
        currentStep: "GO_LIVE",
        completedAt: now,
        blockedReasonCode: null,
      },
    });
    for (const stepKey of stepKeys) {
      await prisma.activationJourneyStep.upsert({
        where: {
          journeyId_stepKey: { journeyId: existingJourney.id, stepKey },
        },
        update: {
          status: ["STAFF_INVITE", "MENU_IMPORT"].includes(stepKey) ? "SKIPPED" : "COMPLETED",
          completedAt: now,
          lastErrorCode: null,
        },
        create: {
          journeyId: existingJourney.id,
          stepKey,
          status: ["STAFF_INVITE", "MENU_IMPORT"].includes(stepKey) ? "SKIPPED" : "COMPLETED",
          attemptCount: 0,
          completedAt: now,
        },
      });
    }
  } else {
    await prisma.activationJourney.create({
      data: {
        organizationId: organization.id,
        productId: product.id,
        status: "ACTIVE",
        source: "LEGACY_BACKFILL",
        currentStep: "GO_LIVE",
        completedAt: now,
        version: 1,
        steps: {
          create: stepKeys.map((stepKey) => ({
            stepKey,
            status: ["STAFF_INVITE", "MENU_IMPORT"].includes(stepKey) ? "SKIPPED" : "COMPLETED",
            attemptCount: 0,
            completedAt: now,
          })),
        },
      },
    });
  }

  await prisma.activationFeeLedger.upsert({
    where: {
      organizationId_productId: {
        organizationId: organization.id,
        productId: product.id,
      },
    },
    update: {
      status: "WAIVED_LEGACY",
      activationFeeMinor: 0,
      waivedReason: "isolated_e2e_seed",
    },
    create: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "WAIVED_LEGACY",
      activationFeeMinor: 0,
      waivedReason: "isolated_e2e_seed",
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      organizationId: organization.id,
      action: "seed.real_tenant.created",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      action: "seed.real_tenant.created",
      entityType: "Organization",
      entityId: organization.id,
      metadataJson: {
        productKey: "wexpay",
        planKey: "wexpay_growth",
      },
    },
  });

  const ops = await seedRealWexPayOperations(organization);
  const inactiveOrg = await seedInactiveWexPayTenant(product);

  // Never print fixture passwords in logs when running under isolated E2E harness.
  const revealPassword = process.env.WEXON_E2E_SEED_REVEAL_PASSWORD === "true";
  console.log(
    JSON.stringify(
      {
        organization: {
          slug: organization.slug,
          isDemo: organization.isDemo,
        },
        user: {
          email: user.email,
          ...(revealPassword ? { password: REAL_TENANT.userPassword } : { passwordSet: true }),
        },
        smoke: {
          qrCode: ops.qrCode,
          secondaryQrCode: ops.secondaryQrCode,
          inactiveQrCode: inactiveOrg.inactiveQrCode,
          inactiveWexPayOrgSlug: inactiveOrg.slug,
        },
      },
      null,
      2,
    ),
  );
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
