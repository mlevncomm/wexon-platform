import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

const STEP_KEYS = [
  ActivationStepKey.BUSINESS_PROFILE,
  ActivationStepKey.BRANCH_SETUP,
  ActivationStepKey.TABLE_SETUP,
  ActivationStepKey.STAFF_INVITE,
  ActivationStepKey.MENU_IMPORT,
  ActivationStepKey.PAYMENT_PROVIDER,
  ActivationStepKey.VALIDATION,
  ActivationStepKey.GO_LIVE,
] as const;

type BrowserQuality = {
  consoleIssues: string[];
  pageErrors: string[];
  unexpectedResponses: string[];
};

type TenantFixture = {
  organizationId: string;
  journeyId: string;
  branchId: string;
  ownerEmail: string;
};

function captureBrowserQuality(page: Page): BrowserQuality {
  const quality: BrowserQuality = {
    consoleIssues: [],
    pageErrors: [],
    unexpectedResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      quality.consoleIssues.push(message.text());
    }
  });
  page.on("pageerror", (error) => quality.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      quality.unexpectedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return quality;
}

function expectCleanBrowser(quality: BrowserQuality) {
  expect(quality.consoleIssues).toEqual([]);
  expect(quality.pageErrors).toEqual([]);
  expect(quality.unexpectedResponses).toEqual([]);
}

function prismaClient() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  expect(databaseUrl).toBeTruthy();
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
}

async function createTenantFixture(
  prisma: PrismaClient,
  ownerEmail: string,
  label: string,
  active = false,
): Promise<TenantFixture> {
  const product = await prisma.product.findUniqueOrThrow({ where: { key: "wexpay" } });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: "wexpay_business_suite" } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: ownerEmail },
    select: { id: true },
  });
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const organization = await prisma.organization.create({
    data: {
      name: `${label} ${stamp}`,
      slug: `${label.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-")}-${stamp}`,
      isActive: true,
      isDemo: false,
    },
  });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });
  const license = await prisma.license.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.appInstallation.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      licenseId: license.id,
      status: "ACTIVE",
    },
  });
  await prisma.activationFeeLedger.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      planId: plan.id,
      status: "WAIVED",
      currency: "TRY",
      activationFeeMinor: 0,
      grossAmountMinor: 0,
    },
  });
  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: `${label} Restoran`,
      slug: `restaurant-${stamp}`,
      isActive: true,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: `${label} Şube`,
      slug: `branch-${stamp}`,
      address: "İzole E2E adresi",
      isActive: true,
    },
  });
  const journey = await prisma.activationJourney.create({
    data: {
      organizationId: organization.id,
      productId: product.id,
      status: active ? ActivationJourneyStatus.ACTIVE : ActivationJourneyStatus.IN_PROGRESS,
      source: active ? "LEGACY_BACKFILL" : "SELF_SERVE",
      currentStep: active ? ActivationStepKey.GO_LIVE : ActivationStepKey.MENU_IMPORT,
      version: active ? 8 : 1,
      completedAt: active ? new Date() : null,
      steps: {
        create: STEP_KEYS.map((stepKey) => ({
          stepKey,
          status: active
            ? ActivationJourneyStepStatus.COMPLETED
            : stepKey === ActivationStepKey.MENU_IMPORT ||
                stepKey === ActivationStepKey.PAYMENT_PROVIDER ||
                stepKey === ActivationStepKey.VALIDATION ||
                stepKey === ActivationStepKey.GO_LIVE
              ? ActivationJourneyStepStatus.PENDING
              : ActivationJourneyStepStatus.COMPLETED,
          completedAt: active ? new Date() : undefined,
          safeMetadataJson:
            stepKey === ActivationStepKey.BRANCH_SETUP
              ? { restaurantId: restaurant.id, branchId: branch.id }
              : undefined,
        })),
      },
    },
  });
  return {
    organizationId: organization.id,
    journeyId: journey.id,
    branchId: branch.id,
    ownerEmail,
  };
}

async function resetJourneyToMenuImport(prisma: PrismaClient, fixture: TenantFixture) {
  await prisma.activationJourney.update({
    where: { id: fixture.journeyId },
    data: {
      status: ActivationJourneyStatus.IN_PROGRESS,
      currentStep: ActivationStepKey.MENU_IMPORT,
      completedAt: null,
      version: { increment: 1 },
    },
  });
  await prisma.activationJourneyStep.update({
    where: {
      journeyId_stepKey: {
        journeyId: fixture.journeyId,
        stepKey: ActivationStepKey.MENU_IMPORT,
      },
    },
    data: {
      status: ActivationJourneyStepStatus.PENDING,
      completedAt: null,
    },
  });
  await prisma.activationJourneyStep.update({
    where: {
      journeyId_stepKey: {
        journeyId: fixture.journeyId,
        stepKey: ActivationStepKey.PAYMENT_PROVIDER,
      },
    },
    data: {
      status: ActivationJourneyStepStatus.PENDING,
      completedAt: null,
    },
  });
}

async function cleanupTenant(prisma: PrismaClient, fixture: TenantFixture | null) {
  if (!fixture) return;
  await prisma.menuImportRowError
    .deleteMany({ where: { job: { organizationId: fixture.organizationId } } })
    .catch(() => undefined);
  await prisma.menuImportJob
    .deleteMany({ where: { organizationId: fixture.organizationId } })
    .catch(() => undefined);
  await prisma.auditLog.deleteMany({ where: { organizationId: fixture.organizationId } });
  await prisma.organization
    .delete({ where: { id: fixture.organizationId } })
    .catch(() => undefined);
}

async function openMenuImport(page: Page, fixture: TenantFixture) {
  await loginCustomer(page, fixture.ownerEmail, customerPassword());
  await page.goto(
    `/dashboard/wexpay/activation?organizationId=${encodeURIComponent(fixture.organizationId)}`,
  );
  await expect(page.getByTestId("wizard-menu-import")).toBeVisible();
}

async function applyCurrentImport(page: Page) {
  await page.getByTestId("menu-import-confirm-apply").check();
  await expect(page.getByTestId("menu-import-apply")).toBeEnabled();
  await page.getByTestId("menu-import-apply").click();
}

test.describe.serial("WexPay final closure browser regressions", () => {
  test("real OpenPyXL XLSX uploads, previews, applies modifiers, and survives refresh", async ({
    page,
  }) => {
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    const prisma = prismaClient();
    let tenant: TenantFixture | null = null;
    const quality = captureBrowserQuality(page);
    try {
      tenant = await createTenantFixture(
        prisma,
        fixtures.licensedCustomerEmail,
        "Closure XLSX",
      );
      await openMenuImport(page, tenant);
      await page.getByTestId("menu-import-file").setInputFiles(
        resolve(process.cwd(), "test/fixtures/menu-import/openpyxl-menu-modifiers.xlsx"),
      );
      await page.getByTestId("menu-import-upload").click();
      await expect(page.getByTestId("menu-import-preview")).toBeVisible();
      await expect(page.getByText(/Geçerli:\s*2/)).toBeVisible();
      await expect(page.getByText(/Seçenek grubu \/ seçenek:\s*2\s*\/\s*2/)).toBeVisible();
      await applyCurrentImport(page);

      await expect
        .poll(
          () =>
            prisma.menuImportJob
              .findFirstOrThrow({
                where: { organizationId: tenant!.organizationId },
                orderBy: { createdAt: "desc" },
              })
              .then((job) => job.status),
          { timeout: 45_000 },
        )
        .toBe("APPLIED");
      const products = await prisma.menuProduct.findMany({
        where: { branchId: tenant.branchId },
        orderBy: { name: "asc" },
      });
      expect(products).toHaveLength(2);
      expect(products.map((product) => [product.name, Number(product.price)])).toEqual([
        ["Adana", 320.5],
        ["Cay", 45],
      ]);
      const option = await prisma.menuModifierOption.findFirstOrThrow({
        where: {
          name: "Buyuk",
          group: { branchId: tenant.branchId, name: "Boyut" },
        },
        include: { group: true },
      });
      expect(Number(option.priceDelta)).toBe(12.5);
      expect(option.group.selectionType).toBe("SINGLE");
      expect(option.group.minSelect).toBe(0);
      expect(option.group.maxSelect).toBe(1);
      expect(
        await prisma.menuProductModifierGroup.count({
          where: { branchId: tenant.branchId },
        }),
      ).toBe(2);

      await page.reload();
      await expect(page.getByTestId("wizard-payment-provider")).toBeVisible();
      await expect(page.getByRole("link", { name: "Kuruluma devam et" })).toBeVisible();
      expectCleanBrowser(quality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant);
      await prisma.$disconnect();
    }
  });

  test("invalid formula/non-TRY rows show Turkish errors without menu writes", async ({ page }) => {
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    const prisma = prismaClient();
    let tenant: TenantFixture | null = null;
    const quality = captureBrowserQuality(page);
    try {
      tenant = await createTenantFixture(
        prisma,
        fixtures.licensedCustomerEmail,
        "Closure Invalid",
      );
      await openMenuImport(page, tenant);
      const invalidCsv = [
        "category,product_name,price,currency",
        "Icecek,=1+1,45.00,TRY",
        "Icecek,Dolar Urun,50.00,USD",
      ].join("\n");
      await page.getByTestId("menu-import-file").setInputFiles({
        name: "invalid-menu.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(`${invalidCsv}\n`, "utf8"),
      });
      await page.getByTestId("menu-import-upload").click();
      await expect(page.getByTestId("menu-import-preview")).toBeVisible();
      await expect(page.getByText(/Geçerli:\s*0/)).toBeVisible();
      await expect(page.getByText(/Hatalı:\s*2/)).toBeVisible();
      await expect(page.getByTestId("menu-import-errors")).toContainText(
        "Formül/CSV injection kabul edilmez",
      );
      await expect(page.getByTestId("menu-import-errors")).toContainText(
        "Para birimi yalnızca TRY olabilir",
      );
      await expect(page.getByTestId("menu-import-apply")).toBeDisabled();

      const job = await prisma.menuImportJob.findFirstOrThrow({
        where: { organizationId: tenant.organizationId },
        include: { rowErrors: true },
      });
      expect(job.status).toBe("DRY_RUN");
      expect(job.validRows).toBe(0);
      expect(job.errorRows).toBe(2);
      expect(job.rowErrors.map((error) => error.errorCode).sort()).toEqual([
        "CURRENCY_UNSUPPORTED",
        "FORMULA_INJECTION",
      ]);
      expect(await prisma.menuProduct.count({ where: { branchId: tenant.branchId } })).toBe(0);
      expect(await prisma.menuCategory.count({ where: { branchId: tenant.branchId } })).toBe(0);
      expect(await prisma.menuModifierGroup.count({ where: { branchId: tenant.branchId } })).toBe(0);
      expectCleanBrowser(quality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant);
      await prisma.$disconnect();
    }
  });

  test("duplicate import requires force and remains deterministic", async ({ page }) => {
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    const prisma = prismaClient();
    let tenant: TenantFixture | null = null;
    const quality = captureBrowserQuality(page);
    const xlsxPath = resolve(
      process.cwd(),
      "test/fixtures/menu-import/openpyxl-menu-modifiers.xlsx",
    );
    try {
      tenant = await createTenantFixture(
        prisma,
        fixtures.licensedCustomerEmail,
        "Closure Duplicate",
      );
      await openMenuImport(page, tenant);
      await page.getByTestId("menu-import-file").setInputFiles(xlsxPath);
      await page.getByTestId("menu-import-upload").click();
      await expect(page.getByTestId("menu-import-preview")).toBeVisible();
      await applyCurrentImport(page);
      await expect
        .poll(
          () =>
            prisma.menuImportJob
              .findFirstOrThrow({
                where: { organizationId: tenant!.organizationId },
                orderBy: { createdAt: "desc" },
              })
              .then((job) => job.status),
          { timeout: 45_000 },
        )
        .toBe("APPLIED");

      await resetJourneyToMenuImport(prisma, tenant);
      await page.reload();
      await expect(page.getByTestId("wizard-menu-import")).toBeVisible();
      await page.getByTestId("menu-import-file").setInputFiles(xlsxPath);
      await page.getByTestId("menu-import-upload").click();
      await expect(page.getByTestId("menu-import-duplicate-warning")).toContainText(
        "Aynı dosya daha önce uygulandı",
      );
      await page.getByTestId("menu-import-confirm-apply").check();
      await expect(page.getByTestId("menu-import-apply")).toBeDisabled();
      await page.getByTestId("menu-import-force-reimport").check();
      await expect(page.getByTestId("menu-import-apply")).toBeEnabled();
      await page.getByTestId("menu-import-apply").click();
      await expect
        .poll(
          () =>
            prisma.menuImportJob
              .findFirstOrThrow({
                where: { organizationId: tenant!.organizationId },
                orderBy: { createdAt: "desc" },
              })
              .then((job) => job.status),
          { timeout: 45_000 },
        )
        .toBe("APPLIED");

      expect(await prisma.menuProduct.count({ where: { branchId: tenant.branchId } })).toBe(2);
      expect(await prisma.menuModifierGroup.count({ where: { branchId: tenant.branchId } })).toBe(2);
      expect(await prisma.menuModifierOption.count({
        where: { group: { branchId: tenant.branchId } },
      })).toBe(2);
      const option = await prisma.menuModifierOption.findFirstOrThrow({
        where: { name: "Buyuk", group: { branchId: tenant.branchId } },
      });
      expect(Number(option.priceDelta)).toBe(12.5);
      expectCleanBrowser(quality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant);
      await prisma.$disconnect();
    }
  });

  test("report CSV uses UI export link and stays tenant isolated", async ({ page }) => {
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    const prisma = prismaClient();
    let tenant: TenantFixture | null = null;
    let foreignTenant: TenantFixture | null = null;
    const quality = captureBrowserQuality(page);
    try {
      tenant = await createTenantFixture(
        prisma,
        fixtures.licensedCustomerEmail,
        "Closure Report",
        true,
      );
      foreignTenant = await createTenantFixture(
        prisma,
        fixtures.licensedCustomerEmail,
        "Foreign Report Secret",
        true,
      );
      await prisma.membership.deleteMany({
        where: { organizationId: foreignTenant.organizationId },
      });
      const category = await prisma.menuCategory.create({
        data: {
          branchId: tenant.branchId,
          name: "Rapor Kategori",
          sortOrder: 1,
          isActive: true,
        },
      });
      const product = await prisma.menuProduct.create({
        data: {
          branchId: tenant.branchId,
          categoryId: category.id,
          name: "Rapor Ürünü",
          price: "125.00",
          currency: "TRY",
          isActive: true,
          inStock: true,
        },
      });
      const table = await prisma.restaurantTable.create({
        data: {
          branchId: tenant.branchId,
          label: "Rapor Masa 01",
          seats: 4,
          qrCode: `REPORT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: "OCCUPIED",
          isActive: true,
        },
      });
      const orderNo = `REPORT-ORDER-${Date.now()}`;
      const order = await prisma.customerOrder.create({
        data: {
          orderNo,
          branchId: tenant.branchId,
          tableId: table.id,
          status: OrderStatus.SERVED,
          subtotal: "125.00",
          servedAt: new Date(),
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              quantity: 1,
              unitPrice: "125.00",
              totalPrice: "125.00",
            },
          },
        },
      });
      const paymentRef = `REPORT-PAYMENT-${Date.now()}`;
      await prisma.payment.create({
        data: {
          branchId: tenant.branchId,
          tableId: table.id,
          orderId: order.id,
          amount: "125.00",
          currency: "TRY",
          status: PaymentStatus.PAID,
          provider: "manual",
          providerRef: paymentRef,
          paidAt: new Date(),
        },
      });

      await loginCustomer(page, tenant.ownerEmail, customerPassword());
      await page.goto(
        `/apps/wexpay/reports?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(tenant.branchId)}`,
      );
      await expect(page.getByRole("heading", { name: "Raporlar" })).toBeVisible();
      const href = await page.getByRole("link", { name: "CSV indir" }).getAttribute("href");
      expect(href).toBeTruthy();
      const exportResponse = await page.request.get(new URL(href!, page.url()).toString());
      expect(exportResponse.status()).toBe(200);
      expect(exportResponse.headers()["content-type"]).toContain("text/csv");
      expect(exportResponse.headers()["content-disposition"]).toMatch(
        /^attachment; filename="wexpay-report-[a-z0-9]{1,8}\.csv"$/i,
      );
      const csv = await exportResponse.text();
      expect(csv).toContain("section,key,value");
      expect(csv).toContain("summary,daily_paid_total,125");
      expect(csv).toContain("summary,paid_count,1");
      expect(csv).toContain("provider,manual,125");
      expect(csv).toContain("product,Rapor Ürünü,125");

      const foreignUrl = new URL(href!, page.url());
      foreignUrl.searchParams.set("organizationId", foreignTenant.organizationId);
      foreignUrl.searchParams.set("branchId", foreignTenant.branchId);
      const foreignResponse = await page.request.get(foreignUrl.toString());
      expect(foreignResponse.status()).toBe(403);
      const foreignBody = await foreignResponse.text();
      expect(foreignBody).not.toContain("Foreign Report Secret");

      const mismatchedBranchUrl = new URL(href!, page.url());
      mismatchedBranchUrl.searchParams.set("organizationId", tenant.organizationId);
      mismatchedBranchUrl.searchParams.set("branchId", foreignTenant.branchId);
      const mismatchedBranchResponse = await page.request.get(mismatchedBranchUrl.toString());
      expect(mismatchedBranchResponse.status()).toBe(404);
      expect(await mismatchedBranchResponse.json()).toMatchObject({ reason: "not_found" });

      expect(csv).not.toContain("Foreign Report Secret");
      expect(csv).not.toContain(orderNo);
      expect(csv).not.toContain(paymentRef);
      expectCleanBrowser(quality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant);
      await cleanupTenant(prisma, foreignTenant);
      await prisma.$disconnect();
    }
  });
});
