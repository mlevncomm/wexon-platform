import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";
import {
  assertNoSecrets,
  cleanupAfterSuite,
  dismissCookieBanner,
  ensureRunArtifact,
  measureOverflow,
  skipUnlessIsolatedMutation,
  trackIdempotencyKey,
  trackOrderId,
} from "./wexpay-mutation-helpers";

/**
 * Isolated-only Guest QR mutation coverage on /wexpay/t/[qrCode].
 * PayTR checkout is never exercised as a live charge.
 */
test.describe.serial("wexpay guest mutation (isolated)", () => {
  const fixtures = loadFixtures();
  const artifact = ensureRunArtifact();

  test.afterAll(() => {
    cleanupAfterSuite();
  });

  test("invalid QR + overflow baselines", async ({ page }) => {
    await page.goto("/wexpay/t/UNKNOWN-QR-CODE-404");
    await expect(page.getByRole("heading", { name: /QR geçersiz/i })).toBeVisible();
    await assertNoSecrets(page);

    for (const width of [360, 390, 430, 768, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/wexpay/t/UNKNOWN-QR-CODE-404");
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, `width ${width}`).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }
  });

  test("landing → menu → cart → idempotent submit → status poll → services", async ({ page, request, context }) => {
    skipUnlessIsolatedMutation();
    await page.setViewportSize({ width: 390, height: 844 });

    const qrPath = `/wexpay/t/${encodeURIComponent(fixtures.qrCode!)}`;
    await page.goto(qrPath);
    await dismissCookieBanner(page);
    await expect(page.getByTestId("qr-cta-order")).toBeVisible();
    await expect(page.getByText(/Masaya hoş geldiniz/i)).toBeVisible();
    await assertNoSecrets(page);

    await page.getByTestId("qr-cta-order").click();
    await expect(page.getByTestId("qr-menu-screen")).toBeVisible();
    await expect(page.getByTestId("qr-menu-search")).toBeVisible();

    const search = page.getByTestId("qr-menu-search");
    await search.fill("Izgara");
    await expect(page.getByText(/Izgara/i).first()).toBeVisible({ timeout: 10_000 });

    const categoryBtn = page.locator("[data-testid^='qr-category-'], button").filter({ hasText: /Ana|Hepsi|Yemek/i }).first();
    if (await categoryBtn.count()) {
      await categoryBtn.click();
    }

    const productCard = page.locator("article").filter({ hasText: /Izgara/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10_000 });
    await productCard.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("qr-product-note")).toBeVisible();

    // Optional modifier chips may render; pick none unless add-to-cart stays disabled.
    const addBtn = page.getByTestId("qr-add-to-cart");
    if (!(await addBtn.isEnabled())) {
      await page.locator("[data-testid^='qr-option-']").first().click();
    }

    const qtyPlus = page.getByRole("button", { name: /Adet arttır/i });
    if (await qtyPlus.count()) {
      await qtyPlus.click();
    }
    await page.getByTestId("qr-product-note").fill(artifact.note || artifact.token);
    await addBtn.click();

    await page.getByTestId("qr-cart-continue").click({ force: true });
    await expect(page.getByTestId("qr-cart-subtotal")).toBeVisible();

    const idemKey = `guest-mut-${artifact.runId}`;
    trackIdempotencyKey(`qr-order:${idemKey}`);

    // Install one-shot header injection for Idempotency-Key on order POST.
    await page.route(`**/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, async (route) => {
      const headers = {
        ...route.request().headers(),
        "idempotency-key": idemKey,
      };
      await route.continue({ headers });
    });

    const orderResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/order") && res.request().method() === "POST",
    );
    await page.getByTestId("qr-submit-order").click();
    // Double-click race — UI should not create duplicates when key is present.
    await page.getByTestId("qr-submit-order").click({ force: true }).catch(() => undefined);

    const orderResponse = await orderResponsePromise;
    expect(orderResponse.status()).toBe(201);
    const orderBody = (await orderResponse.json()) as { id?: string; orderId?: string; orderNo?: string; status?: string };
    const orderId = orderBody.orderId || orderBody.id;
    expect(orderId).toBeTruthy();
    if (orderId) trackOrderId(orderId);

    await expect(page.getByTestId("qr-order-success")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).toContainText(/Sipariş alındı|NEW|Hazırlanıyor|Servis/i);
    expect(await page.locator("body").innerText()).not.toMatch(/servise hazır|READY/i);

    // Replay idempotency via API (Izgara = optional modifiers, safe without option IDs)
    const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    const menuBody = (await menu.json()) as {
      menu: Array<{ products: Array<{ id: string; name: string }> }>;
    };
    const productId = menuBody.menu
      .flatMap((c) => c.products)
      .find((product) => /Izgara/i.test(product.name))?.id;
    expect(productId).toBeTruthy();
    const replay = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      headers: { "Idempotency-Key": idemKey },
      data: { items: [{ productId, quantity: 1 }], note: artifact.note || artifact.token },
    });
    expect(replay.status()).toBe(201);
    const replayBody = (await replay.json()) as { id?: string; orderId?: string };
    expect(replayBody.orderId || replayBody.id).toBe(orderId);

    // Staff advances NEW → PREPARING → SERVED via authenticated production API
    const staff = await context.newPage();
    await loginCustomer(staff, fixtures.licensedCustomerEmail, customerPassword());
    const prep = await staff.request.patch("/api/wexpay/orders", {
      data: { orderId, status: "PREPARING" },
    });
    expect(prep.ok()).toBeTruthy();
    const served = await staff.request.patch("/api/wexpay/orders", {
      data: { orderId, status: "SERVED" },
    });
    expect(served.ok()).toBeTruthy();
    await staff.close();

    await page.getByTestId("qr-track-order").click();
    await expect
      .poll(async () => page.locator("body").innerText(), { timeout: 30_000 })
      .toMatch(/Hazırlanıyor|Servis edildi|PREPARING|SERVED|Servis/i);

    // Hidden tab pauses polling (document.hidden early-return)
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await page.goto(qrPath);
    await page.getByTestId("qr-cta-waiter").click();
    await page.getByTestId("qr-waiter-submit").click();
    await expect(page.getByTestId("qr-waiter-success")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Garson çağrınız restorana iletildi/i)).toBeVisible();

    await page.goto(qrPath);
    await page.getByTestId("qr-cta-pay").click();
    await expect(page.getByTestId("qr-bill-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("qr-pay-in-restaurant")).toBeVisible();
    await page.getByTestId("qr-payment-request").click();
    const payResPromise = page.waitForResponse(
      (res) => res.url().includes("payment-request") && res.request().method() === "POST",
    );
    await page.getByTestId("qr-payment-request-confirm").click();
    const payRes = await payResPromise;
    expect(payRes.status()).toBe(201);
    const payBody = (await payRes.json()) as { charged?: boolean };
    expect(payBody.charged).toBe(false);
    await expect(page.getByTestId("qr-payment-request-success")).toBeVisible({ timeout: 15_000 });
    const billText = await page.getByTestId("qr-bill-screen").innerText();
    expect(billText).toMatch(/Ödeme restoranda|bildirim|tahsilat|talep/i);
    expect(billText).not.toMatch(/Online ödeme yakında|ödeme tamamlandı/i);
    await assertNoSecrets(page);
  });
});
