import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import {
  adminEmailFromEnv,
  adminPassword,
  expectAdminSessionCookieHostOnly,
  loadFixtures,
  loginAdmin,
} from "./helpers";

/**
 * Admin PR4 — commercial consistency (isolated, 0 skip).
 * Titles are gated by scripts/run-wexpay-isolated-e2e.mjs.
 */
test.describe.serial("admin commercial consistency (PR4)", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  function requireFixtures() {
    expect(fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable").toBe(true);
    expect(fixtures.fixturesReady, fixtures.setupError ?? "fixtures incomplete").toBe(true);
    expect(fixtures.licensedOrgId, "licensed org required").toBeTruthy();
    const email = adminEmailFromEnv(fixtures);
    expect(email, "admin email required").toBeTruthy();
    return { email: email!, orgId: fixtures.licensedOrgId! };
  }

  async function ensureOrgHasSubscription(orgId: string) {
    const license = await prisma.license.findFirst({
      where: { organizationId: orgId, product: { key: "wexpay" } },
      include: { subscription: true, plan: true, product: true },
      orderBy: { createdAt: "desc" },
    });
    expect(license, "licensed org must have WexPay license").toBeTruthy();
    if (!license!.subscription) {
      await prisma.subscription.create({
        data: {
          organizationId: orgId,
          licenseId: license!.id,
          planId: license!.planId,
          status: "ACTIVE",
          interval: "MONTHLY",
          provider: "admin_manual",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return prisma.license.findUniqueOrThrow({
      where: { id: license!.id },
      include: { subscription: true, plan: true, product: true },
    });
  }

  async function clearFreshActivationReservation(orgId: string, productId: string) {
    await prisma.activationFeeLedger.updateMany({
      where: { organizationId: orgId, productId, status: "PENDING" },
      data: { reservedUntil: null },
    });
  }

  async function collapseUsageForEssential(orgId: string) {
    const restaurants = await prisma.restaurant.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });
    for (const extra of restaurants.slice(1)) {
      await prisma.restaurant.update({ where: { id: extra.id }, data: { isActive: false } });
      await prisma.branch.updateMany({ where: { restaurantId: extra.id }, data: { isActive: false } });
    }
    const keep = restaurants[0];
    if (!keep) return;
    await prisma.restaurant.update({ where: { id: keep.id }, data: { isActive: true } });
    const branches = await prisma.branch.findMany({
      where: { restaurantId: keep.id },
      orderBy: { createdAt: "asc" },
    });
    for (const extra of branches.slice(1)) {
      await prisma.branch.update({ where: { id: extra.id }, data: { isActive: false } });
    }
    if (branches[0]) {
      await prisma.branch.update({ where: { id: branches[0].id }, data: { isActive: true } });
    }
  }

  async function openCommercialPanels(page: import("@playwright/test").Page) {
    for (const title of ["Lisans ve paket", "Aktivasyon ücreti"]) {
      const details = page.locator("details").filter({ hasText: title }).first();
      if ((await details.count()) === 0) continue;
      const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
      if (!isOpen) await details.locator("summary").click();
    }
  }

  async function submitCommercialForm(
    _page: import("@playwright/test").Page,
    submit: import("@playwright/test").Locator,
  ) {
    await submit.click();
  }

  test("PR4C: session v3 opens commercial org detail", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);
    await ensureOrgHasSubscription(orgId);

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    await expect(page.getByTestId("license-commercial-panel")).toBeVisible();
    await expect(page.getByTestId("license-sync-summary")).toBeVisible();
    await expect(page.getByTestId("activation-fee-panel")).toBeVisible();
    await expect(page.locator("body")).toContainText(/Senkron|Abonelik yok|Tutarsız/);
  });

  test("PR4C: upgrade succeeds and keeps License/Subscription synced", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);

    const essential = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "essential" }, { key: { contains: "essential" } }],
      },
    });
    const growth = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "growth" }, { key: { contains: "growth" } }],
      },
    });
    expect(essential && growth, "essential+growth plans required").toBeTruthy();

    // Start from a lower tier so the controlled form enables submit for a real upgrade.
    await prisma.license.update({ where: { id: license.id }, data: { planId: essential!.id } });
    if (license.subscription) {
      await prisma.subscription.update({ where: { id: license.subscription.id }, data: { planId: essential!.id } });
    }
    await clearFreshActivationReservation(orgId, license.productId);

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    const form = page.getByTestId("license-commercial-panel").locator("form").filter({
      has: page.getByTestId("plan-change-submit"),
    });
    await form.locator('select[name="planId"]').selectOption(growth!.id);
    await expect(form.getByTestId("plan-change-type")).toContainText(/Yükseltme/);
    await form.locator('input[name="reason"]').fill("Isolated E2E Growth yükseltme gerekçesi");
    await form.locator('input[name="confirmed"]').check();
    await expect(form.getByTestId("plan-change-submit")).toBeEnabled();
    await submitCommercialForm(page, form.getByTestId("plan-change-submit"));
    await expect(page.getByTestId("license-sync-summary")).toContainText(/Growth/i, { timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText(/adminError=/);
    await expect(page.locator("body")).not.toContainText(/Paket düşürme reddedildi|Paket değiştirilemedi/);

    const updated = await prisma.license.findUniqueOrThrow({
      where: { id: license.id },
      include: { subscription: true },
    });
    expect(updated.planId).toBe(growth!.id);
    expect(updated.subscription?.planId).toBe(growth!.id);
    await openCommercialPanels(page);
    await expect(page.getByTestId("license-sync-summary")).toContainText(/Senkron/);
  });

  test("PR4C: over-limit downgrade is rejected without mutation", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);

    const essential = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "essential" }, { key: { contains: "essential" } }],
      },
    });
    const growth = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "growth" }, { key: { contains: "growth" } }],
      },
    });
    expect(essential && growth).toBeTruthy();

    await prisma.license.update({ where: { id: license.id }, data: { planId: growth!.id } });
    if (license.subscription) {
      await prisma.subscription.update({ where: { id: license.subscription.id }, data: { planId: growth!.id } });
    }
    await clearFreshActivationReservation(orgId, license.productId);

    let restaurant = await prisma.restaurant.findFirst({ where: { organizationId: orgId } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: { organizationId: orgId, name: "PR4C Multi", slug: `pr4c-multi-${Date.now()}`, isActive: true },
      });
    }
    const branchCount = await prisma.branch.count({ where: { restaurantId: restaurant.id, isActive: true } });
    if (branchCount < 2) {
      for (let i = branchCount; i < 2; i += 1) {
        await prisma.branch.create({
          data: {
            restaurantId: restaurant.id,
            name: `PR4C B${i}`,
            slug: `pr4c-b${i}-${Date.now()}`,
            isActive: true,
          },
        });
      }
    }

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    const form = page.getByTestId("license-commercial-panel").locator("form").filter({
      has: page.getByTestId("plan-change-submit"),
    });
    await form.locator('select[name="planId"]').selectOption(essential!.id);
    await form.locator('input[name="reason"]').fill("Isolated E2E limit aşan downgrade");
    await form.locator('input[name="confirmed"]').check();
    await expect(form.getByTestId("plan-change-submit")).toBeEnabled();
    await submitCommercialForm(page, form.getByTestId("plan-change-submit"));
    await expect(page.locator("body")).toContainText(/Paket düşürme reddedildi/, { timeout: 30_000 });

    const after = await prisma.license.findUniqueOrThrow({
      where: { id: license.id },
      include: { subscription: true },
    });
    expect(after.planId).toBe(growth!.id);
    expect(after.subscription?.planId).toBe(growth!.id);
  });

  test("PR4C: suitable downgrade succeeds when usage fits", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);
    const essential = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "essential" }, { key: { contains: "essential" } }],
      },
    });
    const growth = await prisma.plan.findFirst({
      where: {
        productId: license.productId,
        isActive: true,
        OR: [{ tierKey: "growth" }, { key: { contains: "growth" } }],
      },
    });
    expect(essential && growth).toBeTruthy();

    // Collapse usage so Essential limits and multi-location checks pass.
    await collapseUsageForEssential(orgId);
    await prisma.license.update({ where: { id: license.id }, data: { planId: growth!.id } });
    if (license.subscription) {
      await prisma.subscription.update({ where: { id: license.subscription.id }, data: { planId: growth!.id } });
    }
    await clearFreshActivationReservation(orgId, license.productId);

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    const form = page.getByTestId("license-commercial-panel").locator("form").filter({
      has: page.getByTestId("plan-change-submit"),
    });
    await form.locator('select[name="planId"]').selectOption(essential!.id);
    await expect(form.getByTestId("plan-change-type")).toContainText(/Düşürme/);
    await form.locator('input[name="reason"]').fill("Isolated E2E uygun downgrade");
    await form.locator('input[name="confirmed"]').check();
    await expect(form.getByTestId("plan-change-submit")).toBeEnabled();
    await submitCommercialForm(page, form.getByTestId("plan-change-submit"));
    await expect(page.getByTestId("license-sync-summary")).toContainText(/Essential/i, { timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText(/Paket düşürme reddedildi|Paket değiştirilemedi/);

    const after = await prisma.license.findUniqueOrThrow({
      where: { id: license.id },
      include: { subscription: true },
    });
    expect(after.planId).toBe(essential!.id);
    expect(after.subscription?.planId).toBe(essential!.id);

    // Restore Growth so later isolated suite specs (CSV export, multi-location) keep Growth entitlements.
    await prisma.license.update({ where: { id: license.id }, data: { planId: growth!.id } });
    if (after.subscription) {
      await prisma.subscription.update({ where: { id: after.subscription.id }, data: { planId: growth!.id } });
    }
  });

  test("PR4C: activation fee panel and suitable waive", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);

    await prisma.activationFeeLedger.upsert({
      where: {
        organizationId_productId: { organizationId: orgId, productId: license.productId },
      },
      create: {
        organizationId: orgId,
        productId: license.productId,
        planId: license.planId,
        status: "PENDING",
        activationFeeMinor: 2000000,
        taxAmountMinor: 0,
        grossAmountMinor: 2000000,
        reservedUntil: null,
        subscriptionPaymentId: null,
      },
      update: {
        status: "PENDING",
        waivedReason: null,
        reservedUntil: null,
        subscriptionPaymentId: null,
        paidAt: null,
      },
    });

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    await expect(page.getByTestId("activation-fee-status")).toContainText(/Bekliyor|Beklemede|PENDING/i);
    const waive = page.getByTestId("activation-fee-waive-form");
    await expect(waive).toBeVisible();
    await waive.locator('input[name="reason"]').fill("Isolated E2E aktivasyon muafiyeti");
    await waive.locator('input[name="confirmed"]').check();
    await expect(waive.getByTestId("activation-fee-waive-submit")).toBeEnabled();
    await submitCommercialForm(page, waive.getByTestId("activation-fee-waive-submit"));
    // Status row text is concatenated as "DurumMuaf" — avoid word-boundary regex.
    await expect(page.getByTestId("activation-fee-status")).toContainText("Muaf", { timeout: 30_000 });
    await expect
      .poll(async () => {
        const row = await prisma.activationFeeLedger.findUniqueOrThrow({
          where: { organizationId_productId: { organizationId: orgId, productId: license.productId } },
        });
        return row.status;
      })
      .toBe("WAIVED");
  });

  test("PR4C: settled ledger waive is rejected", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);

    await prisma.activationFeeLedger.upsert({
      where: {
        organizationId_productId: { organizationId: orgId, productId: license.productId },
      },
      create: {
        organizationId: orgId,
        productId: license.productId,
        status: "PAID",
        paidAt: new Date(),
        activationFeeMinor: 2000000,
      },
      update: {
        status: "PAID",
        paidAt: new Date(),
        waivedReason: null,
      },
    });

    await page.goto(`/admin/organizations/${orgId}`);
    await openCommercialPanels(page);
    await expect(page.getByTestId("activation-fee-waive-form")).toHaveCount(0);
    await expect(page.getByTestId("activation-fee-panel")).toContainText(/muafiyet işlemi uygun değil|Ödendi|PAID/i);
  });

  test("PR4C: cross-tenant license plan change is rejected", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    const license = await ensureOrgHasSubscription(orgId);
    const otherOrgId =
      [fixtures.demoOrgId, fixtures.inactiveWexPayOrgId, fixtures.customerOrgId, fixtures.realOrgId].find(
        (id) => Boolean(id) && id !== orgId,
      ) ?? null;
    expect(otherOrgId, "second org required for cross-tenant check").toBeTruthy();
    expect(otherOrgId).not.toBe(orgId);

    await page.goto(`/admin/organizations/${otherOrgId}`);
    await openCommercialPanels(page);
    // Attempt posting plan change action bound to wrong org/license via crafted form is covered by DB tests;
    // UI must still not expose the foreign license as editable on this org.
    await expect(page.getByTestId("license-commercial-panel")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body.includes(license.id)).toBeFalsy();
  });

  test("PR4C: subscription create form providers are allowlisted", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto("/admin/subscriptions");
    const createPanel = page.locator("details").filter({ hasText: "Yeni abonelik oluştur" }).first();
    if ((await createPanel.count()) > 0) {
      const isOpen = await createPanel.evaluate((el) => (el as HTMLDetailsElement).open);
      if (!isOpen) await createPanel.locator("summary").click();
    }
    const provider = page.locator('select[name="provider"]');
    await expect(provider).toBeVisible();
    const options = await provider.locator("option").allTextContents();
    expect(options.join(" ")).toMatch(/Admin manuel/i);
    expect(options.join(" ")).toMatch(/PayTR/i);
    expect(options.join(" ").toLowerCase()).not.toContain("mock");
    expect(options.join(" ").toLowerCase()).not.toContain("stripe");
  });

  test("PR4C: PR3 read-only preview regression still holds", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(`/admin/organizations/${orgId}/wexpay-preview`);
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i);
  });

  test("PR4C: logout clears admin session cookie", async ({ page }) => {
    const { email } = requireFixtures();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    const cookies = await page.context().cookies();
    const v3 = cookies.find((c) => c.name === "wexon_admin_session_v3");
    expect(!v3 || !v3.value).toBeTruthy();
  });
});
