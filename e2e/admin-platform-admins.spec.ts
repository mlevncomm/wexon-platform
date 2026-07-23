import { expect, test } from "@playwright/test";
import { adminEmailFromEnv, adminPassword, e2eTimestamp, loadFixtures, loginAdmin } from "./helpers";

/**
 * PlatformAdmin PR2A — required scenarios for isolated CI (must not skip/fake-green).
 * Titles are gated by scripts/run-wexpay-isolated-e2e.mjs.
 */
test.describe.serial("admin platform admins (PR2A)", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();
  const stamp = e2eTimestamp();
  const emailA = `e2e.padmin.a+${stamp}@example.com`;
  const emailB = `e2e.padmin.b+${stamp}@example.com`;

  function requireAdminCreds() {
    // Fail-closed in isolated CI: never skip into a fake-green suite.
    expect(fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable").toBe(true);
    const email = adminEmailFromEnv(fixtures);
    expect(email, "admin email required (E2E_ADMIN_EMAIL / fixtures)").toBeTruthy();
    expect(password, "admin password required (E2E_ADMIN_PASSWORD)").toBeTruthy();
    return email!;
  }

  test("lists readiness panel and adds platform admins", async ({ page }) => {
    const email = requireAdminCreds();

    await loginAdmin(page, email, password);
    await page.goto("/admin/platform-admins");
    await expect(page).toHaveURL(/\/admin\/platform-admins/);
    await expect(page.locator("body")).toContainText(/PlatformAdmin yönetimi/i);
    await expect(page.locator("body")).toContainText(/PR2A hazırlık/i);
    await expect(page.locator("body")).toContainText(/PR2B'de bağlanacak/);
    await expect(page.locator("body")).toContainText(/paylaşılan admin şifresi/i);
    await expect(page.locator("body")).not.toContainText(/ADMIN_LOGIN_PASSWORD|ADMIN_SESSION_SECRET|eyJhbGciOi/i);

    const addForm = page.locator("form").filter({ has: page.locator('input[name="displayName"]') }).first();
    await addForm.locator('input[name="email"]').fill(emailA);
    await addForm.locator('input[name="displayName"]').fill("E2E Platform A");
    await addForm.getByRole("button", { name: "Ekle", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/platform-admins/);
    await expect(page.locator("body")).toContainText(emailA);
    await expect(page.locator("body")).toContainText("Bağlanmadı");

    await addForm.locator('input[name="email"]').fill(emailB);
    await addForm.locator('input[name="displayName"]').fill("E2E Platform B");
    await addForm.getByRole("button", { name: "Ekle", exact: true }).click();
    await expect(page.locator("body")).toContainText(emailB);
  });

  test("deactivates and reactivates when another active admin exists", async ({ page }) => {
    const email = requireAdminCreds();

    await loginAdmin(page, email, password);
    await page.goto("/admin/platform-admins");

    const rowA = page.locator("tr").filter({ hasText: emailA }).first();
    await expect(rowA).toBeVisible();
    await rowA.getByRole("button", { name: "Pasife al" }).click();
    await expect(page).toHaveURL(/\/admin\/platform-admins/);
    await expect(rowA).toContainText(/Pasif/i);

    await rowA.getByRole("button", { name: "Aktifleştir" }).click();
    await expect(rowA).toContainText(/Aktif/i);
  });

  test("blocks deactivating the last active PlatformAdmin", async ({ page }) => {
    const email = requireAdminCreds();

    await loginAdmin(page, email, password);
    await page.goto("/admin/platform-admins");

    // Deactivate B first so only A (among the e2e pair) remains active among our rows;
    // then deactivate every other active row if present, finally attempt last-active on A.
    const rowB = page.locator("tr").filter({ hasText: emailB }).first();
    if (await rowB.getByRole("button", { name: "Pasife al" }).count()) {
      await rowB.getByRole("button", { name: "Pasife al" }).click();
    }

    // Deactivate any other active rows except A (best-effort for isolated DB with only our rows).
    for (;;) {
      const otherActive = page
        .locator("tr")
        .filter({ hasNotText: emailA })
        .filter({ has: page.getByRole("button", { name: "Pasife al" }) })
        .first();
      if ((await otherActive.count()) === 0) break;
      await otherActive.getByRole("button", { name: "Pasife al" }).click();
      await page.goto("/admin/platform-admins");
    }

    const rowA = page.locator("tr").filter({ hasText: emailA }).first();
    await rowA.getByRole("button", { name: "Pasife al" }).click();
    await expect(page.locator("body")).toContainText(/son aktif platform yöneticisi/i);
    await expect(rowA).toContainText(/Aktif/i);
  });

  test("smoke: nav link reaches platform admins", async ({ page }) => {
    const email = requireAdminCreds();

    await loginAdmin(page, email, password);
    await page.goto("/admin");
    const nav = page.getByRole("link", { name: /Platform Yöneticileri/i }).first();
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page).toHaveURL(/\/admin\/platform-admins/);
  });
});
