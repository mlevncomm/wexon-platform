import { expect, test, type Page } from "@playwright/test";
import { adminEmailFromEnv, adminPassword, loadFixtures, loginAdmin } from "./helpers";

const ADMIN_ROUTES = [
  "",
  "organizations",
  "users",
  "applications",
  "support",
  "licenses",
  "billing",
  "audit-logs",
  "settings",
  "products",
  "plans",
  "plans/wexpay-migration",
  "subscriptions",
  "integrations",
  "customers",
] as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1728, height: 1117 },
  { width: 1920, height: 1080 },
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

test.describe.serial("admin wide workspace", () => {
  const fixtures = loadFixtures();
  const password = adminPassword();

  test("responsive shell, wide content, routes, and overflow safety", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const email = adminEmailFromEnv(fixtures);
    test.skip(!email || !password, "admin credentials required");

    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await loginAdmin(page, email!, password);

    // No horizontal overflow at any target viewport on the admin home.
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/admin");
      await expect(page.locator(".admin-shell")).toBeVisible();
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, `viewport ${viewport.width}`).toBeLessThanOrEqual(
        overflow.clientWidth + 2,
      );
    }

    // Desktop: exact 15px symmetry — edge / sidebar / 15px / content / 15px / edge.
    for (const width of [1440, 1728, 1920] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin");

      const sidebar = page.locator(".admin-body > aside");
      await expect(sidebar).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox).toBeTruthy();
      expect(sidebarBox!.width).toBeGreaterThanOrEqual(248);
      expect(sidebarBox!.width).toBeLessThanOrEqual(272);

      const content = page.locator(".admin-content");
      const contentBox = await content.boundingBox();
      expect(contentBox).toBeTruthy();

      // Use layout width so a classic scrollbar cannot skew the right-gap math.
      const layoutWidth = await page.evaluate(() => document.documentElement.clientWidth);

      const leftOuterGap = sidebarBox!.x;
      const contentGap = contentBox!.x - (sidebarBox!.x + sidebarBox!.width);
      const rightOuterGap = layoutWidth - (contentBox!.x + contentBox!.width);

      expect(leftOuterGap, `left outer gap at ${width}`).toBeGreaterThanOrEqual(14);
      expect(leftOuterGap, `left outer gap at ${width}`).toBeLessThanOrEqual(16);
      expect(contentGap, `sidebar-content gap at ${width}`).toBeGreaterThanOrEqual(14);
      expect(contentGap, `sidebar-content gap at ${width}`).toBeLessThanOrEqual(16);
      expect(rightOuterGap, `right outer gap at ${width}`).toBeGreaterThanOrEqual(14);
      expect(rightOuterGap, `right outer gap at ${width}`).toBeLessThanOrEqual(16);

      // Content occupies the entire remaining area after the rail + 3 × 15px gaps.
      const expectedContentWidth = layoutWidth - sidebarBox!.width - 45;
      expect(Math.abs(contentBox!.width - expectedContentWidth), `content width at ${width}`).toBeLessThanOrEqual(3);
    }

    // Mobile: nav collapses into the toggle button; menu opens and closes.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    const navToggle = page.locator("aside button[aria-expanded]").first();
    await expect(navToggle).toBeVisible();
    await navToggle.click();
    await expect(navToggle).toHaveAttribute("aria-expanded", "true");
    await navToggle.click();
    await expect(navToggle).toHaveAttribute("aria-expanded", "false");

    // Every admin route renders inside the shell without auth redirect regressions.
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of ADMIN_ROUTES) {
      const path = route ? `/admin/${route}` : "/admin";
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/(admin\/login|login|unauthorized)/);
      await expect(page.locator(".admin-shell")).toBeVisible();
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, `route ${path}`).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }

    // Table-heavy pages stay usable wide: header row visible, no page-level overflow,
    // and no inner horizontal scroll inside table shells at ≥1440px.
    for (const tableRoute of [
      "/admin/users",
      "/admin/licenses",
      "/admin/subscriptions",
      "/admin/billing",
      "/admin/integrations",
      "/admin/support",
      "/admin/audit-logs",
    ]) {
      await page.goto(tableRoute);
      const innerTableScroll = await page.evaluate(() => {
        const overflows = Array.from(document.querySelectorAll("table")).map((tableEl) => {
          const wrap = tableEl.closest("div[class*='overflow-x-auto']");
          return wrap ? wrap.scrollWidth - wrap.clientWidth : 0;
        });
        return Math.max(0, ...overflows);
      });
      expect(innerTableScroll, `inner table scroll on ${tableRoute} at 1440`).toBeLessThanOrEqual(1);
    }
    await page.goto("/admin/users");
    await expect(page.locator("table thead").first()).toBeVisible();

    const hydrationErrors = consoleErrors.filter((text) => /hydration|did not match/i.test(text));
    expect(hydrationErrors).toEqual([]);
  });

  test("logged-out admin routes still redirect to login", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    await page.goto("/admin/organizations");
    await expect(page).toHaveURL(/\/(admin\/login|login)/);
  });
});
