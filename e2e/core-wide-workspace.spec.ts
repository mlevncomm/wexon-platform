import { expect, test, type Page } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

const CORE_ROUTES = [
  "",
  "products",
  "subscription",
  "billing",
  "organization",
  "users",
  "integrations",
  "support",
  "activity",
] as const;

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
}

test.describe.serial("core wide workspace", () => {
  const fixtures = loadFixtures();

  test("responsive shell, sidebar, drawer, routes, and safety", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    const orgQ = `organizationId=${fixtures.customerOrgId}`;

    for (const width of [390, 1440, 1920] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/dashboard?${orgQ}`);
      await expect(page.locator(".core-shell")).toBeVisible();

      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);

      const html = await page.content();
      expect(html).not.toMatch(/admin-shell|WexonAdminShell|wexon-admin-layout/);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/dashboard?${orgQ}`);

    const sidebar = page.locator(".core-body > aside");
    await expect(sidebar).toBeVisible();
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(sidebarBox!.width).toBeGreaterThanOrEqual(248);
    expect(sidebarBox!.width).toBeLessThanOrEqual(272);

    const content = page.locator(".core-content > div").first();
    const contentBox = await content.boundingBox();
    expect(contentBox).toBeTruthy();
    expect(contentBox!.width).toBeGreaterThan(900);

    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/dashboard?${orgQ}`);
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of CORE_ROUTES) {
      const path = route ? `/dashboard/${route}?${orgQ}` : `/dashboard?${orgQ}`;
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/unauthorized/);
      await expect(page.locator(".core-shell")).toBeVisible();
    }

    await page.goto(`/dashboard/billing?${orgQ}`);
    const billingText = await page.locator(".core-content").innerText();
    if (process.env.PAYTR_SUBSCRIPTION_ENABLE_API !== "true") {
      expect(billingText).not.toMatch(/ödemeyi başlat|checkout|PayTR ile öde/i);
      expect(billingText).toMatch(/Kapalı|aktif değil/i);
    }
  });
});
