import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

test.describe.serial("security journey", () => {
  const fixtures = loadFixtures();

  test("unauthenticated protected routes redirect to login", async ({ page }) => {
    for (const path of ["/dashboard", "/admin", "/apps/wexpay", "/dashboard/products", "/admin/organizations"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(login|admin\/login|dashboard\/login)/);
    }
  });

  test("customer cannot open admin panel", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerEmail, "customer fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(admin\/login|login|unauthorized)/);
  });

  test("customer cannot access foreign org dashboard data", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto("/dashboard?organizationId=00000000-0000-0000-0000-000000000088");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("production seed helpers are not exposed as public routes", async ({ request }) => {
    for (const path of ["/api/seed", "/api/prisma/seed", "/prisma/seed", "/api/admin/seed"]) {
      const response = await request.get(path);
      expect([404, 401, 403, 405]).toContain(response.status());
    }
  });

  test("CUSTOMER_DEV_LOGIN_PASSWORD is not required for real customer login", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    // Real password path must work independently of optional dev fallback.
    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);
    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
  });

  test("unknown demo credential login fails", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("demo-shutdown@example.invalid");
    await page.locator('input[name="password"]').fill("Definitely-Not-A-Real-Password-999");
    await page.getByRole("button", { name: /giriş/i }).click();
    await expect(page.getByText(/e-posta veya şifre hatalı/i)).toBeVisible({ timeout: 15_000 });
  });

  test("public demo login credentials are not advertised", async ({ page }) => {
    for (const path of ["/", "/demo-request", "/products/wexpay", "/links"]) {
      await page.goto(path);
      const body = await page.locator("body").innerText();
      expect(body.toLowerCase()).not.toContain("wexon-customer-2026");
      expect(body.toLowerCase()).not.toMatch(/demo@wexon\.dev\s*[|/].*password/i);
    }
  });
});
