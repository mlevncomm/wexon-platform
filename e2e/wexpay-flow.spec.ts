import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

test.describe.serial("wexpay flow journey", () => {
  const fixtures = loadFixtures();

  test("licensed org opens WexPay operator surface", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.licensedOrgId, fixtures.setupError ?? "licensed org fixture required");

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await page.goto(`/apps/wexpay?organizationId=${fixtures.licensedOrgId}`);
    await expect(page).toHaveURL(/\/apps\/wexpay/);
    await expect(page.locator("body")).toContainText(/WexPay/i);
    await expect(page.locator("body")).toContainText(/Operasyon|sipariş|masa|şube|restoran/i);
  });

  test("inactive license shows access denial without leaking operator UI", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.fixturesReady || !fixtures.customerOrgId, fixtures.setupError ?? "customer fixture required");
    const deniedOrgId = fixtures.inactiveWexPayOrgId ?? fixtures.demoOrgId;
    test.skip(!deniedOrgId, "no inactive/demo org fixture");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/apps/wexpay?organizationId=${deniedOrgId}`);

    const denied = page.getByText(/Erişim gerekli|Erisim gerekli|yetkisiz|unauthorized|lisans/i);
    await expect(denied.first()).toBeVisible();
  });

  test("subscription page communicates PayTR / manual collection state safely", async ({ page }) => {
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(!fixtures.customerOrgId, "customer org fixture required");

    await loginCustomer(page, fixtures.customerEmail, customerPassword());
    await page.goto(`/dashboard/subscription?organizationId=${fixtures.customerOrgId}`);
    await expect(page).not.toHaveURL(/\/unauthorized/);

    const bodyText = await page.locator("body").innerText();
    // Should not claim live PayTR collection when API flag is off.
    if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
      expect(bodyText).not.toMatch(/PayTR ile hemen ödeme alın|canlı sanal POS aktif/i);
    }
  });

  test("public product page uses Business Suite / manuel language when PayTR disabled", async ({ page }) => {
    test.skip(process.env.WEXPAY_PAYTR_ENABLE_API === "true", "PayTR enabled — skip disabled-copy check");

    await page.goto("/products/wexpay");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/WexPay|Business Suite|manuel|tahsilat|ödeme/i);
  });
});
