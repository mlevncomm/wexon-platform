import { expect, test } from "@playwright/test";
import { PrismaClient, ActivationStepKey } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

/**
 * Full Smart Activation wizard flow (isolated).
 * Uses a dedicated org so fixture public-live journeys stay ACTIVE for sibling specs.
 */
test.describe.serial("WexPay activation wizard flow", () => {
  test("auth gate redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard/wexpay/activation");
    await expect(page).toHaveURL(/\/(dashboard\/)?login/);
  });

  test("logged-in wizard: profile → branch → tables+QR → recover → staff invite → accept paths", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const fixtures = loadFixtures();
    expect(fixtures.dbAvailable).toBe(true);
    expect(fixtures.fixturesReady).toBe(true);
    expect(fixtures.licensedCustomerEmail).toBeTruthy();

    const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    expect(databaseUrl).toBeTruthy();
    const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });

    const product = await prisma.product.findFirst({ where: { key: "wexpay" }, select: { id: true } });
    expect(product).toBeTruthy();
    const plan = await prisma.plan.findFirst({
      where: { productId: product!.id, isActive: true },
      select: { id: true },
    });
    expect(plan).toBeTruthy();

    const owner = await prisma.user.findUnique({
      where: { email: fixtures.licensedCustomerEmail },
      select: { id: true },
    });
    expect(owner).toBeTruthy();

    const stamp = Date.now().toString(36);
    const org = await prisma.organization.create({
      data: {
        name: `Wizard E2E ${stamp}`,
        slug: `wizard-e2e-${stamp}`,
        isActive: true,
        isDemo: false,
      },
    });
    const orgId = org.id;

    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: owner!.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    const license = await prisma.license.create({
      data: {
        organizationId: orgId,
        productId: product!.id,
        planId: plan!.id,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId: orgId,
        productId: product!.id,
        licenseId: license.id,
        status: "ACTIVE",
      },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: orgId,
        productId: product!.id,
        planId: plan!.id,
        status: "WAIVED",
        currency: "TRY",
        activationFeeMinor: 0,
        grossAmountMinor: 0,
      },
    });

    const stepKeys = [
      ActivationStepKey.BUSINESS_PROFILE,
      ActivationStepKey.BRANCH_SETUP,
      ActivationStepKey.TABLE_SETUP,
      ActivationStepKey.STAFF_INVITE,
      ActivationStepKey.MENU_IMPORT,
      ActivationStepKey.PAYMENT_PROVIDER,
      ActivationStepKey.VALIDATION,
      ActivationStepKey.GO_LIVE,
    ];

    const journey = await prisma.activationJourney.create({
      data: {
        organizationId: orgId,
        productId: product!.id,
        status: "IN_PROGRESS",
        source: "SELF_SERVE",
        currentStep: ActivationStepKey.BUSINESS_PROFILE,
        version: 1,
        steps: {
          create: stepKeys.map((stepKey) => ({ stepKey, status: "PENDING" })),
        },
      },
    });
    const journeyId = journey.id;

    try {
      await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
      await page.goto(`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`);
      await expect(page.getByRole("heading", { name: "Kurulum sihirbazı" })).toBeVisible();

      await expect(page.getByRole("heading", { name: "1. İşletme profili" })).toBeVisible();
      await page.locator('input[name="name"]').fill(`E2E Biz ${stamp}`);
      await page.getByRole("button", { name: "Kaydet ve devam" }).click();
      await expect(page.getByRole("heading", { name: "2. Şube kurulumu" })).toBeVisible({ timeout: 30_000 });

      await page.locator('input[name="restaurantName"]').fill(`E2E Rest ${stamp}`);
      await page.locator('input[name="branchName"]').fill(`E2E Branch ${stamp}`);
      await page.locator('input[name="branchAddress"]').fill(`E2E Address ${stamp}`);
      await page.getByRole("button", { name: "Şubeyi kaydet" }).click();
      await expect(page.getByRole("heading", { name: "3. Masa ve güvenli QR" })).toBeVisible({
        timeout: 30_000,
      });

      await page.locator('input[name="count"]').fill("2");
      await page.locator('input[name="prefix"]').fill("E2E Masa");
      await page.getByRole("button", { name: "Masaları ve QR’ları oluştur" }).click();
      await expect(page.getByTestId("wizard-qr-pack")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("wizard-qr-image").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("wizard-qr-download").first()).toBeVisible();
      await expect(page.getByTestId("wizard-qr-print").first()).toBeVisible();

      await page.reload();
      await expect(page.getByRole("heading", { name: "3. Masa ve güvenli QR" })).toBeVisible();
      await page.getByTestId("wizard-qr-recover").first().click();
      await expect(page.getByTestId("wizard-qr-pack")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("wizard-qr-image").first()).toBeVisible({ timeout: 30_000 });

      await page.getByRole("button", { name: "QR paketini kaydettim, devam" }).click();
      await expect(page.getByRole("heading", { name: "4. Personel daveti" })).toBeVisible({
        timeout: 30_000,
      });

      const newEmail = `e2e.invite.new+${stamp}@example.com`;
      await page.locator('input[name="email"]').fill(newEmail);
      await page.locator('select[name="role"]').selectOption("STAFF");
      await page.getByRole("button", { name: "Davet gönder" }).click();
      await expect(page.getByText(newEmail)).toBeVisible({ timeout: 30_000 });

      const newInvite = await prisma.staffInvite.findFirst({
        where: { organizationId: orgId, email: newEmail },
        orderBy: { createdAt: "desc" },
      });
      expect(newInvite).toBeTruthy();
      expect(newInvite!.deliveryStatus).toBe("SENT");

      const preview = page.getByText(/Önizleme bağlantısı/i).locator("..").locator(".font-mono");
      await expect(preview).toBeVisible({ timeout: 15_000 });
      const inviteUrlRaw = (await preview.textContent())!.trim();
      expect(inviteUrlRaw).toContain("/invite/");
      const invitePath = `/invite/${inviteUrlRaw.split("/invite/")[1]!}`;

      const invitePage = await context.newPage();
      await invitePage.goto(invitePath);
      await expect(invitePage.getByRole("heading", { name: "Personel daveti" })).toBeVisible();
      await expect(invitePage.locator('input[name="email"]')).toHaveValue("");
      await invitePage.locator('input[name="email"]').fill(newEmail);
      await invitePage.locator('input[name="name"]').fill("E2E Invitee");
      await invitePage.locator('input[name="password"]').fill("Password1!");
      await invitePage.getByRole("button", { name: "Daveti kabul et" }).click();
      await expect(invitePage).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      await invitePage.close();

      const existingEmail = `e2e.invite.existing+${stamp}@example.com`;
      const existingUser = await prisma.user.create({
        data: {
          email: existingEmail,
          name: "E2E Existing",
          passwordHash: "scrypt:v1:e2e-salt:e2e-hash",
          passwordSetAt: new Date(),
          isActive: true,
        },
      });

      // Seed an open invite with known plaintext for LOGIN_REQUIRED (UI create already covered above).
      const { createHash, randomBytes } = await import("node:crypto");
      const plaintext = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(plaintext, "utf8").digest("hex");
      await prisma.staffInvite.create({
        data: {
          organizationId: orgId,
          email: existingEmail,
          role: "STAFF",
          tokenHash,
          tokenPrefix: plaintext.slice(0, 10),
          expiresAt: new Date(Date.now() + 86400000),
          createdByUserId: owner!.id,
          deliveryStatus: "SENT",
        },
      });

      const bare = await context.browser()!.newContext();
      const barePage = await bare.newPage();
      await barePage.goto(`/invite/${encodeURIComponent(plaintext)}`);
      await expect(barePage.getByRole("heading", { name: "Personel daveti" })).toBeVisible();
      await barePage.locator('input[name="email"]').fill(existingEmail);
      await barePage.getByRole("button", { name: "Daveti kabul et" }).click();
      await expect(barePage.getByText(/önce giriş yapmalısınız/i)).toBeVisible({ timeout: 15_000 });
      await expect(barePage.getByRole("button", { name: "Giriş yap ve davete dön" })).toBeVisible();
      await bare.close();

      await page.goto(`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`);
      await expect(
        page.getByRole("heading", { name: /Kurulum sihirbazı|4\. Personel|Sonraki adımlar/ }),
      ).toBeVisible();

      await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => undefined);
    } finally {
      await prisma.tableQrToken.deleteMany({
        where: { table: { branch: { restaurant: { organizationId: orgId } } } },
      });
      await prisma.restaurantTable.deleteMany({
        where: { branch: { restaurant: { organizationId: orgId } } },
      });
      await prisma.branch.deleteMany({ where: { restaurant: { organizationId: orgId } } });
      await prisma.restaurant.deleteMany({ where: { organizationId: orgId } });
      await prisma.staffInvite.deleteMany({ where: { organizationId: orgId } });
      await prisma.activationJourneyStep.deleteMany({ where: { journeyId } });
      await prisma.activationJourney.deleteMany({ where: { id: journeyId } });
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: orgId } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: orgId } });
      await prisma.license.deleteMany({ where: { organizationId: orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.$disconnect();
    }
  });
});
