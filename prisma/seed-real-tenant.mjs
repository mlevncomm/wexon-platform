import "dotenv/config";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
  tableLabel: "Masa 01",
  qrCode: "WEXPAY-real-test-MASA-01",
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
    where: { key: "wexpay_standard" },
    update: {
      productId: product.id,
      name: "Standard",
      description: "Standard operations package for growing restaurants.",
      billingInterval: "MONTHLY",
      isPublic: true,
      isActive: true,
      sortOrder: 2,
    },
    create: {
      productId: product.id,
      key: "wexpay_standard",
      name: "Standard",
      description: "Standard operations package for growing restaurants.",
      billingInterval: "MONTHLY",
      isPublic: true,
      isActive: true,
      sortOrder: 2,
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

  await prisma.restaurantTable.upsert({
    where: {
      branchId_label: {
        branchId: branch.id,
        label: REAL_OPS.tableLabel,
      },
    },
    update: {
      qrCode: REAL_OPS.qrCode,
      isActive: true,
      seats: 4,
    },
    create: {
      branchId: branch.id,
      label: REAL_OPS.tableLabel,
      seats: 4,
      qrCode: REAL_OPS.qrCode,
      isActive: true,
    },
  });

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

  return { restaurant, branch, qrCode: REAL_OPS.qrCode };
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
        planKey: "wexpay_standard",
      },
    },
  });

  const ops = await seedRealWexPayOperations(organization);
  const inactiveOrg = await seedInactiveWexPayTenant(product);

  console.log(
    JSON.stringify(
      {
        organization: {
          slug: organization.slug,
          isDemo: organization.isDemo,
        },
        user: {
          email: user.email,
          password: REAL_TENANT.userPassword,
        },
        smoke: {
          qrCode: ops.qrCode,
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
