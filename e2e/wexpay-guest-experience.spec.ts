import { expect, test, type Page } from "@playwright/test";
import { classifyE2EDatabase } from "./lead-isolation";
import { loadFixtures } from "./helpers";

/**
 * Guest QR experience — default suite is read-only on shared remote.
 * Mutation flows are hard-blocked outside isolated local/preview fixture DBs.
 */

const fixtures = loadFixtures();
const dbClass = classifyE2EDatabase();
const sharedRemote = dbClass === "shared remote-unverified" || dbClass === "production-confirmed";
const mutationAllowed =
  !sharedRemote &&
  dbClass !== "missing-db" &&
  process.env.WEXON_E2E_ALLOW_GUEST_MUTATION === "true";

function skipUnlessLicensedFixture() {
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
  test.skip(
    !fixtures.fixturesReady || !fixtures.qrCode,
    fixtures.setupError ?? "licensed qr fixture required",
  );
}

function skipUnlessMutationAllowed() {
  skipUnlessLicensedFixture();
  test.skip(
    !mutationAllowed,
    `guest mutation blocked (${dbClass}). Set isolated local/preview + WEXON_E2E_ALLOW_GUEST_MUTATION=true`,
  );
}

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

async function assertNoSecrets(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/riskReasons/i);
  expect(body).not.toMatch(/organizationId/i);
  expect(body).not.toMatch(/merchant_key|PAYTR_MERCHANT|API[_-]?KEY/i);
  expect(body).not.toMatch(/provider.?hash|providerReference/i);
}

test.describe("wexpay guest — read-only", () => {
  test("invalid QR shows error state", async ({ page }) => {
    await page.goto("/wexpay/t/UNKNOWN-QR-CODE-404");
    await expect(page.getByRole("heading", { name: /QR geçersiz/i })).toBeVisible();
    await assertNoSecrets(page);
  });

  test("landing CTAs and restaurant identity when fixture exists", async ({ page }) => {
    skipUnlessLicensedFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await expect(page.getByTestId("qr-cta-order")).toBeVisible();
    await expect(page.getByTestId("qr-cta-order")).toContainText(/Menüyü İncele/i);
    await expect(page.getByTestId("qr-cta-pay")).toBeVisible();
    await expect(page.getByTestId("qr-cta-waiter")).toBeVisible();
    await expect(page.getByText(/Masaya hoş geldiniz/i)).toBeVisible();
    await assertNoSecrets(page);
  });

  test("responsive shell has no horizontal overflow", async ({ page }) => {
    const path = fixtures.fixturesReady && fixtures.qrCode
      ? `/wexpay/t/${encodeURIComponent(fixtures.qrCode)}`
      : "/wexpay/t/UNKNOWN-QR-CODE-404";

    for (const width of [360, 390, 430, 768, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, `width ${width}`).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }
  });

  test("menu discovery: search, sheet open/close, no mock modifiers", async ({ page }) => {
    skipUnlessLicensedFixture();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-order").click();
    await expect(page.getByTestId("qr-menu-screen")).toBeVisible();
    await expect(page.getByTestId("qr-menu-search")).toBeVisible();

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/servise hazır/i);
    expect(body).not.toMatch(/Online ödeme yakında/i);
    expect(await page.locator("[data-testid^='qr-option-']").count()).toBe(0);

    const productOpen = page.locator("[data-testid^='qr-quick-add-']").first().locator("xpath=ancestor::article");
    if (await productOpen.count()) {
      await productOpen.getByRole("button").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByTestId("qr-product-note")).toBeVisible();
      await expect(page.getByText(/Sipariş notu/i).first()).toBeVisible();
      await expect(page.locator("[data-testid^='qr-option-']")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  test("bill screen honest payment-request copy (GET only)", async ({ page }) => {
    skipUnlessLicensedFixture();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-pay").click();
    await expect(page.getByTestId("qr-bill-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("qr-pay-in-restaurant")).toBeVisible();
    const text = await page.getByTestId("qr-bill-screen").innerText();
    expect(text).toMatch(/Ödeme restoranda alınır|bildirim|tahsilat/i);
    expect(text).not.toMatch(/Online ödeme yakında/i);
    expect(text).not.toMatch(/ödeme tamamlandı|ödeme alındı/i);
    await assertNoSecrets(page);
  });

  test("cart remains localStorage scoped by qrCode", async ({ page }) => {
    skipUnlessLicensedFixture();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-order").click();
    const quick = page.locator("[data-testid^='qr-quick-add-']").first();
    if (!(await quick.count())) {
      test.skip(true, "no menu products on fixture");
    }
    await quick.click();
    const stored = await page.evaluate((qr) => {
      const key = `wexon:qr-cart:${qr}`;
      return window.localStorage.getItem(key);
    }, fixtures.qrCode!);
    expect(stored).toBeTruthy();
    expect(stored).toMatch(/product/);
    expect(stored).not.toMatch(/priceDelta|selectedOptions/);
  });
});

test.describe("wexpay guest — isolated mutation only", () => {
  test("order submit + status labels without READY fiction", async ({ page }) => {
    skipUnlessMutationAllowed();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-order").click();
    const quick = page.locator("[data-testid^='qr-quick-add-']").first();
    await quick.click();
    await page.getByTestId("qr-cart-continue").click();
    await page.getByTestId("qr-submit-order").click();
    await expect(page.getByTestId("qr-order-success")).toBeVisible({ timeout: 20_000 });
    const successText = await page.locator("body").innerText();
    expect(successText).not.toMatch(/servise hazır|READY/i);
    expect(successText).toMatch(/Sipariş alındı|Hazırlanıyor|Servis edildi|İptal/i);
    await page.getByTestId("qr-new-order").click();
    await expect(page.getByTestId("qr-menu-screen")).toBeVisible();
  });

  test("waiter call success copy is notification-only", async ({ page }) => {
    skipUnlessMutationAllowed();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-waiter").click();
    await page.getByTestId("qr-waiter-submit").click();
    await expect(page.getByTestId("qr-waiter-success")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Garson çağrınız restorana iletildi/i)).toBeVisible();
    const text = await page.getByTestId("qr-waiter-success").innerText();
    expect(text).not.toMatch(/geliyor|kabul edildi|çözüldü/i);
  });
});
