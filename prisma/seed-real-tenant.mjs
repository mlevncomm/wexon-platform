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
