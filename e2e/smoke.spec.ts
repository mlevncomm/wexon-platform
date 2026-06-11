import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

type SmokeFixtures = {
  adminEmail: string | null;
  customerEmail: string;
  customerOrgId: string | null;
  licensedCustomerEmail: string;
  licensedOrgId: string | null;
  realOrgId: string | null;
  demoOrgId: string | null;
  inactiveWexPayOrgId: string | null;
  qrCode: string | null;
};

function loadFixtures(): SmokeFixtures {
  const raw = readFileSync(resolve(process.cwd(), "e2e", ".fixtures.json"), "utf8");
  return JSON.parse(raw) as SmokeFixtures;
}

const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
const customerPassword = process.env.SMOKE_CUSTOMER_PASSWORD ?? "Wexon-Customer-2026";

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/admin\/?$/),
    page.getByRole("button", { name: "Giriş yap" }).click(),
  ]);
}

async function loginCustomer(page: Page, email: string, password: string) {
  await page.goto("/dashboard/login");
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/dashboard/login")),
    page.getByRole("button", { name: "Giriş yap" }).click(),
  ]);
}

test.describe.serial("production smoke", () => {
  const fixtures = loadFixtures();
  const orgId = fixtures.realOrgId ?? fixtures.customerOrgId;

  test("admin login reaches organizations", async ({ page }) => {
    test.skip(!fixtures.adminEmail || !adminPassword, "ADMIN_EMAILS and ADMIN_LOGIN_PASSWORD required");

    await loginAdmin(page, fixtures.adminEmail!, adminPassword!);
    await expect(page.getByRole("heading", { name: /Müşteri yönetimini buradan başlatın/i })).toBeVisible();

    await page.getByRole("link", { name: /Müşterileri görüntüle/i }).click();
    await expect(page).toHaveURL(/\/admin\/organizations/);
  });

  test("admin organization detail links carry organizationId", async ({ page }) => {
    test.skip(!fixtures.adminEmail || !adminPassword || !orgId, "admin credentials and org fixture required");

    await loginAdmin(page, fixtures.adminEmail!, adminPassword!);
    await page.goto(`/admin/organizations/${orgId}`);

    const coreLink = page.getByRole("link", { name: "Wexon Core paneli" });
    const wexpayLink = page.getByRole("link", { name: "WexPay operasyonları" });

    await expect(coreLink).toHaveAttribute("href", `/dashboard?organizationId=${orgId}`);
    await expect(wexpayLink).toHaveAttribute("href", `/apps/wexpay?organizationId=${orgId}`);
  });

  test("customer login opens dashboard for own organization", async ({ page }) => {
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto(`/dashboard?organizationId=${fixtures.customerOrgId}`);

    await expect(page).toHaveURL(new RegExp(`organizationId=${fixtures.customerOrgId}`));
    await expect(page.getByText("Wexon Core").first()).toBeVisible();
  });

  test("wrong organizationId redirects customer to unauthorized", async ({ page }) => {
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto("/dashboard?organizationId=00000000-0000-0000-0000-000000000099");
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test("customer opens WexPay panel for licensed organization", async ({ page }) => {
    test.skip(!fixtures.licensedOrgId, "licensed org fixture required");

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword);
    await page.goto(`/apps/wexpay?organizationId=${fixtures.licensedOrgId}`);
    await expect(page.getByText(/operasyon merkezi|WexPay İşletme Paneli/i).first()).toBeVisible();
  });

  test("inactive WexPay license shows access denied state", async ({ page }) => {
    const deniedOrgId = fixtures.inactiveWexPayOrgId ?? fixtures.demoOrgId;
    test.skip(!deniedOrgId, "no inactive/demo org fixture for access denial check");

    await loginCustomer(page, fixtures.customerEmail, customerPassword);
    await page.goto(`/apps/wexpay?organizationId=${deniedOrgId}`);

    const denied = page.getByText(/WexPay erişiminiz aktif değil|Erişim gerekli/i);
    const unauthorized = page.getByText(/yetkisiz|unauthorized/i);
    await expect(denied.or(unauthorized).first()).toBeVisible();
  });

  test("public QR GET returns menu JSON", async ({ request }) => {
    test.skip(!fixtures.qrCode, "qrCode fixture required");

    const response = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("menu");
    expect(Array.isArray(body.menu)).toBe(true);
  });

  test("public QR POST creates order", async ({ request }) => {
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
});
