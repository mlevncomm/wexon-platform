import { expect, test } from "@playwright/test";
import { classifyE2EDatabase } from "./lead-isolation";
import { loadFixtures } from "./helpers";

const fixtures = loadFixtures();
const dbClass = classifyE2EDatabase();
const mutationAllowed =
  dbClass === "local" ||
  (dbClass === "preview" && process.env.WEXON_E2E_ALLOW_GUEST_MUTATION === "true");

function skipUnlessReady() {
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
  test.skip(!fixtures.fixturesReady, fixtures.setupError ?? "seed fixtures incomplete");
  test.skip(!fixtures.qrCode, "qrCode fixture required");
}

function skipUnlessMutation() {
  skipUnlessReady();
  test.skip(
    !mutationAllowed,
    `legacy mutation skipped on ${dbClass}; use test:e2e:wexpay-guest with isolated DB`,
  );
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("QR customer order experience", () => {
  test("invalid QR shows error state", async ({ page }) => {
    await page.goto("/wexpay/t/UNKNOWN-QR-CODE-404");
    await expect(page.getByRole("heading", { name: /QR geçersiz/i })).toBeVisible();
  });

  test("landing opens with browse and bill CTAs", async ({ page }) => {
    skipUnlessReady();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await expect(page.getByTestId("qr-cta-order")).toBeVisible();
    await expect(page.getByTestId("qr-cta-order")).toContainText(/Menüyü İncele/i);
    await expect(page.getByTestId("qr-cta-pay")).toBeVisible();
    await expect(page.getByText(/Masaya hoş geldiniz/i)).toBeVisible();
  });

  test("order flow: menu, note, cart, submit success", async ({ page }) => {
    skipUnlessMutation();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-order").click();
    await expect(page.getByTestId("qr-menu-screen")).toBeVisible();

    const firstQuickAdd = page.locator("[data-testid^='qr-quick-add-']").first();
    await expect(firstQuickAdd).toBeVisible();

    const productCard = page.locator("[data-testid^='qr-quick-add-']").first().locator("xpath=ancestor::article");
    await productCard.getByRole("button").first().click();

    if (await page.getByTestId("qr-product-note").isVisible().catch(() => false)) {
      await page.getByTestId("qr-product-note").fill("Az acılı");
      await expect(page.locator("[data-testid^='qr-option-']")).toHaveCount(0);
      await page.getByTestId("qr-add-to-cart").click();
    } else {
      await firstQuickAdd.click();
    }

    await page.getByTestId("qr-cart-continue").click();
    await expect(page.getByTestId("qr-cart-subtotal")).toBeVisible();
    await page.getByTestId("qr-submit-order").click();
    await expect(page.getByTestId("qr-order-success")).toBeVisible({ timeout: 20_000 });
  });

  test("pay CTA opens bill with in-restaurant payment copy", async ({ page }) => {
    skipUnlessReady();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-pay").click();
    await expect(page.getByTestId("qr-bill-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("qr-pay-in-restaurant")).toBeVisible();
  });

  test("waiter call success state", async ({ page }) => {
    skipUnlessMutation();
    await page.goto(`/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`);
    await page.getByTestId("qr-cta-waiter").click();
    await page.getByTestId("qr-waiter-submit").click();
    await expect(page.getByText(/Garson çağrınız restorana iletildi/i)).toBeVisible({ timeout: 15_000 });
  });
});
