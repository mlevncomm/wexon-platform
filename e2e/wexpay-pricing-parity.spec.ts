import { test, expect } from "@playwright/test";
import { canonicalTierAsSeedDefaults } from "../lib/wexpay-canonical-catalog";

const PRICING_PATHS = ["/packages", "/products/wexpay"] as const;
const VIEWPORTS = [390, 768, 1024, 1440, 1728] as const;
const CANONICAL_PUBLIC_TIERS = canonicalTierAsSeedDefaults().filter(
  (tier) => tier.isPublic && tier.isActive,
);

test.describe("wexpay public pricing parity", () => {
  for (const path of PRICING_PATHS) {
    test(`${path} shows canonical tiers, tax policy, and safe CTAs`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();

      for (const tier of CANONICAL_PUBLIC_TIERS) {
        await expect(page.getByText(tier.name, { exact: false }).first()).toBeVisible();
        const monthlyPrice = `₺${tier.monthlyFee.toLocaleString("tr-TR")}/ay`;
        await expect(page.getByText(monthlyPrice, { exact: false }).first()).toBeVisible();
      }

      await expect(page.getByRole("note", { name: "İşlem oranları uyarısı" }).first()).toBeVisible();
      await expect(page.getByRole("note", { name: "İşlem oranları uyarısı" }).first()).toContainText(
        "KDV hesaplaması şu anda kapalıdır",
      );

      await expect(page.getByRole("link", { name: "Paketi satın al" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Görüşme Planla" }).first()).toBeVisible();

      await expect(page.locator("body")).not.toContainText(/Abonelik başlat/i);
      await expect(page.locator("body")).not.toContainText(/WexPay Pilot/i);

      const checkoutCta = page.locator('a[href*="/checkout"][href*="wexpay"]');
      await expect(checkoutCta.first()).toBeVisible();
      await expect(checkoutCta).toHaveCount(2);
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
