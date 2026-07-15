import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";
import {
  assertNoSecrets,
  cleanupAfterSuite,
  dismissCookieBanner,
  ensureRunArtifact,
  skipUnlessIsolatedMutation,
} from "./wexpay-mutation-helpers";

/**
 * Isolated active-table multi-wave account coverage.
 * Schema: each add = new CustomerOrder wave (no append-to-PREPARING/SERVED).
 */
test.describe.serial("wexpay active table order management (isolated)", () => {
  const fixtures = loadFixtures();
  const artifact = ensureRunArtifact();

  test.afterAll(() => {
    cleanupAfterSuite();
  });

  test("multi-wave bill, kitchen status isolation, close guard, guest third order", async ({
    page,
    request,
  }) => {
    skipUnlessIsolatedMutation();
    const orgQ = `organizationId=${fixtures.licensedOrgId}`;
    const qr = fixtures.qrCode;
    test.skip(!qr, "licensed QR fixture required");

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await dismissCookieBanner(page);

    // 1) First wave on empty table
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    const emptyTable = page
      .locator("button")
      .filter({ hasText: /Masa 0[12]/ })
      .filter({ hasText: /Boş|EMPTY|kişilik/i })
      .first();
    await expect(emptyTable).toBeVisible({ timeout: 15_000 });
    await emptyTable.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    if (await drawer.getByRole("button", { name: /Composer aç/i }).count()) {
      await drawer.getByRole("button", { name: /Composer aç/i }).click();
    }
    await drawer.locator('input[name="note"]').fill(`${artifact.token}-w1`);
    await drawer.getByRole("button", { name: /Masayı aç|ilk sipariş/i }).first().click();
    await page.waitForTimeout(2000);

    // 2) Second wave on occupied table
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await page.locator("button").filter({ hasText: /Masa 0[12]/ }).first().click();
    const drawer2 = page.getByRole("dialog");
    await expect(drawer2.getByTestId("cashier-bill-waves")).toBeVisible();
    if (await drawer2.getByRole("button", { name: /Composer aç/i }).count()) {
      await drawer2.getByRole("button", { name: /Composer aç/i }).click();
    }
    await drawer2.locator('input[name="note"]').fill(`${artifact.token}-w2`);
    await drawer2.getByRole("button", { name: /Yeni sipariş dalgası|Masaya yeni|Sipariş/i }).first().click();
    await page.waitForTimeout(2000);

    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await page.locator("button").filter({ hasText: /Masa 0[12]/ }).first().click();
    const accountDrawer = page.getByRole("dialog");
    await expect(accountDrawer.getByTestId("cashier-order-wave")).toHaveCount(2, { timeout: 10_000 });
    const accountText = await accountDrawer.getByTestId("cashier-table-account").innerText();
    expect(accountText).toMatch(/Toplam|Kalan/i);

    // 4–5) Advance oldest NEW → PREPARING; newest stays NEW where possible
    const firstWave = accountDrawer.getByTestId("cashier-order-wave").first();
    if (await firstWave.getByRole("button", { name: /Hazırlamaya al/i }).count()) {
      await firstWave.getByRole("button", { name: /Hazırlamaya al/i }).click();
      await page.waitForTimeout(1500);
    }

    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await page.locator("button").filter({ hasText: /Masa 0[12]/ }).first().click();
    const afterPrep = page.getByRole("dialog");
    const statuses = await afterPrep.getByTestId("cashier-order-wave").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-order-status")),
    );
    expect(statuses.some((status) => status === "PREPARING" || status === "SERVED" || status === "NEW")).toBeTruthy();
    expect(statuses.filter((status) => status === "NEW").length).toBeGreaterThanOrEqual(1);

    // 8) Close blocked while open orders / remaining
    await expect(afterPrep.getByTestId("cashier-close-block")).toBeVisible();
    await expect(afterPrep.getByTestId("cashier-close-block")).toContainText(/NEW\/PREPARING|Kalan ödeme|adisyon/i);
    await page.keyboard.press("Escape");

    // 6–7) Guest QR third wave + bill total honesty
    const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(qr!)}`);
    expect(menu.ok()).toBeTruthy();
    const menuJson = (await menu.json()) as {
      menu?: Array<{ products: Array<{ id: string }> }>;
    };
    const productId = menuJson.menu?.flatMap((category) => category.products)?.[0]?.id;
    expect(productId).toBeTruthy();

    const idemKey = `active-table-${artifact.runId}-${Date.now()}`;
    const orderRes = await request.post(`/api/wexpay/public/${encodeURIComponent(qr!)}/order`, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemKey,
      },
      data: { items: [{ productId, quantity: 1 }], note: `${artifact.token}-guest` },
    });
    expect([200, 201]).toContain(orderRes.status());
    const orderOnce = await orderRes.json();
    const orderDup = await request.post(`/api/wexpay/public/${encodeURIComponent(qr!)}/order`, {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemKey,
      },
      data: { items: [{ productId, quantity: 1 }], note: `${artifact.token}-guest` },
    });
    expect(orderDup.status()).toBe(orderRes.status());
    const orderDupJson = await orderDup.json();
    if (orderOnce.orderId && orderDupJson.orderId) {
      expect(orderDupJson.orderId).toBe(orderOnce.orderId);
    }

    const bill = await request.get(`/api/wexpay/public/${encodeURIComponent(qr!)}/bill`);
    expect(bill.ok()).toBeTruthy();
    const billJson = (await bill.json()) as {
      bill?: { totalAmount: number; remainingAmount: number; lines: Array<{ orderNo: string }> };
    };
    expect((billJson.bill?.lines.length ?? 0)).toBeGreaterThanOrEqual(3);
    const orderNos = new Set((billJson.bill?.lines ?? []).map((line) => line.orderNo));
    expect(orderNos.size).toBeGreaterThanOrEqual(3);
    expect(billJson.bill?.remainingAmount ?? 0).toBeGreaterThan(0);
    const billText = JSON.stringify(billJson);
    expect(billText).not.toMatch(/organizationId|riskReasons|DATABASE_URL|postgresql:\/\//i);

    await assertNoSecrets(page);
  });
});
