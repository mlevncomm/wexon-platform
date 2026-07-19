import { expect, test } from "@playwright/test";
import { PrismaClient, ActivationStepKey } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

/**
 * Full Smart Activation wizard flow (isolated).
 * No broad status alternatives — each step asserts an exact UI signal.
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
    expect(fixtures.licensedOrgId).toBeTruthy();

    const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    expect(databaseUrl).toBeTruthy();
    const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });

    const product = await prisma.product.findFirst({ where: { key: "wexpay" }, select: { id: true } });
    expect(product).toBeTruthy();

    const orgId = fixtures.licensedOrgId!;
    const stamp = Date.now().toString(36);
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

    // Ensure journey is writable IN_PROGRESS at BUSINESS_PROFILE for this run.
    let journey = await prisma.activationJourney.findUnique({
      where: { organizationId_productId: { organizationId: orgId, productId: product!.id } },
      include: { steps: true },
    });

    if (!journey) {
      journey = await prisma.activationJourney.create({
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
        include: { steps: true },
      });
    } else {
      await prisma.activationJourney.update({
        where: { id: journey.id },
        data: {
          status: "IN_PROGRESS",
          source: "SELF_SERVE",
          currentStep: ActivationStepKey.BUSINESS_PROFILE,
          version: journey.version + 1,
          completedAt: null,
          blockedReasonCode: null,
        },
      });
      await prisma.activationJourneyStep.updateMany({
        where: { journeyId: journey.id },
        data: {
          status: "PENDING",
          completedAt: null,
          lastErrorCode: null,
          safeMetadataJson: {},
        },
      });
      journey = await prisma.activationJourney.findUniqueOrThrow({
        where: { id: journey.id },
        include: { steps: true },
      });
    }

    const journeyId = journey.id;

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await page.goto(`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`);
    await expect(page.getByRole("heading", { name: "Kurulum sihirbazı" })).toBeVisible();

    // BUSINESS_PROFILE
    await expect(page.getByRole("heading", { name: "1. İşletme profili" })).toBeVisible();
    await page.locator('input[name="name"]').fill(`E2E Biz ${stamp}`);
    await page.getByRole("button", { name: "Kaydet ve devam" }).click();
    await expect(page.getByRole("heading", { name: "2. Şube kurulumu" })).toBeVisible({ timeout: 30_000 });

    // BRANCH_SETUP
    await page.locator('input[name="restaurantName"]').fill(`E2E Rest ${stamp}`);
    await page.locator('input[name="branchName"]').fill(`E2E Branch ${stamp}`);
    await page.locator('input[name="branchAddress"]').fill(`E2E Address ${stamp}`);
    await page.getByRole("button", { name: "Şubeyi kaydet" }).click();
    await expect(page.getByRole("heading", { name: "3. Masa ve güvenli QR" })).toBeVisible({
      timeout: 30_000,
    });

    // TABLE_SETUP
    await page.locator('input[name="count"]').fill("2");
    await page.locator('input[name="prefix"]').fill("E2E Masa");
    await page.getByRole("button", { name: "Masaları ve QR’ları oluştur" }).click();
    await expect(page.getByTestId("wizard-qr-pack")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("wizard-qr-image").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("wizard-qr-download").first()).toBeVisible();
    await expect(page.getByTestId("wizard-qr-print").first()).toBeVisible();

    // Refresh / recovery
    await page.reload();
    await expect(page.getByRole("heading", { name: "3. Masa ve güvenli QR" })).toBeVisible();
    await page.getByTestId("wizard-qr-recover").first().click();
    await expect(page.getByTestId("wizard-qr-pack")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("wizard-qr-image").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "QR paketini kaydettim, devam" }).click();
    await expect(page.getByRole("heading", { name: "4. Personel daveti" })).toBeVisible({
      timeout: 30_000,
    });

    // STAFF_INVITE — new user
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

    const preview = page.locator("text=Önizleme bağlantısı").locator("..").locator(".font-mono");
    await expect(preview).toBeVisible({ timeout: 15_000 });
    const inviteUrl = (await preview.textContent())!.trim();
    expect(inviteUrl).toContain("/invite/");

    const invitePage = await context.newPage();
    await invitePage.goto(inviteUrl);
    await expect(invitePage.getByRole("heading", { name: "Personel daveti" })).toBeVisible();
    await expect(invitePage.locator('input[name="email"]')).toHaveValue("");
    await invitePage.locator('input[name="email"]').fill(newEmail);
    await invitePage.locator('input[name="name"]').fill("E2E Invitee");
    await invitePage.locator('input[name="password"]').fill("Password1!");
    await invitePage.getByRole("button", { name: "Daveti kabul et" }).click();
    await expect(invitePage).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await invitePage.close();

    // Existing passworded user → LOGIN_REQUIRED (dedicated user, not fixture member)
    const existingEmail = `e2e.invite.existing+${stamp}@example.com`;
    const existingUser = await prisma.user.create({
      data: {
        email: existingEmail,
        name: "E2E Existing",
        // Non-null hash marks account as passworded; accept path requires session, not password verify.
        passwordHash: "scrypt:v1:e2e-salt:e2e-hash",
        passwordSetAt: new Date(),
        isActive: true,
      },
    });

    const afterAccept = await prisma.activationJourney.findUniqueOrThrow({
      where: { id: journeyId },
    });
    if (afterAccept.currentStep !== ActivationStepKey.STAFF_INVITE) {
      await prisma.activationJourney.update({
        where: { id: journeyId },
        data: { currentStep: ActivationStepKey.STAFF_INVITE, status: "IN_PROGRESS" },
      });
      await prisma.activationJourneyStep.update({
        where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.STAFF_INVITE } },
        data: { status: "PENDING", completedAt: null },
      });
    }

    await page.goto(`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`);
    await expect(page.getByRole("heading", { name: "4. Personel daveti" })).toBeVisible({
      timeout: 30_000,
    });
    await page.locator('input[name="email"]').fill(existingEmail);
    await page.getByRole("button", { name: "Davet gönder" }).click();
    await expect(page.getByText(existingEmail)).toBeVisible({ timeout: 30_000 });

    const existingInvitePreview = page.locator("text=Önizleme bağlantısı").locator("..").locator(".font-mono");
    await expect(existingInvitePreview).toBeVisible({ timeout: 15_000 });
    const existingInviteUrl = (await existingInvitePreview.textContent())!.trim();

    const bare = await context.browser()!.newContext();
    const barePage = await bare.newPage();
    await barePage.goto(existingInviteUrl);
    await barePage.locator('input[name="email"]').fill(existingEmail);
    await barePage.getByRole("button", { name: "Daveti kabul et" }).click();
    await expect(barePage.getByText(/önce giriş yapmalısınız/i)).toBeVisible({ timeout: 15_000 });
    await expect(barePage.getByRole("button", { name: "Giriş yap ve davete dön" })).toBeVisible();
    await bare.close();

    await page.goto(`/dashboard/wexpay/activation?organizationId=${encodeURIComponent(orgId)}`);
    await expect(page.getByRole("heading", { name: /Kurulum sihirbazı|4\. Personel|Sonraki adımlar/ })).toBeVisible();

    await prisma.staffInvite.deleteMany({ where: { organizationId: orgId, email: { in: [newEmail, existingEmail] } } });
    await prisma.membership.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => undefined);
    await prisma.$disconnect();
  });
});
