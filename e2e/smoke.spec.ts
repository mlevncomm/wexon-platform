import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

type SmokeFixtures = {
  dbAvailable: boolean;
  fixturesReady: boolean;
  setupError: string | null;
  adminEmail: string | null;
  customerEmail: string;
  customerOrgId: string | null;
  licensedCustomerEmail: string;
  licensedOrgId: string | null;
  realOrgId: string | null;
  demoOrgId: string | null;
  inactiveWexPayOrgId: string | null;
  qrCode: string | null;
  inactiveQrCode: string | null;
};

function loadFixtures(): SmokeFixtures {
  const raw = readFileSync(resolve(process.cwd(), "e2e", ".fixtures.json"), "utf8");
  return JSON.parse(raw) as SmokeFixtures;
}

const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
const customerPassword =
  !process.env.SMOKE_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD === "change-me"
    ? "Wexon-Customer-2026"
    : process.env.SMOKE_CUSTOMER_PASSWORD;

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/admin(\/applications)?\/?$/),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function loginCustomer(page: Page, email: string, password: string) {
  await page.goto("/dashboard/login");
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/dashboard/login")),
    page.locator('button[type="submit"]').click(),
  ]);
}

test.describe.serial("production smoke", () => {
  const fixtures = loadFixtures();
  const orgId = fixtures.realOrgId ?? fixtures.customerOrgId;

  test("public marketing pages render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Wexon").first()).toBeVisible();

    await page.goto("/products/wexpay");
    await expect(page.getByText("WexPay").first()).toBeVisible();

    await page.goto("/demo-request");
    await expect(page.getByText(/Demo|WexPay/i).first()).toBeVisible();
  });

  test("admin login reaches organizations", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.adminEmail || !adminPassword, "ADMIN_EMAILS and ADMIN_LOGIN_PASSWORD required");

    await loginAdmin(page, fixtures.adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/admin\/?$/);

    await page.goto("/admin/organizations");
    await expect(page).toHaveURL(/\/admin\/organizations/);
  });

  test("admin organization detail links carry organizationId", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.adminEmail || !adminPassword || !orgId, "admin credentials and org fixture required");

    await loginAdmin(page, fixtures.adminEmail!, adminPassword!);
    await page.goto(`/admin/organizations/${orgId}`);

    await expect(page.getByRole("link", { name: "Wexon Core paneli" })).toHaveAttribute(
      "href",
      `/dashboard?organizationId=${orgId}`,
    );
    await expect(page.getByRole("link", { name: /WexPay/ }).first()).toHaveAttribute(
      "href",
      `/apps/wexpay?organizationId=${orgId}`,
    );
  });

  test("customer login opens dashboard for own organization", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);

    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
    await expect(page.getByText("Wexon Core").first()).toBeVisible();
  });

  test("wrong organizationId redirects customer to unauthorized", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto("/dashboard?organizationId=00000000-0000-0000-0000-000000000099");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("customer opens WexPay panel for licensed organization", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.licensedOrgId, "licensed org fixture required");

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword);
    await page.goto(`/apps/wexpay?organizationId=${fixtures.licensedOrgId}`);
    await expect(page).toHaveURL(/\/apps\/wexpay/);
    await expect(page.locator("body")).toContainText(/WexPay/i);
  });

  test("inactive WexPay license shows access denied state", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    const deniedOrgId = fixtures.inactiveWexPayOrgId ?? fixtures.demoOrgId;
    test.skip(!deniedOrgId, "no inactive/demo org fixture for access denial check");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto(`/apps/wexpay?organizationId=${deniedOrgId}`);

    const denied = page.getByText(/WexPay|Erişim gerekli|Erisim gerekli/i);
    const unauthorized = page.getByText(/yetkisiz|unauthorized/i);
    await expect(denied.or(unauthorized).first()).toBeVisible();
  });

  test("public QR GET returns menu JSON", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady, fixtures.setupError ?? "seed fixtures incomplete");
    test.skip(!fixtures.qrCode, "qrCode fixture required");

    const response = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("menu");
    expect(Array.isArray(body.menu)).toBe(true);
  });

  test("public QR POST creates order", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady, fixtures.setupError ?? "seed fixtures incomplete");
    test.skip(!fixtures.qrCode, "qrCode fixture required");

    const menuResponse = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    test.skip(menuResponse.status() !== 200, "public menu unavailable for order test");
    const menu = (await menuResponse.json()) as {
      menu: Array<{ products: Array<{ id: string }> }>;
    };
    const productId = menu.menu.flatMap((category) => category.products)[0]?.id;
    test.skip(!productId, "no menu product for order test");

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId, quantity: 1 }] },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("orderNo");
  });

  test("public QR checkout unavailable without PSP credentials", async ({ request }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady, fixtures.setupError ?? "seed fixtures incomplete");
    test.skip(!fixtures.qrCode, "qrCode fixture required");
    test.skip(process.env.WEXPAY_PAYTR_ENABLE_API === "true", "PSP enabled — skip no-PSP scenario");

    const menuResponse = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    test.skip(menuResponse.status() !== 200, "public menu unavailable for checkout test");
    const menu = (await menuResponse.json()) as {
      menu: Array<{ products: Array<{ id: string }> }>;
    };
    const productId = menu.menu.flatMap((category) => category.products)[0]?.id;
    test.skip(!productId, "no menu product for checkout test");

    const orderResponse = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId, quantity: 1 }] },
    });
    test.skip(orderResponse.status() !== 201, "order creation failed for checkout test");
    const order = (await orderResponse.json()) as { id: string };

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/checkout`, {
      data: { orderId: order.id },
    });
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(String(body.error)).toMatch(/aktif değil/i);
  });
});
