import { expect, test } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  loadFixtures,
  loginAdmin,
} from "./helpers";

test.describe("admin content workspace", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  test.beforeEach(async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");
    await loginAdmin(page, email!, password);
  });

  test("overview KPIs and operational blocks render", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Operasyon çalışma alanı|Müşteri yönetimini/i })).toBeVisible();
    await expect(page.getByText(/Aktif müşteri|Toplam müşteri/i).first()).toBeVisible();
    await expect(page.getByText(/Yapılacaklar|Hızlı işlemler|Son işlemler/i).first()).toBeVisible();
  });

  test("support filters and lead drawer open/close with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/support");
    await expect(page.getByRole("heading", { name: /Destek masası/i })).toBeVisible();
    await expect(page.getByText(/Toplam talep|Açık \/ işlemde/i).first()).toBeVisible();

    const openDetail = page.getByRole("link", { name: /Detayı aç/i }).first();
    if ((await openDetail.count()) === 0) {
      await expect(page.getByText(/Henüz public demo talebi yok|Seçili filtrelerle eşleşen kayıt yok|Public demo/i).first()).toBeVisible();
      return;
    }

    await openDetail.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Kimlik ve iletişim|Takip|Durum güncelle/i).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("no horizontal overflow at 390 and 1920", async ({ page }) => {
    for (const width of [390, 1920] as const) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      await page.goto("/admin/customers");
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });

  test("migration preview stays read-only", async ({ page }) => {
    await page.goto("/admin/plans/wexpay-migration");
    await expect(page.getByText(/yalnızca önizlemedir|Salt okunur/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Apply all|Toplu uygula|Tümüne uygula/i })).toHaveCount(0);
  });

  test("PayTR flags remain disabled (boolean display only)", async ({ page }) => {
    await page.goto("/admin/integrations");
    await expect(page.getByText(/PayTR abonelik API|PayTR recurring|WexPay PayTR API/i).first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/Kapalı|Açık/);
    expect(body).not.toMatch(/merchant_key|merchant_salt|secret_key/i);
  });

  test("content-dense routes smoke", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const routes = [
      "/admin",
      "/admin/customers",
      "/admin/users",
      "/admin/applications",
      "/admin/support",
      "/admin/licenses",
      "/admin/billing",
      "/admin/audit-logs",
      "/admin/settings",
      "/admin/products",
      "/admin/plans",
      "/admin/plans/wexpay-migration",
      "/admin/subscriptions",
      "/admin/integrations",
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator(".admin-shell")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Unexpected Application Error/i);
    }
  });
});
