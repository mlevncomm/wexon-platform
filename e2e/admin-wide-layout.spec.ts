import { expect, test, type Page } from "@playwright/test";
import {
  adminEmailFromEnv,
  adminPassword,
  loadFixtures,
  loginAdmin,
} from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1728, height: 1117 },
  { name: "fhd", width: 1920, height: 1080 },
] as const;

const SMOKE_ROUTES = [
  "/admin",
  "/admin/organizations",
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
  "/admin/customers",
] as const;

async function assertNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe("admin wide layout", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  test.beforeEach(async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");
    await loginAdmin(page, email!, password);
  });

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow @ ${viewport.name} (${viewport.width})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/admin/support");
      await expect(page.locator(".admin-shell")).toBeVisible();
      await assertNoDocumentOverflow(page);
    });
  }

  test("desktop sidebar width and content fills wide viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.locator(".admin-shell")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const aside = document.querySelector(".admin-body > aside");
      const content = document.querySelector(".admin-content");
      const shell = document.querySelector(".admin-shell");
      if (!aside || !content || !shell) return null;
      const asideRect = aside.getBoundingClientRect();
      return {
        asideWidth: asideRect.width,
        contentWidth: content.getBoundingClientRect().width,
        shellWidth: shell.getBoundingClientRect().width,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.asideWidth).toBeGreaterThanOrEqual(248);
    expect(metrics!.asideWidth).toBeLessThanOrEqual(272);
    expect(metrics!.contentWidth).toBeGreaterThan(900);
  });

  test("table shell fills content column on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 });
    await page.goto("/admin/support");

    const widths = await page.evaluate(() => {
      const content = document.querySelector(".admin-content");
      const tableShell = document.querySelector(".admin-content [class*='overflow-x-auto']");
      if (!content || !tableShell) return null;
      return {
        content: content.getBoundingClientRect().width,
        table: tableShell.getBoundingClientRect().width,
      };
    });

    if (!widths) {
      test.skip(true, "demo table shell not present (empty support CRM)");
      return;
    }

    expect(widths.table).toBeGreaterThan(widths.content * 0.85);
  });

  test("mobile drawer opens, closes, and responds to Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");

    const openButton = page.getByRole("button", { name: "Menüyü aç" });
    await expect(openButton).toBeVisible();
    await openButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await openButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Menüyü kapat" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("protected admin routes smoke without crash", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const path of SMOKE_ROUTES) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/").replace(/\?.*$/, "") + "/?$"));
      await expect(page.locator("body")).not.toContainText(/Unexpected Application Error/i);
      await expect(page.locator(".admin-shell")).toBeVisible();
      await assertNoDocumentOverflow(page);
    }
  });
});
