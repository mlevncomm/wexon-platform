import { test, expect } from "@playwright/test";

const PRICING_PATHS = ["/packages", "/products/wexpay"] as const;
const VIEWPORTS = [390, 768, 1024, 1440, 1728] as const;

test.describe("wexpay public pricing parity", () => {
  for (const path of PRICING_PATHS) {
    test(`${path} shows four tiers, rates, disclaimer, and safe CTAs`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();

      for (const price of ["₺7.000/ay", "₺15.000/ay", "₺35.000/ay", "₺99.000/ay"]) {
        await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
      }

      for (const rate of ["%2,89", "%2,59", "%2,35", "%2,05"]) {
        await expect(page.getByText(new RegExp(`${rate.replace(",", ",")}.*başlayan`, "i")).first()).toBeVisible();
      }

      await expect(page.getByRole("note", { name: "İşlem oranları uyarısı" }).first()).toBeVisible();

      await expect(page.getByRole("link", { name: "Uygunluğunu Kontrol Et" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Görüşme Planla" }).first()).toBeVisible();

      await expect(page.locator("body")).not.toContainText(/Abonelik başlat/i);
      await expect(page.locator("body")).not.toContainText(/WexPay Pilot/i);

      const checkoutCta = page.locator('a[href*="/checkout"][href*="wexpay"]');
      await expect(checkoutCta).toHaveCount(0);
    });
  }

  for (const path of PRICING_PATHS) {
    test(`${path} has no horizontal overflow across key viewports`, async ({ page }) => {
      for (const width of VIEWPORTS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.getByRole("note", { name: "İşlem oranları uyarısı" }).first()).toBeVisible();

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          metrics.scrollWidth,
          `${path} @ ${width}px should not overflow horizontally`,
        ).toBeLessThanOrEqual(metrics.clientWidth + 1);
      }
    });
  }
});
