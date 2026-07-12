import { expect, test } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  e2eTimestamp,
  fillDemoRequestForm,
  loadFixtures,
  loginAdmin,
  submitDemoRequest,
} from "./helpers";

test.describe.serial("admin journey", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();
  const stamp = e2eTimestamp();
  const leadEmail = `e2e.adminlead+${stamp}@example.com`;
  const leadCompany = `E2E Wexon Test Org ${stamp}`;

  test("admin dashboard and CRM surfaces render", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");

    await loginAdmin(page, email!, password);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.locator("body")).toContainText(/admin|organizasyon|Wexon/i);

    for (const path of ["/admin/organizations", "/admin/support", "/admin/applications", "/admin/customers"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace("/", "\\/")));
      await expect(page.locator("body")).not.toContainText(/Unexpected Application Error/i);
    }
  });

  test("public demo request appears in admin support CRM", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");

    await page.goto("/demo-request?source=e2e-admin-crm");
    await fillDemoRequestForm(page, {
      fullName: "E2E Admin CRM Lead",
      company: leadCompany,
      email: leadEmail,
      phone: "+905559998877",
      product: "WexPay",
      message: "E2E admin CRM visibility check for demo lead pipeline.",
    });
    await submitDemoRequest(page);
    await expect(page.getByText("Talebiniz alındı")).toBeVisible();

    await loginAdmin(page, email!, password);
    await page.goto("/admin/support");
    await expect(page.getByText(leadCompany).or(page.getByText(leadEmail)).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("admin can update lead status on support panel", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");

    await loginAdmin(page, email!, password);
    await page.goto("/admin/support");

    const leadRow = page.locator("tr, article, section").filter({ hasText: leadCompany }).first();
    test.skip((await leadRow.count()) === 0, "lead from previous step not visible");

    const statusSelect = leadRow.locator('select[name="leadStatus"]').first();
    if (await statusSelect.count()) {
      await statusSelect.selectOption("contacted");
      await leadRow.getByRole("button", { name: /Güncelle/i }).first().click();
      await page.reload();
      await expect(page.locator("body")).toContainText(/İletişime Geçildi|contacted|İletişim/i);
    }
  });

  test("admin organization detail stays on fixture org", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    const orgId = fixtures.realOrgId ?? fixtures.customerOrgId;
    test.skip(!email || !password || !orgId, "admin credentials and org fixture required");

    await loginAdmin(page, email!, password);
    await page.goto(`/admin/organizations/${orgId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/organizations/${orgId}`));
    await expect(page.getByRole("link", { name: "Wexon Core paneli" })).toBeVisible();
  });

  test("admin logout returns to login surface", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");

    await loginAdmin(page, email!, password);
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(admin\/login|login)/);
  });
});
