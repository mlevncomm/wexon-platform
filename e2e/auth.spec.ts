import { expect, test } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  customerPassword,
  expectSessionCookieSecureFlags,
  loadFixtures,
  loginAdmin,
  loginCustomer,
  loginUnified,
} from "./helpers";

test.describe.serial("auth journey", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  test("unified login shows validation for empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
  });

  test("wrong password stays on login with error", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.customerOrgId, fixtures.setupError ?? "customer fixture required");

    await loginUnified(page, fixtures.customerEmail, "Definitely-Wrong-Password-999");
    await expect(page).toHaveURL(/\/(login|dashboard\/login)/);
    await expect(page.getByText(/hatalı|geçersiz|yanlış|şifre|credentials|unauthorized/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("customer login reaches dashboard and sets secure cookie flags", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.customerOrgId, fixtures.setupError ?? "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);
    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
    await expect(page.getByText("Wexon Core").first()).toBeVisible();
    await expectSessionCookieSecureFlags(page, "wexon_customer_session");
  });

  test("login next parameter routes customer after success", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    const next = `/dashboard?organizationId=${fixtures.customerOrgId}`;
    await loginUnified(page, fixtures.customerEmail, customerPassword(), next);
    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
  });

  test("admin wrong password is rejected", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email, "admin email required");

    await page.goto("/admin/login");
    await page.getByLabel("E-posta").fill(email!);
    await page.locator('input[name="password"]').fill("wrong-admin-password");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/hatalı|geçersiz|yanlış|şifre|yetkisiz|izin/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("admin login sets admin session cookie", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "ADMIN_EMAILS and ADMIN_LOGIN_PASSWORD required");

    await loginAdmin(page, email!, password);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expectSessionCookieSecureFlags(page, "wexon_admin_session");
  });

  test("signup page renders and validation blocks empty submit", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Kayıt ol/i })).toBeVisible();
    await page.getByRole("button", { name: /Hesap oluştur/i }).click();
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
  });
});
