import "dotenv/config";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const scryptAsync = promisify(scrypt);
const adapter = new PrismaPg(process.env.DIRECT_URL);
const prisma = new PrismaClient({ adapter });

const STOCK_CUSTOMER = {
  organizationName: "Mavi Bahce Demo Organization",
  organizationSlug: "mavi-bahce-demo",
  organizationEmail: "demo@wexon.dev",
  userEmail: "demo@wexon.dev",
  userName: "Mavi Bahce Owner",
  userPassword: "Wexon-Customer-2026",
  restaurantName: "Mavi Bahce Restaurant",
  restaurantSlug: "mavi-bahce-restaurant",
  branchName: "Merkez Sube",
  branchSlug: "merkez-sube",
};

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
    entitlements: {
      branch_limit: 1,
      table_limit: 20,
      product_limit: 50,
      staff_limit: 3,
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
    entitlements: {
      branch_limit: 2,
      table_limit: 75,
      product_limit: 250,
      staff_limit: 10,
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
    entitlements: {
      branch_limit: 10,
      table_limit: 300,
      product_limit: 1000,
      staff_limit: 50,
      reporting_level: "advanced",
      integration_level: "advanced",
      support_level: "priority",
      role_level: "advanced",
    },
  },
];

const menuCategories = [
  "Baslangiclar",
  "Ana Yemekler",
  "Icecekler",
  "Tatlilar",
  "Kahveler",
];

const menuProducts = [
  {
    name: "Mercimek Corbasi",
    category: "Baslangiclar",
    description: "Gunluk hazirlanan sicak mercimek corbasi.",
    price: "120.00",
    isPopular: true,
  },
  {
    name: "Izgara Tavuk",
    category: "Ana Yemekler",
    description: "Mevsim garnituru ve ozel sos ile servis edilir.",
    price: "390.00",
    isPopular: true,
  },
  {
    name: "Avokado Tost",
    category: "Ana Yemekler",
    description: "Eksi mayali ekmek, avokado ve taze yesillikler.",
    price: "310.00",
    isPopular: true,
  },
  {
    name: "Mevsim Salata",
    category: "Baslangiclar",
    description: "Taze yesillikler, domates, salatalik ve zeytinyagi.",
    price: "160.00",
    isPopular: false,
  },
  {
    name: "Turk Kahvesi",
    category: "Kahveler",
    description: "Geleneksel fincanda lokum ile servis edilir.",
    price: "90.00",
    isPopular: true,
  },
  {
    name: "Limonata",
    category: "Icecekler",
    description: "Ev yapimi ferah limonata.",
    price: "95.00",
    isPopular: false,
  },
  {
    name: "San Sebastian",
    category: "Tatlilar",
    description: "Kremamsi cheesecake, cikolata sos ile.",
    price: "220.00",
    isPopular: true,
  },
];

function addPeriod(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:v1:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
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

async function seedStockCustomer(productByKey, planByKey) {
  const now = new Date();
  const periodEnd = addPeriod(now, 1);
  const passwordHash = await hashPassword(STOCK_CUSTOMER.userPassword);
  const wexPayProduct = productByKey.get("wexpay");
  const wexPayPlan = planByKey.get("wexpay_standard");

  const organization = await prisma.organization.upsert({
    where: { slug: STOCK_CUSTOMER.organizationSlug },
    update: {
      name: STOCK_CUSTOMER.organizationName,
      email: STOCK_CUSTOMER.organizationEmail,
      country: "TR",
      isDemo: true,
      isActive: true,
    },
    create: {
      name: STOCK_CUSTOMER.organizationName,
      slug: STOCK_CUSTOMER.organizationSlug,
      email: STOCK_CUSTOMER.organizationEmail,
      country: "TR",
      isDemo: true,
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: STOCK_CUSTOMER.userEmail },
    update: {
      name: STOCK_CUSTOMER.userName,
      isActive: true,
      passwordHash,
      passwordSetAt: now,
      mustChangePassword: false,
    },
    create: {
      email: STOCK_CUSTOMER.userEmail,
      name: STOCK_CUSTOMER.userName,
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
    where: { id: "stock-wexpay-standard-license" },
    update: {
      organizationId: organization.id,
      productId: wexPayProduct.id,
      planId: wexPayPlan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: now,
      endsAt: periodEnd,
    },
    create: {
      id: "stock-wexpay-standard-license",
      organizationId: organization.id,
      productId: wexPayProduct.id,
      planId: wexPayPlan.id,
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
      planId: wexPayPlan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider: "manual",
      providerRef: "seed-stock-subscription",
    },
    create: {
      organizationId: organization.id,
      licenseId: license.id,
      planId: wexPayPlan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider: "manual",
      providerRef: "seed-stock-subscription",
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { invoiceNo: "INV-STOCK-WEXPAY-0001" },
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
      invoiceNo: "INV-STOCK-WEXPAY-0001",
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
      providerRef: "seed-stock-payment",
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
      providerRef: "seed-stock-payment",
      paidAt: now,
    },
  });

  await prisma.appInstallation.upsert({
    where: {
      organizationId_productId: {
        organizationId: organization.id,
        productId: wexPayProduct.id,
      },
    },
    update: {
      licenseId: license.id,
      status: "ACTIVE",
      settingsJson: {
        environment: "stock",
        onboardingStatus: "READY",
      },
    },
    create: {
      organizationId: organization.id,
      productId: wexPayProduct.id,
      licenseId: license.id,
      status: "ACTIVE",
      settingsJson: {
        environment: "stock",
        onboardingStatus: "READY",
      },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      organizationId: organization.id,
      action: "seed.stock_customer.created",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      action: "seed.stock_customer.created",
      entityType: "Organization",
      entityId: organization.id,
      metadataJson: {
        productKey: "wexpay",
        planKey: "wexpay_standard",
      },
    },
  });

  return { organization };
}

async function seedWexPayRestaurant(organization) {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: STOCK_CUSTOMER.restaurantSlug },
    update: {
      organizationId: organization.id,
      name: STOCK_CUSTOMER.restaurantName,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      name: STOCK_CUSTOMER.restaurantName,
      slug: STOCK_CUSTOMER.restaurantSlug,
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      restaurantId_slug: {
        restaurantId: restaurant.id,
        slug: STOCK_CUSTOMER.branchSlug,
      },
    },
    update: {
      name: STOCK_CUSTOMER.branchName,
      isActive: true,
    },
    create: {
      restaurantId: restaurant.id,
      name: STOCK_CUSTOMER.branchName,
      slug: STOCK_CUSTOMER.branchSlug,
      isActive: true,
    },
  });

  for (let index = 1; index <= 12; index += 1) {
    const label = `Masa ${String(index).padStart(2, "0")}`;

    await prisma.restaurantTable.upsert({
      where: {
        branchId_label: {
          branchId: branch.id,
          label,
        },
      },
      update: {
        qrCode: `WEXPAY-${branch.slug}-MASA-${String(index).padStart(2, "0")}`,
        isActive: true,
      },
      create: {
        branchId: branch.id,
        label,
        seats: index % 6 === 0 ? 6 : 4,
        qrCode: `WEXPAY-${branch.slug}-MASA-${String(index).padStart(2, "0")}`,
        isActive: true,
      },
    });
  }

  const categoryByName = new Map();

  for (const [index, name] of menuCategories.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: {
        branchId_name: {
          branchId: branch.id,
          name,
        },
      },
      update: {
        sortOrder: index,
        isActive: true,
      },
      create: {
        branchId: branch.id,
        name,
        sortOrder: index,
        isActive: true,
      },
    });

    categoryByName.set(name, category);
  }

  for (const [index, product] of menuProducts.entries()) {
    const category = categoryByName.get(product.category);

    await prisma.menuProduct.upsert({
      where: {
        id: `${branch.id}-${product.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
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
        id: `${branch.id}-${product.name.toLowerCase().replace(/\s+/g, "-")}`,
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
}

async function main() {
  const { productByKey, planByKey } = await seedProductsAndPlans();
  const { organization } = await seedStockCustomer(productByKey, planByKey);
  await seedWexPayRestaurant(organization);
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
