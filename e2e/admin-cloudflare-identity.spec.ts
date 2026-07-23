import { expect, test } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  attachE2eCloudflareAccessJwt,
  cookieByName,
  expectAdminSessionCookieHostOnly,
  loadFixtures,
  loginAdmin,
} from "./helpers";

/**
 * PR2B Cloudflare identity + session v3 — required isolated CI scenarios (0 skip).
 * Titles are gated by scripts/run-wexpay-isolated-e2e.mjs.
 */
test.describe.serial("admin cloudflare identity (PR2B)", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  function requireAdminEmail() {
    expect(fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable").toBe(true);
    const email = adminEmailFromEnv(fixtures);
    expect(email, "admin email required (E2E_ADMIN_EMAIL / fixtures)").toBeTruthy();
    return email!;
  }

  test("PR2B: CF JWT + active PlatformAdmin reaches dashboard", async ({ page }) => {
    const email = requireAdminEmail();
    await loginAdmin(page, email, password);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expectAdminSessionCookieHostOnly(page);
    await expect(page.locator("body")).not.toContainText(/ADMIN_LOGIN_PASSWORD|ADMIN_SESSION_SECRET|eyJhbGciOi/i);
  });

  test("PR2B: password fields absent and stale password POST does not mint session", async ({
    page,
  }) => {
    requireAdminEmail();
    expect(password, "shared password env present for negative test").toBeTruthy();

    await page.goto("/admin/login");
    await expect(page.getByRole("button", { name: /Yönetim paneline devam et/i })).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.locator('input[name="email"]')).toHaveCount(0);

    // Evidence: a raw form POST with shared password must not mint admin session cookies.
    // Deterministic Server Action hard-deny is covered by unit tests (loginAdminAction).
    const response = await page.request.post("/admin/login", {
      form: {
        email: "pr4-isolated-admin@example.test",
        password,
        next: "/admin",
      },
      maxRedirects: 0,
    });
    const cookies = await page.context().cookies();
    expect(cookieByName(cookies, "wexon_admin_session_v3")).toBeNull();
    expect(cookieByName(cookies, "wexon_admin_session_v2")).toBeNull();
    expect(cookieByName(cookies, "wexon_admin_session")).toBeNull();
    // Must not land on an authenticated admin surface.
    const location = response.headers()["location"] ?? "";
    expect(location).not.toMatch(/\/admin\/?$/);
  });

  test("PR2B: missing JWT denies admin continue", async ({ page }) => {
    requireAdminEmail();
    // No Cf-Access-Jwt-Assertion header.
    await page.goto("/admin/login");
    await page.getByRole("button", { name: /Yönetim paneline devam et/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/Yönetim paneline erişim reddedildi/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/ADMIN_|jwt|jwks|cloudflareSubject/i)).toHaveCount(0);
  });

  test("PR2B: logout clears v3 session cookie", async ({ page }) => {
    const email = requireAdminEmail();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);
    await page.getByRole("button", { name: "Admin profil menüsü" }).click();
    await Promise.all([
      page.waitForURL(/\/(login|admin\/login)/),
      page.getByRole("menuitem", { name: /Çıkış yap/i }).click(),
    ]);
    const cookies = await page.context().cookies();
    const v3 = cookieByName(cookies, "wexon_admin_session_v3");
    const v2 = cookieByName(cookies, "wexon_admin_session_v2");
    const legacy = cookieByName(cookies, "wexon_admin_session");
    expect(!v3 || !v3.value, "v3 admin cookie should be cleared").toBeTruthy();
    expect(!v2 || !v2.value, "v2 admin cookie should be cleared").toBeTruthy();
    expect(!legacy || !legacy.value, "legacy admin cookie should be cleared").toBeTruthy();
  });

  test("PR2B: v3 cookie without JWT is denied", async ({ page }) => {
    const email = requireAdminEmail();
    await loginAdmin(page, email, password);
    await expectAdminSessionCookieHostOnly(page);

    // Drop CF JWT header but keep cookies.
    await page.context().setExtraHTTPHeaders({});
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("PR2B: admin root redirect keeps PR48 default", async ({ page }) => {
    const email = requireAdminEmail();
    await attachE2eCloudflareAccessJwt(page, email);
    await page.goto("/admin/login");
    await page.getByRole("button", { name: /Yönetim paneline devam et/i }).click();
    // Local/non-production default post-login is /admin (PR48 root `/` only in production Wexon).
    await expect(page).toHaveURL(/\/admin\/?$/);
  });
});
