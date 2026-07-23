import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import {
  adminEmailFromEnv,
  adminPassword,
  cookieByName,
  expectAdminSessionCookieHostOnly,
  loadFixtures,
  loginAdmin,
} from "./helpers";

/**
 * PR3 — tenant-safe admin WexPay preview + write controls (isolated, 0 skip).
 * Titles are gated by scripts/run-wexpay-isolated-e2e.mjs.
 */
test.describe.serial("admin wexpay preview write controls (PR3)", () => {
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

  async function previewPath(orgId: string, sub = "") {
    return `/admin/organizations/${orgId}/wexpay-preview${sub}`;
  }

  test("PR3: CF JWT + session v3 opens admin preview read-only", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);

    await page.goto(await previewPath(orgId));
    await expect(page.getByTestId("admin-wexpay-preview-banner")).toBeVisible();
    await expect(page.getByText("Admin preview")).toBeVisible();
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i);
    await expect(page.getByTestId("admin-preview-enable-write-form")).toBeVisible();
  });

  test("PR3: backend mutation forbidden while read-only", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(await previewPath(orgId, "/restaurants"));

    const before = await prisma.restaurant.count({ where: { organizationId: orgId } });
    const stamp = Date.now().toString(36);
    await page.getByTestId("admin-preview-create-restaurant").locator('input[name="name"]').fill(`Denied ${stamp}`);
    await page.getByTestId("admin-preview-create-restaurant").locator('input[name="slug"]').fill(`denied-${stamp}`);
    await page.getByTestId("admin-preview-create-restaurant").getByRole("button", { name: /Restoran oluştur/i }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i);
    const after = await prisma.restaurant.count({ where: { organizationId: orgId } });
    expect(after).toBe(before);
  });

  test("PR3: correct slug/reason enables write; same-tenant mutation succeeds", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(await previewPath(orgId));

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { slug: true },
    });

    await page.getByTestId("admin-preview-slug").fill(org.slug);
    await page.getByTestId("admin-preview-reason").fill("isolated e2e write enable");
    await page.getByTestId("admin-preview-enable-write").click();
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Write-enabled/i, {
      timeout: 15_000,
    });

    const cookies = await page.context().cookies();
    const writeCookie = cookieByName(cookies, "wexon_admin_preview_write_v1");
    expect(writeCookie, "write capability cookie").toBeTruthy();
    expect(writeCookie!.httpOnly).toBe(true);
    expect(writeCookie!.domain?.startsWith(".") ?? false).toBe(false);

    await page.goto(await previewPath(orgId, "/restaurants"));
    const stamp = Date.now().toString(36);
    const name = `PR3 Write ${stamp}`;
    const slug = `pr3-write-${stamp}`;
    await page.getByTestId("admin-preview-create-restaurant").locator('input[name="name"]').fill(name);
    await page.getByTestId("admin-preview-create-restaurant").locator('input[name="slug"]').fill(slug);
    await page.getByTestId("admin-preview-create-restaurant").getByRole("button", { name: /Restoran oluştur/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    const created = await prisma.restaurant.findFirst({
      where: { organizationId: orgId, slug },
    });
    expect(created).toBeTruthy();
  });

  test("PR3: other-tenant mutation fails with Org A capability", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const product = await prisma.product.findFirstOrThrow({
      where: { key: "wexpay", isActive: true },
      select: { id: true },
    });
    const plan = await prisma.plan.findFirstOrThrow({
      where: { productId: product.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    const otherOrg = await prisma.organization.create({
      data: {
        name: `PR3 Other ${stamp}`,
        slug: `pr3-other-${stamp}`,
        isActive: true,
        isDemo: false,
      },
      select: { id: true },
    });
    const otherLicense = await prisma.license.create({
      data: {
        organizationId: otherOrg.id,
        productId: product.id,
        planId: plan.id,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId: otherOrg.id,
        productId: product.id,
        licenseId: otherLicense.id,
        status: "ACTIVE",
      },
    });

    try {
      await loginAdmin(page, email, password);
      await page.goto(await previewPath(orgId));
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { slug: true },
      });
      await page.getByTestId("admin-preview-slug").fill(org.slug);
      await page.getByTestId("admin-preview-reason").fill("cross tenant deny check");
      await page.getByTestId("admin-preview-enable-write").click();
      await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Write-enabled/i, {
        timeout: 15_000,
      });

      // Switching org must not inherit write — other tenant stays read-only.
      await page.goto(await previewPath(otherOrg.id, "/restaurants"));
      await expect(page.getByTestId("admin-wexpay-preview-banner")).toBeVisible();
      await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i);

      const before = await prisma.restaurant.count({ where: { organizationId: otherOrg.id } });
      await page.getByTestId("admin-preview-create-restaurant").locator('input[name="name"]').fill(`XTenant ${stamp}`);
      await page.getByTestId("admin-preview-create-restaurant").locator('input[name="slug"]').fill(`xtenant-${stamp}`);
      await page.getByTestId("admin-preview-create-restaurant").getByRole("button", { name: /Restoran oluştur/i }).click();
      await page.waitForTimeout(1500);
      const after = await prisma.restaurant.count({ where: { organizationId: otherOrg.id } });
      expect(after).toBe(before);
    } finally {
      await prisma.appInstallation.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.license.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.restaurant.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } }).catch(() => undefined);
    }
  });

  test("PR3: sticky banner on preview screens", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    for (const sub of ["", "/menu", "/tables", "/orders", "/kitchen", "/payments", "/reports"]) {
      await page.goto(await previewPath(orgId, sub));
      await expect(page.getByTestId("admin-wexpay-preview-banner")).toBeVisible();
      await expect(page.getByText("Admin preview")).toBeVisible();
    }
  });

  test("PR3: demo cannot enable write", async ({ page }) => {
    const { email } = requireFixtures();
    expect(fixtures.demoOrgId, "demo org fixture required").toBeTruthy();
    await loginAdmin(page, email, password);
    await page.goto(await previewPath(fixtures.demoOrgId!));

    // Demo may still open preview; write enable must be absent or denied.
    const banner = page.getByTestId("admin-wexpay-preview-banner");
    if (await banner.count()) {
      await expect(banner).toContainText(/Demo/i);
      await expect(page.getByTestId("admin-preview-enable-write-form")).toHaveCount(0);
    } else {
      await expect(page.locator("body")).toContainText(/erişim|yetki|demo|reddedildi/i);
    }
  });

  test("PR3: disable write works", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(await previewPath(orgId));
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { slug: true },
    });
    await page.getByTestId("admin-preview-slug").fill(org.slug);
    await page.getByTestId("admin-preview-reason").fill("disable write flow check");
    await page.getByTestId("admin-preview-enable-write").click();
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Write-enabled/i, {
      timeout: 15_000,
    });
    await page.getByTestId("admin-preview-disable-write").click();
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i, {
      timeout: 15_000,
    });
    const cookies = await page.context().cookies();
    const writeCookie = cookieByName(cookies, "wexon_admin_preview_write_v1");
    expect(!writeCookie || !writeCookie.value).toBeTruthy();
  });

  test("PR3: logout clears capability", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    await page.goto(await previewPath(orgId));
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { slug: true },
    });
    await page.getByTestId("admin-preview-slug").fill(org.slug);
    await page.getByTestId("admin-preview-reason").fill("logout clears capability");
    await page.getByTestId("admin-preview-enable-write").click();
    await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Write-enabled/i, {
      timeout: 15_000,
    });

    await page.goto("/admin");
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    const cookies = await page.context().cookies();
    const writeCookie = cookieByName(cookies, "wexon_admin_preview_write_v1");
    const v3 = cookieByName(cookies, "wexon_admin_session_v3");
    expect(!writeCookie || !writeCookie.value).toBeTruthy();
    expect(!v3 || !v3.value).toBeTruthy();
  });

  test("PR3: app/core legacy admin preview does not grant write", async ({ page }) => {
    const { email, orgId } = requireFixtures();
    await loginAdmin(page, email, password);
    // Legacy /apps/wexpay with admin session should redirect to admin preview (local)
    // or deny manage — never leave write open on the app surface.
    await page.goto(`/apps/wexpay?organizationId=${encodeURIComponent(orgId)}`);
    await page.waitForTimeout(1500);
    const url = page.url();
    if (url.includes("/admin/organizations/") && url.includes("/wexpay-preview")) {
      await expect(page.getByTestId("admin-preview-write-mode")).toContainText(/Read-only/i);
    } else {
      // Unauthorized / empty access — must not expose write enable on app panel.
      await expect(page.getByTestId("admin-preview-enable-write-form")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Restoran oluştur/i })).toHaveCount(0);
    }
  });
});
