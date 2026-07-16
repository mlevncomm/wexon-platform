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

    // Desktop: sidebar keeps a fixed rail and content uses the majority of the screen.
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
      // Content should use the majority of the viewport after the sidebar rail.
      expect(contentBox!.width, `content at ${width}`).toBeGreaterThan(width * 0.6);
      // And should not be capped far below the available area (no huge empty margins).
      const rightEdge = contentBox!.x + contentBox!.width;
      expect(width - rightEdge, `right gutter at ${width}`).toBeLessThanOrEqual(120);
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

    // Table-heavy pages stay usable wide: header row visible, no page-level overflow.
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
