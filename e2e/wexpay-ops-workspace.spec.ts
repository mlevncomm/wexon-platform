import { expect, test, type Page } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

const WEXPAY_ROUTES = [
  "",
  "tables",
  "kitchen",
  "orders",
  "menu",
  "payments",
  "reports",
  "settings",
  "restaurants",
  "branches",
] as const;

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

/**
 * Read-only shared-mode ops workspace regression.
 * Does not create orders/payments/tables/menu mutations.
 */
test.describe.serial("wexpay ops workspace (read-only)", () => {
  const fixtures = loadFixtures();

  test("cashier shell, tables drawer copy, kitchen, payments split, tenant deny", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(
      !fixtures.fixturesReady || !fixtures.licensedOrgId || !fixtures.licensedCustomerEmail,
      fixtures.setupError ?? "licensed WexPay fixture required",
    );

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    const orgQ = `organizationId=${fixtures.licensedOrgId}`;

    await page.goto(`/apps/wexpay?${orgQ}`);
    const body = await page.locator("body").innerText();
    if (/Erişim gerekli|yetkisiz|unauthorized/i.test(body) && !page.url().includes("/apps/wexpay")) {
      test.skip(true, "licensed fixture missing WexPay entitlement");
    }

    await expect(page.locator(".wexpay-shell")).toBeVisible();

    for (const width of [390, 1440, 1920] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/apps/wexpay?${orgQ}`);
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/apps/wexpay?${orgQ}`);
    const sidebar = page.locator(".wexpay-body > aside");
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(248);
    expect(box!.width).toBeLessThanOrEqual(272);

    for (const route of WEXPAY_ROUTES) {
      const path = route ? `/apps/wexpay/${route}?${orgQ}` : `/apps/wexpay?${orgQ}`;
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/unauthorized$/);
      await expect(page.locator(".wexpay-shell")).toBeVisible();
    }

    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await expect(page.getByText("Kasa workspace")).toBeVisible();
    const firstTable = page.locator("button").filter({ hasText: /kişilik|Kalan/ }).first();
    if (await firstTable.count()) {
      await firstTable.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const drawerText = await page.getByRole("dialog").innerText();
      expect(drawerText).toMatch(/Masayı aç ve ilk siparişi oluştur|Masaya yeni sipariş ekle/);
      expect(drawerText).not.toMatch(/Mevcut siparişe ürün ekle/);
      if (/EMPTY|Boş|Açık sipariş yok/i.test(drawerText) || drawerText.includes("Masayı aç ve ilk siparişi oluştur")) {
        expect(drawerText).toMatch(/Masayı aç ve ilk siparişi oluştur|Ayrı bir masa-aç|ilk createOrder/i);
      }
      if (drawerText.includes("Masaya yeni sipariş ekle")) {
        expect(drawerText).toMatch(/mevcut siparişe ürün eklemez|yeni bir sipariş/i);
      }
      expect(drawerText).toMatch(/Tahsilat|Kalan/);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await page.goto(`/apps/wexpay/kitchen?${orgQ}`);
    await expect(page.getByText(/Hazırlık ekranı|Mutfak/i).first()).toBeVisible();
    await expect(page.getByText(/Yeni|Hazırlanıyor|Servis/i).first()).toBeVisible();

    await page.goto(`/apps/wexpay/payments?${orgQ}`);
    const paymentsText = await page.locator(".wexpay-content").innerText();
    expect(paymentsText).toMatch(/Müşteri ödeme istekleri|ödeme isteği|tahsilat/i);
    expect(paymentsText).not.toMatch(/riskReasons|merchant_key|PAYTR_MERCHANT/i);
    if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
      expect(paymentsText).not.toMatch(/canlı sanal POS aktif|PayTR ile hemen ödeme alın/i);
    }

    await page.goto(`/apps/wexpay/menu?${orgQ}`);
    const menuText = await page.locator(".wexpay-content").innerText();
    expect(menuText).toMatch(/Satışta|Stokta değil|Aktif|Menü/i);

    await page.goto(`/apps/wexpay?organizationId=00000000-0000-0000-0000-000000000099`);
    await expect(page.getByText(/Erişim gerekli|yetkisiz|unauthorized|lisans/i).first()).toBeVisible();
  });
});
