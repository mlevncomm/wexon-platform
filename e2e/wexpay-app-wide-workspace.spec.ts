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
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
}

test.describe.serial("wexpay app wide workspace", () => {
  const fixtures = loadFixtures();

  test("sidebar workspace, routes, PayTR and tenant safety", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(
      !fixtures.fixturesReady || !fixtures.licensedOrgId || !fixtures.licensedCustomerEmail,
      fixtures.setupError ?? "licensed WexPay fixture required",
    );

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    const orgQ = `organizationId=${fixtures.licensedOrgId}`;

    await page.goto(`/apps/wexpay?${orgQ}`);
    const landed = page.url();
    if (/unauthorized|erişim gerekli|erisim gerekli/i.test(await page.locator("body").innerText()) && !landed.includes("/apps/wexpay")) {
      test.skip(true, "licensed fixture missing WexPay entitlement");
    }

    await expect(page.locator(".wexpay-shell")).toBeVisible();

    for (const width of [390, 1440, 1920] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/apps/wexpay?${orgQ}`);
      await expect(page.locator(".wexpay-shell")).toBeVisible();
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/apps/wexpay?${orgQ}`);
    const sidebar = page.locator(".wexpay-body > aside");
    await expect(sidebar).toBeVisible();
    const box = await sidebar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(248);
    expect(box!.width).toBeLessThanOrEqual(272);

    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/apps/wexpay?${orgQ}`);
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of WEXPAY_ROUTES) {
      const path = route ? `/apps/wexpay/${route}?${orgQ}` : `/apps/wexpay?${orgQ}`;
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/unauthorized$/);
      await expect(page.locator(".wexpay-shell, body")).toBeVisible();
    }

    await page.goto(`/apps/wexpay?organizationId=00000000-0000-0000-0000-000000000099`);
    await expect(page.getByText(/Erişim gerekli|yetkisiz|unauthorized|lisans/i).first()).toBeVisible();

    if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
      await page.goto(`/apps/wexpay/payments?${orgQ}`);
      const text = await page.locator(".wexpay-content, body").innerText();
      expect(text).not.toMatch(/canlı sanal POS aktif|PayTR ile hemen ödeme alın/i);
    }
  });
});
