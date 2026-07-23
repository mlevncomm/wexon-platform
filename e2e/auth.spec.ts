import { expect, test } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  cookieByName,
  customerPassword,
  expectAdminSessionCookieHostOnly,
  expectSessionCookieSecureFlags,
  loadFixtures,
  loginAdmin,
  loginCustomer,
  loginUnified,
  seedCookieConsentRejected,
} from "./helpers";

test.describe.serial("auth journey", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  test("unified login shows validation for empty submit", async ({ page }) => {
    await seedCookieConsentRejected(page);
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
  });

  test("wrong password stays on login with error", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.customerOrgId, fixtures.setupError ?? "customer fixture required");

    await seedCookieConsentRejected(page);
    await loginUnified(page, fixtures.customerEmail, "Definitely-Wrong-Password-999");
    await expect(page).toHaveURL(/\/(login|dashboard\/login)/);
    await expect(page.getByText(/hatalı|geçersiz|yanlış|şifre|credentials|unauthorized/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("customer login reaches dashboard and sets secure cookie flags", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.customerOrgId, fixtures.setupError ?? "customer org fixture required");

    await seedCookieConsentRejected(page);
    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);
    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
    await expect(page.getByText("Wexon Core").first()).toBeVisible();
    await expectSessionCookieSecureFlags(page, "wexon_customer_session");
  });

  test("login next parameter routes customer after success", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await seedCookieConsentRejected(page);
    const next = `/dashboard?organizationId=${fixtures.customerOrgId}`;
    await loginUnified(page, fixtures.customerEmail, customerPassword(), next);
    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
  });

  test("admin wrong password is rejected with generic error", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email, "admin email required");

    await page.goto("/admin/login");
    // Shared password form is gone — continue without JWT must fail generically.
    await page.getByRole("button", { name: /Yönetim paneline devam et/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/Yönetim paneline erişim reddedildi/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/yetki listesinde|ADMIN_LOGIN_PASSWORD|ADMIN_SESSION/i)).toHaveCount(0);
  });

  test("unified login with admin credentials does not mint admin cookie", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin email and rollback password env required for negative test");

    await seedCookieConsentRejected(page);
    await loginUnified(page, email!, password);
    await expect(page).toHaveURL(/\/(login|dashboard\/login)/);
    const cookies = await page.context().cookies();
    expect(cookieByName(cookies, "wexon_admin_session_v3")).toBeNull();
    expect(cookieByName(cookies, "wexon_admin_session_v2")).toBeNull();
    expect(cookieByName(cookies, "wexon_admin_session")).toBeNull();
  });

  test("admin login sets host-only admin session cookie", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email, "admin email required");

    await loginAdmin(page, email!, password);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expectAdminSessionCookieHostOnly(page);
  });

  test("admin logout clears admin session cookie", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email, "admin email required");

    await loginAdmin(page, email!, password);
    await expectAdminSessionCookieHostOnly(page);
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    const cookies = await page.context().cookies();
    const v3 = cookieByName(cookies, "wexon_admin_session_v3");
    const v2 = cookieByName(cookies, "wexon_admin_session_v2");
    const legacyCookie = cookieByName(cookies, "wexon_admin_session");
    expect(!v3 || !v3.value, "v3 admin cookie should be cleared").toBeTruthy();
    expect(!v2 || !v2.value, "v2 admin cookie should be cleared").toBeTruthy();
    expect(!legacyCookie || !legacyCookie.value, "legacy admin cookie should be cleared").toBeTruthy();
  });

  test("cookie consent banner is hidden on admin routes", async ({ page }) => {
    // Intentionally do NOT seed consent — admin surfaces must hide the banner even without consent.
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Çerez tercihleri")).toHaveCount(0);
  });

  test("signup page renders and validation blocks empty submit", async ({ page }) => {
    await seedCookieConsentRejected(page);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Kayıt ol/i })).toBeVisible();
    await page.getByRole("button", { name: /Hesap oluştur/i }).click();
    await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
  });
});
