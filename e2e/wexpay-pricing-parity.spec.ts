import { test, expect } from "@playwright/test";

const PRICING_PATHS = ["/packages", "/products/wexpay"] as const;

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
});
