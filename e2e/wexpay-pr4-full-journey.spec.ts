import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  MembershipStatus,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/lib/wexon-passwords";
import {
  adminEmailFromEnv,
  adminPassword,
  customerPassword,
  loadFixtures,
  loginAdmin,
  loginCustomer,
} from "./helpers";
import { dismissCookieBanner } from "./wexpay-mutation-helpers";

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

type LicensedTenant = {
  organizationId: string;
  organizationSlug: string;
  ownerId: string;
  productId: string;
  planId: string;
};

type PreparedTenant = LicensedTenant & {
  journeyId: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  publicToken: string;
};

function prismaClient() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  expect(databaseUrl).toBeTruthy();
  const parsed = new URL(databaseUrl!);
  expect(["127.0.0.1", "localhost"]).toContain(parsed.hostname);
  expect(parsed.pathname.replace(/^\//, "")).toBe("wexon_e2e");
  expect(process.env.WEXON_E2E_TARGET).toBe("isolated");
  expect(process.env.WEXON_E2E_CONFIRM_ISOLATED).toBe("true");
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
}

function captureBrowserQuality(page: Page): BrowserQuality {
  const quality: BrowserQuality = {
    consoleIssues: [],
    pageErrors: [],
    unexpectedResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      quality.consoleIssues.push(`${message.type()}: ${message.text()}`);
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

function expectCleanBrowser(quality: BrowserQuality | null) {
  expect(quality).toBeTruthy();
  if (!quality) return;
  expect(quality.consoleIssues, "browser console warnings/errors").toEqual([]);
  expect(quality.pageErrors, "browser page errors/hydration failures").toEqual([]);
  expect(quality.unexpectedResponses, "unexpected browser 4xx/5xx responses").toEqual([]);
}

async function createLicensedTenant(
  prisma: PrismaClient,
  ownerEmail: string,
  label: string,
): Promise<LicensedTenant> {
  const product = await prisma.product.findUniqueOrThrow({ where: { key: "wexpay" } });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: "wexpay_business_suite" } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: ownerEmail },
    select: { id: true },
  });
  const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const slug = `pr4-e2e-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}`;
  const organization = await prisma.organization.create({
    data: {
      name: `PR4 ${label} ${stamp}`,
      slug,
      isActive: true,
      isDemo: false,
    },
  });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      status: MembershipStatus.ACTIVE,
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
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      licenseId: license.id,
      planId: plan.id,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: new Date(Date.now() - 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
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
      status: "PAID",
      currency: "TRY",
      activationFeeMinor: 0,
      grossAmountMinor: 0,
      paidAt: new Date(),
    },
  });
  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    ownerId: owner.id,
    productId: product.id,
    planId: plan.id,
  };
}

async function createLocalCustomer(prisma: PrismaClient, label: string) {
  const stamp = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const email = `pr4.${label.toLowerCase().replace(/[^a-z0-9]+/g, ".")}.${stamp}@example.test`;
  const password = `PR4-${randomBytes(12).toString("base64url")}!`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `PR4 ${label}`,
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      isActive: true,
    },
  });
  return { id: user.id, email, password };
}

async function createPreparedTenant(
  prisma: PrismaClient,
  ownerEmail: string,
  label: string,
  currentStep:
    | typeof ActivationStepKey.PAYMENT_PROVIDER
    | typeof ActivationStepKey.VALIDATION,
): Promise<PreparedTenant> {
  const tenant = await createLicensedTenant(prisma, ownerEmail, label);
  await prisma.organization.update({
    where: { id: tenant.organizationId },
    data: {
      legalName: `${label} Ticaret AŞ`,
      taxNo: `TX${randomBytes(6).toString("hex")}`,
      email: `${label.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.test`,
      phone: "+905551112233",
    },
  });
  const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: tenant.organizationId,
      name: `${label} Restoran`,
      slug: `pr4-r-${stamp}`,
      isActive: true,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: `${label} Merkez`,
      slug: `pr4-b-${stamp}`,
      address: "İzole yerel E2E adresi",
      isActive: true,
    },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      branchId: branch.id,
      label: "PR4 Masa 1",
      seats: 4,
      qrCode: `PR4-LEGACY-${stamp}`,
      isActive: true,
    },
  });
  const publicToken = randomBytes(32).toString("base64url");
  await prisma.tableQrToken.create({
    data: {
      tableId: table.id,
      tokenHash: createHash("sha256").update(publicToken, "utf8").digest("hex"),
      tokenPrefix: publicToken.slice(0, 10),
      status: "ACTIVE",
    },
  });
  const category = await prisma.menuCategory.create({
    data: { branchId: branch.id, name: `${label} Menü`, isActive: true },
  });
  await prisma.menuProduct.create({
    data: {
      branchId: branch.id,
      categoryId: category.id,
      name: `${label} Ürün`,
      price: "79.00",
      currency: "TRY",
      isActive: true,
      inStock: true,
    },
  });
  const currentIndex = STEP_KEYS.indexOf(currentStep);
  const journey = await prisma.activationJourney.create({
    data: {
      organizationId: tenant.organizationId,
      productId: tenant.productId,
      source: "SELF_SERVE",
      status: ActivationJourneyStatus.IN_PROGRESS,
      currentStep,
      version: 1,
      steps: {
        create: STEP_KEYS.map((stepKey, index) => {
          const completed = index < currentIndex;
          const status =
            completed && stepKey === ActivationStepKey.STAFF_INVITE
              ? ActivationJourneyStepStatus.SKIPPED
              : completed
                ? ActivationJourneyStepStatus.COMPLETED
                : ActivationJourneyStepStatus.PENDING;
          const safeMetadataJson =
            stepKey === ActivationStepKey.BRANCH_SETUP
              ? { restaurantId: restaurant.id, branchId: branch.id }
              : stepKey === ActivationStepKey.TABLE_SETUP
                ? {
                    branchId: branch.id,
                    tableIds: [table.id],
                    qrAck: true,
                    awaitingQrAck: false,
                  }
                : stepKey === ActivationStepKey.STAFF_INVITE
                  ? { reason: "OWNER_ONLY" }
                  : stepKey === ActivationStepKey.MENU_IMPORT
                    ? { branchId: branch.id }
                    : stepKey === ActivationStepKey.PAYMENT_PROVIDER &&
                        currentStep === ActivationStepKey.VALIDATION
                      ? {
                          provider: "MANUAL",
                          acknowledged: true,
                          onlinePaymentReady: false,
                        }
                      : {};
          return {
            stepKey,
            status,
            attemptCount: completed ? 1 : 0,
            completedAt: completed ? new Date() : null,
            safeMetadataJson,
          };
        }),
      },
    },
  });
  return {
    ...tenant,
    journeyId: journey.id,
    restaurantId: restaurant.id,
    branchId: branch.id,
    tableId: table.id,
    publicToken,
  };
}

async function createForeignTenant(prisma: PrismaClient) {
  const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const organization = await prisma.organization.create({
    data: {
      name: `PR4 Foreign Secret ${stamp}`,
      slug: `pr4-foreign-${stamp}`,
      isActive: true,
      isDemo: false,
    },
  });
  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: `Foreign Restaurant ${stamp}`,
      slug: `foreign-r-${stamp}`,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: "Foreign Branch",
      slug: `foreign-b-${stamp}`,
      address: "Foreign secret address",
    },
  });
  return { organizationId: organization.id, branchId: branch.id, marker: organization.name };
}

async function cleanupTenant(
  prisma: PrismaClient,
  organizationId: string | null,
  createdUserEmails: string[] = [],
) {
  if (organizationId) {
    const tableIds = await prisma.restaurantTable
      .findMany({
        where: { branch: { restaurant: { organizationId } } },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id));
    for (const tableId of tableIds) {
      await prisma.publicIdempotencyRecord
        .deleteMany({ where: { scopeKey: { contains: tableId } } })
        .catch(() => undefined);
    }
    await prisma.auditLog.deleteMany({ where: { organizationId } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
  }
  if (createdUserEmails.length > 0) {
    await prisma.user
      .deleteMany({
        where: {
          email: { in: createdUserEmails },
          memberships: { none: {} },
        },
      })
      .catch(() => undefined);
  }
}

test.describe.serial("WexPay PR-4 isolated full journey", () => {
  test("PR4 mandatory: full owner journey opens operations only after explicit go-live", async ({
    page,
    browser,
  }) => {
    test.setTimeout(420_000);
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    expect(fixtures.fixturesReady).toBe(true);
    const prisma = prismaClient();
    let tenant: LicensedTenant | null = null;
    let foreign: Awaited<ReturnType<typeof createForeignTenant>> | null = null;
    const createdUserEmails: string[] = [];
    const ownerQuality = captureBrowserQuality(page);
    let inviteQuality: BrowserQuality | null = null;
    let guestQuality: BrowserQuality | null = null;
    const owner = await createLocalCustomer(prisma, "Full Journey Owner");
    createdUserEmails.push(owner.email);

    try {
      tenant = await createLicensedTenant(prisma, owner.email, "Full Journey");
      foreign = await createForeignTenant(prisma);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await loginCustomer(page, owner.email, owner.password);
      await dismissCookieBanner(page);
      const activationUrl = `/dashboard/wexpay/activation?organizationId=${encodeURIComponent(tenant.organizationId)}`;
      await page.goto(activationUrl);
      await expect(page.getByRole("heading", { name: "1. İşletme profili" })).toBeVisible();

      await page.locator('input[name="name"]').fill(`PR4 Canlı İşletme ${tenant.organizationSlug}`);
      await page.locator('input[name="legalName"]').fill("PR4 Canlı İşletme Ticaret AŞ");
      await page.locator('input[name="taxNo"]').fill("1234567890");
      await page.locator('input[name="phone"]').fill("+905551234567");
      await page.locator('input[name="email"]').fill("pr4.full@example.test");
      await page.getByRole("button", { name: "Kaydet ve devam" }).click();
      await expect(page.getByRole("heading", { name: "2. Şube kurulumu" })).toBeVisible();

      await page.locator('input[name="restaurantName"]').fill("PR4 Journey Restoran");
      await page.locator('input[name="branchName"]').fill("PR4 Journey Merkez");
      await page.locator('input[name="branchAddress"]').fill("İstanbul yerel E2E adresi");
      await page.getByRole("button", { name: "Şubeyi kaydet" }).click();
      await expect(page.getByRole("heading", { name: "3. Masa ve güvenli QR" })).toBeVisible();

      await page.locator('input[name="count"]').fill("1");
      await page.locator('input[name="prefix"]').fill("PR4 Masa");
      await page.getByRole("button", { name: "Masaları ve QR’ları oluştur" }).click();
      const qrCard = page.getByTestId("wizard-qr-card").first();
      await expect(qrCard).toBeVisible();
      await expect(qrCard.getByTestId("wizard-qr-image")).toBeVisible();
      const publicUrl = (await qrCard.locator(".font-mono").innerText()).trim();
      const publicPath = new URL(publicUrl).pathname;
      expect(publicPath).toMatch(/^\/q\/[A-Za-z0-9_-]{20,}$/);
      const publicToken = decodeURIComponent(publicPath.split("/").at(-1)!);
      const table = await prisma.restaurantTable.findFirstOrThrow({
        where: { branch: { restaurant: { organizationId: tenant.organizationId } } },
        include: { qrTokens: true },
      });
      expect(table.qrCode).not.toBe(publicToken);
      expect(table.qrTokens).toHaveLength(1);
      expect(table.qrTokens[0]!.tokenHash).toBe(
        createHash("sha256").update(publicToken, "utf8").digest("hex"),
      );

      await page.getByRole("button", { name: "QR paketini kaydettim, devam" }).click();
      await expect(page.getByRole("heading", { name: "4. Personel daveti" })).toBeVisible();
      const invitedEmail = `pr4.staff.${randomBytes(6).toString("hex")}@example.test`;
      createdUserEmails.push(invitedEmail);
      await page.locator('input[name="email"]').fill(invitedEmail);
      await page.locator('select[name="role"]').selectOption("STAFF");
      await page.getByRole("button", { name: "Davet gönder" }).click();
      await expect(page.getByText(invitedEmail)).toBeVisible();
      const invite = await prisma.staffInvite.findFirstOrThrow({
        where: { organizationId: tenant.organizationId, email: invitedEmail },
        orderBy: { createdAt: "desc" },
      });
      expect(invite.deliveryStatus).toBe("SENT");
      const inviteUrl = (
        await page.getByText(/Önizleme bağlantısı/i).locator("..").locator(".font-mono").innerText()
      ).trim();
      expect(inviteUrl).toContain("/invite/");

      const inviteContext = await browser.newContext();
      const invitePage = await inviteContext.newPage();
      inviteQuality = captureBrowserQuality(invitePage);
      await invitePage.goto(new URL(inviteUrl).pathname);
      await dismissCookieBanner(invitePage);
      await expect(invitePage.getByRole("heading", { name: "Personel daveti" })).toBeVisible();
      await invitePage.locator('input[name="email"]').fill(invitedEmail);
      await invitePage.locator('input[name="name"]').fill("PR4 Gerçek Personel");
      await invitePage.locator('input[name="password"]').fill("PR4-Staff-Password-2026!");
      await invitePage.getByRole("button", { name: "Daveti kabul et" }).click();
      await expect(invitePage).toHaveURL(/\/dashboard/);
      await inviteContext.close();
      const acceptedInvite = await prisma.staffInvite.findUniqueOrThrow({ where: { id: invite.id } });
      expect(acceptedInvite.acceptedAt).toBeTruthy();
      expect(
        await prisma.membership.count({
          where: {
            organizationId: tenant.organizationId,
            role: "STAFF",
            status: MembershipStatus.ACTIVE,
          },
        }),
      ).toBe(1);

      await page.goto(activationUrl);
      await expect(page.getByTestId("wizard-menu-import")).toBeVisible();
      await page
        .getByTestId("menu-import-file")
        .setInputFiles(resolve(process.cwd(), "test/fixtures/menu-import/openpyxl-menu-sample.xlsx"));
      await page.getByTestId("menu-import-upload").click();
      await expect(page.getByTestId("menu-import-preview")).toBeVisible();
      await page.getByTestId("menu-import-confirm-apply").check();
      await page.getByTestId("menu-import-apply").click();
      await expect(page.getByTestId("wizard-payment-provider")).toBeVisible({ timeout: 45_000 });
      const branch = await prisma.branch.findFirstOrThrow({
        where: { restaurant: { organizationId: tenant.organizationId } },
      });
      expect(await prisma.menuProduct.count({ where: { branchId: branch.id, isActive: true } })).toBeGreaterThan(0);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId("wizard-payment-provider")).toBeVisible();
      const mobileOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth + 2);
      await page.getByTestId("provider-manual").check();
      await page.getByTestId("provider-manual-ack").check();
      await page.getByTestId("provider-submit").click();
      await expect(page.getByTestId("wizard-validation")).toBeVisible();
      await page.getByTestId("validation-run").click();
      await expect(page.getByTestId("wizard-go-live")).toBeVisible({ timeout: 45_000 });

      let journey = await prisma.activationJourney.findUniqueOrThrow({
        where: { organizationId_productId: { organizationId: tenant.organizationId, productId: tenant.productId } },
        include: { steps: true },
      });
      expect(journey.status).toBe(ActivationJourneyStatus.READY);
      expect(journey.currentStep).toBe(ActivationStepKey.GO_LIVE);
      expect(
        journey.steps.find((step) => step.stepKey === ActivationStepKey.VALIDATION)?.status,
      ).toBe(ActivationJourneyStepStatus.COMPLETED);

      const product = await prisma.menuProduct.findFirstOrThrow({
        where: { branchId: branch.id, isActive: true },
      });
      const closedMenu = await page.request.get(`/api/wexpay/public/${encodeURIComponent(publicToken)}`);
      expect(closedMenu.status()).toBe(403);
      expect(await closedMenu.json()).toMatchObject({ reason: "access_closed" });
      const closedOrder = await page.request.post(
        `/api/wexpay/public/${encodeURIComponent(publicToken)}/order`,
        { data: { items: [{ productId: product.id, quantity: 1 }] } },
      );
      expect(closedOrder.status()).toBe(403);
      expect(await closedOrder.json()).toMatchObject({ reason: "access_closed" });
      const closedCheckout = await page.request.post(
        `/api/wexpay/public/${encodeURIComponent(publicToken)}/checkout`,
      );
      expect(closedCheckout.status()).toBe(403);
      expect(await closedCheckout.json()).toMatchObject({ reason: "access_closed" });
      const closedPayment = await page.request.post(
        `/api/wexpay/public/${encodeURIComponent(publicToken)}/payment-request`,
      );
      expect(closedPayment.status()).toBe(403);
      expect(await closedPayment.json()).toMatchObject({ reason: "access_closed" });

      await page.goto(publicPath);
      await expect(page.getByRole("heading", { name: "Restoran şu an kapalı" })).toBeVisible();
      await page.goto(activationUrl);
      await page.reload();
      await expect(page.getByTestId("wizard-go-live")).toBeVisible();
      await page.goto("about:blank");
      await page.context().clearCookies();
      await loginCustomer(page, owner.email, owner.password);
      await dismissCookieBanner(page);
      await page.goto(activationUrl);
      await expect(page.getByTestId("wizard-go-live")).toBeVisible();
      await expect(page.getByText(/Hazır durumdasınız/i)).toBeVisible();

      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByTestId("go-live-confirm").check();
      await page.getByTestId("go-live-confirmation-text").fill(tenant.organizationSlug);
      await page.getByTestId("go-live-submit").click();
      await expect(page.getByRole("heading", { name: "Canlı Kullanım" })).toBeVisible();
      journey = await prisma.activationJourney.findUniqueOrThrow({
        where: { id: journey.id },
        include: { steps: true },
      });
      expect(journey.status).toBe(ActivationJourneyStatus.ACTIVE);
      expect(
        journey.steps.find((step) => step.stepKey === ActivationStepKey.GO_LIVE)?.status,
      ).toBe(ActivationJourneyStepStatus.COMPLETED);

      const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const guestPage = await guestContext.newPage();
      guestQuality = captureBrowserQuality(guestPage);
      await guestPage.goto(publicPath);
      await dismissCookieBanner(guestPage);
      await expect(guestPage.getByTestId("qr-cta-order")).toBeVisible();
      await guestPage.getByTestId("qr-cta-order").click();
      await expect(guestPage.getByTestId("qr-menu-screen")).toBeVisible();
      const quickAdd = guestPage.locator("[data-testid^='qr-quick-add-']").first();
      if (await quickAdd.count()) {
        await quickAdd.click();
      } else {
        const card = guestPage.locator("article").first();
        await card.getByRole("button").first().click();
        const add = guestPage.getByTestId("qr-add-to-cart");
        if (!(await add.isEnabled())) {
          await guestPage.locator("[data-testid^='qr-option-']").first().click();
        }
        await add.click();
      }
      const cartContinue = guestPage.getByTestId("qr-cart-continue");
      await expect(cartContinue).toBeVisible();
      await expect(cartContinue).toBeEnabled();
      await cartContinue.click();
      const orderResponsePromise = guestPage.waitForResponse(
        (response) => response.url().includes("/order") && response.request().method() === "POST",
      );
      await guestPage.getByTestId("qr-submit-order").click();
      const orderResponse = await orderResponsePromise;
      expect(orderResponse.status()).toBe(201);
      const orderBody = (await orderResponse.json()) as {
        id?: string;
        orderId?: string;
        orderNo?: string;
      };
      const orderId = orderBody.orderId ?? orderBody.id;
      expect(orderId).toBeTruthy();
      await expect(guestPage.getByTestId("qr-order-success")).toBeVisible();

      const order = await prisma.customerOrder.findUniqueOrThrow({
        where: { id: orderId! },
        include: { items: true },
      });
      expect(order.branchId).toBe(branch.id);
      expect(order.items.length).toBeGreaterThan(0);
      await page.goto(
        `/apps/wexpay/kitchen?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(branch.id)}`,
      );
      await expect(page.getByText(order.orderNo).first()).toBeVisible();

      await page.goto(
        `/apps/wexpay/payments?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(branch.id)}`,
      );
      const paymentForm = page.locator("form").filter({ has: page.locator('select[name="orderId"]') }).first();
      await paymentForm.locator('select[name="tableId"]').selectOption(table.id);
      await paymentForm.locator('select[name="orderId"]').selectOption(order.id);
      await paymentForm.locator('input[name="amount"]').fill(Number(order.subtotal).toFixed(2));
      await paymentForm.locator('select[name="provider"]').selectOption("manual");
      await paymentForm.locator('select[name="status"]').selectOption("PAID");
      await paymentForm.getByRole("button", { name: "Ödeme kaydet" }).click();
      await expect
        .poll(
          () => prisma.payment.count({ where: { orderId: order.id, status: "PAID", provider: "manual" } }),
          { timeout: 30_000 },
        )
        .toBe(1);

      await page.goto(
        `/apps/wexpay/reports?organizationId=${encodeURIComponent(tenant.organizationId)}&branchId=${encodeURIComponent(branch.id)}`,
      );
      await expect(page.getByRole("heading", { name: "Raporlar" })).toBeVisible();
      const csvHref = await page.getByRole("link", { name: "CSV indir" }).getAttribute("href");
      expect(csvHref).toBeTruthy();
      const csvResponse = await page.request.get(new URL(csvHref!, page.url()).toString());
      expect(csvResponse.status()).toBe(200);
      const csv = await csvResponse.text();
      expect(csv).toContain("section,key,value");
      expect(csv).toContain("provider,manual");
      expect(csv).toContain(`summary,paid_count,1`);

      const foreignReportUrl = new URL(csvHref!, page.url());
      foreignReportUrl.searchParams.set("organizationId", foreign.organizationId);
      foreignReportUrl.searchParams.set("branchId", foreign.branchId);
      const foreignReport = await page.request.get(foreignReportUrl.toString());
      expect(foreignReport.status()).toBe(403);
      expect(await foreignReport.text()).not.toContain(foreign.marker);
      await page.goto(`/apps/wexpay?organizationId=${encodeURIComponent(foreign.organizationId)}`);
      await expect(page.getByText(/Erişim gerekli|yetkisiz|lisans/i).first()).toBeVisible();
      expect(
        await prisma.customerOrder.count({
          where: { id: order.id, branch: { restaurant: { organizationId: foreign.organizationId } } },
        }),
      ).toBe(0);

      expectCleanBrowser(ownerQuality);
      expectCleanBrowser(inviteQuality);
      expectCleanBrowser(guestQuality);
      await guestContext.close();
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant?.organizationId ?? null, createdUserEmails);
      await cleanupTenant(prisma, foreign?.organizationId ?? null);
      await prisma.$disconnect();
    }
  });

  test("PR4 mandatory: PayTR TEST stays encrypted and network-disabled", async ({ page }) => {
    test.setTimeout(180_000);
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    expect(process.env.WEXPAY_CREDENTIAL_ENCRYPTION_KEY).toMatch(/^[A-Za-z0-9+/=_-]{32,}$/);
    expect(process.env.WEXPAY_PAYTR_ENABLE_API).toBe("false");
    expect(process.env.WEXPAY_PAYTR_ENABLE).toBe("false");
    expect(process.env.PAYTR_ENABLED).toBe("false");
    const prisma = prismaClient();
    let tenant: PreparedTenant | null = null;
    const quality = captureBrowserQuality(page);
    const paytrNetworkRequests: string[] = [];
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (/paytr/i.test(host) && host !== "localhost" && host !== "127.0.0.1") {
        paytrNetworkRequests.push(request.url());
      }
    });
    const merchantId = `merchant-${randomBytes(8).toString("hex")}`;
    const merchantKey = `key-${randomBytes(16).toString("hex")}`;
    const merchantSalt = `salt-${randomBytes(16).toString("hex")}`;

    try {
      tenant = await createPreparedTenant(
        prisma,
        fixtures.licensedCustomerEmail,
        "PayTR Test",
        ActivationStepKey.PAYMENT_PROVIDER,
      );
      await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
      await dismissCookieBanner(page);
      await page.goto(
        `/dashboard/wexpay/activation?organizationId=${encodeURIComponent(tenant.organizationId)}`,
      );
      await expect(page.getByTestId("wizard-payment-provider")).toBeVisible();
      await page.getByTestId("provider-paytr").check();
      await page.getByTestId("provider-paytr-mode").selectOption("TEST");
      await page.locator('input[name="merchantId"]').fill(merchantId);
      await page.locator('input[name="merchantKey"]').fill(merchantKey);
      await page.locator('input[name="merchantSalt"]').fill(merchantSalt);
      await page.getByTestId("provider-submit").click();
      await expect(page.getByText(/PayTR yapılandırması kaydedildi/i)).toBeVisible();
      await expect(page.getByText(/online QR kart ödemesi kapalıdır/i)).toBeVisible();
      await expect(page.getByTestId("wizard-validation")).toBeVisible();

      const credential = await prisma.wexPayProviderCredential.findFirstOrThrow({
        where: {
          organizationId: tenant.organizationId,
          provider: "paytr",
          mode: "TEST",
        },
      });
      expect(credential.configCiphertext).not.toContain(merchantId);
      expect(credential.configCiphertext).not.toContain(merchantKey);
      expect(credential.configCiphertext).not.toContain(merchantSalt);
      const paymentStep = await prisma.activationJourneyStep.findUniqueOrThrow({
        where: {
          journeyId_stepKey: {
            journeyId: tenant.journeyId,
            stepKey: ActivationStepKey.PAYMENT_PROVIDER,
          },
        },
      });
      const metadataBlob = JSON.stringify(paymentStep.safeMetadataJson);
      expect(metadataBlob).not.toContain(merchantKey);
      expect(metadataBlob).not.toContain(merchantSalt);
      expect(metadataBlob).toContain('"mode":"TEST"');
      expect(metadataBlob).toContain('"onlinePaymentApiEnabled":false');
      expect(await page.locator("body").innerText()).not.toContain(merchantKey);
      expect(await page.locator("body").innerText()).not.toContain(merchantSalt);

      await page.getByTestId("validation-run").click();
      await expect(page.getByTestId("wizard-go-live")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText("PayTR · TEST")).toBeVisible();
      await expect(page.getByText("Kapalı", { exact: true })).toBeVisible();
      const validationStep = await prisma.activationJourneyStep.findUniqueOrThrow({
        where: {
          journeyId_stepKey: {
            journeyId: tenant.journeyId,
            stepKey: ActivationStepKey.VALIDATION,
          },
        },
      });
      expect(validationStep.status).toBe(ActivationJourneyStepStatus.COMPLETED);
      expect(validationStep.safeMetadataJson).toMatchObject({
        result: "WARNING",
        failCount: 0,
        checks: expect.arrayContaining([
          expect.objectContaining({ key: "PAYTR_API_DISABLED", status: "WARNING" }),
        ]),
      });
      expect(
        (
          await prisma.activationJourney.findUniqueOrThrow({ where: { id: tenant.journeyId } })
        ).status,
      ).toBe(ActivationJourneyStatus.READY);
      expect(
        await prisma.payment.count({
          where: { branch: { restaurant: { organizationId: tenant.organizationId } } },
        }),
      ).toBe(0);
      expect(paytrNetworkRequests).toEqual([]);
      expectCleanBrowser(quality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant?.organizationId ?? null);
      await prisma.$disconnect();
    }
  });

  test("PR4 mandatory: admin block unblock and assisted launch reuse validation", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    const fixtures = loadFixtures();
    const adminEmail = adminEmailFromEnv(fixtures);
    const password = adminPassword();
    expect(adminEmail).toBeTruthy();
    expect(password).toBeTruthy();
    const prisma = prismaClient();
    let tenant: PreparedTenant | null = null;
    const adminQuality = captureBrowserQuality(page);
    let customerQuality: BrowserQuality | null = null;

    try {
      tenant = await createPreparedTenant(
        prisma,
        fixtures.licensedCustomerEmail,
        "Admin Assisted",
        ActivationStepKey.VALIDATION,
      );
      await loginAdmin(page, adminEmail!, password);
      await dismissCookieBanner(page);
      const adminUrl = `/admin/organizations/${tenant.organizationId}`;
      await page.goto(adminUrl);
      await expect(page.getByText("Aktivasyonu engelle")).toBeVisible();
      let actionForm = page.locator("form").filter({ hasText: "Aktivasyonu engelle" }).first();
      await actionForm.locator('input[name="reason"]').fill("LOCAL_COMPLIANCE_HOLD");
      await actionForm.locator('textarea[name="note"]').fill("Yerel PR4 tarayıcı doğrulama engeli.");
      await actionForm.getByRole("button", { name: "Engelle" }).click();
      await expect(page.getByText("Aktivasyon engelini kaldır")).toBeVisible();
      let journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: tenant.journeyId } });
      expect(journey.status).toBe(ActivationJourneyStatus.BLOCKED);
      expect(journey.blockedReasonCode).toBe("ADMIN_BLOCKED");
      expect(journey.currentStep).toBe(ActivationStepKey.VALIDATION);

      actionForm = page.locator("form").filter({ hasText: "Aktivasyon engelini kaldır" }).first();
      await actionForm.locator('input[name="reason"]').fill("LOCAL_REVIEW_COMPLETE");
      await actionForm.getByRole("button", { name: "Engeli kaldır" }).click();
      await expect(page.getByText("Aktivasyonu engelle")).toBeVisible();
      journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: tenant.journeyId } });
      expect(journey.status).toBe(ActivationJourneyStatus.IN_PROGRESS);
      expect(journey.blockedReasonCode).toBeNull();
      expect(journey.currentStep).toBe(ActivationStepKey.VALIDATION);

      const customerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const customerPage = await customerContext.newPage();
      customerQuality = captureBrowserQuality(customerPage);
      await loginCustomer(customerPage, fixtures.licensedCustomerEmail, customerPassword());
      await dismissCookieBanner(customerPage);
      await customerPage.goto(
        `/dashboard/wexpay/activation?organizationId=${encodeURIComponent(tenant.organizationId)}`,
      );
      await expect(customerPage.getByTestId("wizard-validation")).toBeVisible();
      await customerPage.getByTestId("validation-run").click();
      await expect(customerPage.getByTestId("wizard-go-live")).toBeVisible({ timeout: 45_000 });
      journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: tenant.journeyId } });
      expect(journey.status).toBe(ActivationJourneyStatus.READY);
      await customerContext.close();

      await page.goto(adminUrl);
      await expect(page.getByText("Admin destekli yayına alma")).toBeVisible();
      actionForm = page.locator("form").filter({ hasText: "Admin destekli yayına alma" }).first();
      await actionForm.locator('input[name="confirmationText"]').fill(tenant.organizationSlug);
      await actionForm.locator('input[name="reason"]').fill("ASSISTED_LOCAL_LAUNCH");
      await actionForm.locator('textarea[name="note"]').fill("Müşteri onayıyla yerel destekli yayına alma.");
      await actionForm.getByRole("button", { name: "Admin olarak yayına al" }).click();
      await expect(page.getByText("Canlı Kullanım", { exact: true }).first()).toBeVisible();

      const active = await prisma.activationJourney.findUniqueOrThrow({
        where: { id: tenant.journeyId },
        include: { steps: true },
      });
      expect(active.status).toBe(ActivationJourneyStatus.ACTIVE);
      const goLiveMetadata = active.steps.find(
        (step) => step.stepKey === ActivationStepKey.GO_LIVE,
      )?.safeMetadataJson;
      expect(goLiveMetadata).toMatchObject({
        confirmationMatch: "SLUG",
        validationResult: "WARNING",
      });
      const audits = await prisma.auditLog.findMany({
        where: {
          organizationId: tenant.organizationId,
          action: {
            in: [
              "activation.admin.blocked",
              "activation.admin.unblocked",
              "activation.go_live.admin_assisted",
            ],
          },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(audits.map((audit) => audit.action)).toEqual([
        "activation.admin.blocked",
        "activation.admin.unblocked",
        "activation.go_live.admin_assisted",
      ]);
      expect(JSON.stringify(audits)).toContain("ASSISTED_LOCAL_LAUNCH");
      expectCleanBrowser(adminQuality);
      expectCleanBrowser(customerQuality);
    } finally {
      await page.goto("about:blank").catch(() => undefined);
      await cleanupTenant(prisma, tenant?.organizationId ?? null);
      await prisma.$disconnect();
    }
  });
});
