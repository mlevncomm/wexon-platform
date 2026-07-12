import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

test.describe.serial("customer dashboard journey", () => {
  const fixtures = loadFixtures();

  test("dashboard overview and key panels render for own org", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);
    await expect(page.getByText("Wexon Core").first()).toBeVisible();

    for (const path of ["products", "subscription", "organization", "billing", "support"]) {
      await page.goto(`/dashboard/${path}?organizationId=${fixtures.customerOrgId}`);
      await expect(page).not.toHaveURL(/\/unauthorized/);
      await expect(page.locator("main, body").first()).toBeVisible();
    }
  });

  test("foreign organizationId is blocked", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto("/dashboard?organizationId=00000000-0000-0000-0000-000000000099");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("customer logout clears session and blocks dashboard", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);

    await page.getByRole("button", { name: "Profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|dashboard\/login|$)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);

    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);
    await expect(page).toHaveURL(/\/(login|dashboard\/login)/);
  });
});
