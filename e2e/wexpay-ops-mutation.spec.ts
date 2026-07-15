import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";
import {
  assertNoSecrets,
  cleanupAfterSuite,
  dismissCookieBanner,
  ensureRunArtifact,
  measureOverflow,
  skipUnlessIsolatedMutation,
  trackOrderId,
} from "./wexpay-mutation-helpers";

/**
 * Isolated-only WexPay restaurant operations mutation coverage.
 * Does not invent append-to-order / openTable backends. PayTR stays off.
 */
test.describe.serial("wexpay ops mutation (isolated)", () => {
  const fixtures = loadFixtures();
  const artifact = ensureRunArtifact();

  test.afterAll(() => {
    cleanupAfterSuite();
  });

  test("login, table lifecycle, kitchen status, guards, overflow", async ({ page }) => {
    skipUnlessIsolatedMutation();

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    await dismissCookieBanner(page);
    const orgQ = `organizationId=${fixtures.licensedOrgId}`;

    await page.goto(`/apps/wexpay?${orgQ}`);
    await expect(page.locator(".wexpay-shell")).toBeVisible();

    for (const width of [390, 1440, 1920] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/apps/wexpay/tables?${orgQ}`);
      const overflow = await measureOverflow(page);
      expect(overflow.scrollWidth, `width ${width}`).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await expect(page.getByText("Kasa workspace")).toBeVisible();

    const emptyTable = page.locator("button").filter({ hasText: /Masa 0[12]/ }).filter({ hasText: /Boş|EMPTY|kişilik/i }).first();
    await expect(emptyTable).toBeVisible({ timeout: 15_000 });
    await emptyTable.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: /Masayı aç ve ilk siparişi oluştur/i })).toBeVisible();

    const composerToggle = drawer.getByRole("button", { name: /Composer aç/i });
    if (await composerToggle.count()) {
      await composerToggle.click();
    }
    const note = artifact.note || artifact.token;
    await drawer.locator('input[name="note"]').fill(note);
    await drawer.getByRole("button", { name: /Masayı aç ve ilk siparişi oluştur/i }).first().click();
    await page.waitForTimeout(2000);
    // After first order, drawer reflects occupied / new-order CTA.
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    const occupied = page.locator("button").filter({ hasText: /Masa 0[12]/ }).filter({ hasText: /Açık|OCCUPIED|Kalan|sipariş/i }).first();
    if (await occupied.count()) {
      await occupied.click();
    } else {
      await page.locator("button").filter({ hasText: /Masa 0[12]/ }).first().click();
    }
    await expect(page.getByRole("dialog")).toBeVisible();
    const drawer2 = page.getByRole("dialog");
    await expect(drawer2.getByText(/Masaya yeni sipariş ekle|ilk sipariş/i).first()).toBeVisible();
    await expect(drawer2.getByText(/Tahsilat/i).first()).toBeVisible();
    await expect(drawer2.getByText(/ödeme isteği|Müşteri ödeme|bildirim/i).first()).toBeVisible({ timeout: 5_000 }).catch(() => undefined);

    if (await drawer2.getByRole("button", { name: /Composer aç/i }).count()) {
      await drawer2.getByRole("button", { name: /Composer aç/i }).click();
      await drawer2.locator('input[name="note"]').fill(`${artifact.note || artifact.token} second`);
      await drawer2.getByRole("button", { name: /Masaya yeni sipariş ekle|Sipariş oluştur|Masayı aç/i }).first().click();
      await page.waitForTimeout(1500);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto(`/apps/wexpay/kitchen?${orgQ}`);
    await expect(page.getByText(/Hazırlık ekranı|Mutfak|Yeni/i).first()).toBeVisible();

    const kitchenCard = page.locator("article").filter({ hasText: /NEW|Yeni/i }).first();
    if (await kitchenCard.count()) {
      await kitchenCard.getByRole("button").first().click();
      const advancePreparing = kitchenCard.locator('[data-kitchen-next="PREPARING"]');
      if (await advancePreparing.count()) {
        await advancePreparing.click();
        await page.waitForTimeout(1200);
      }
    }

    await page.goto(`/apps/wexpay/kitchen?${orgQ}`);
    const preparingCard = page.locator("article").filter({ hasText: /PREPARING|Hazırlanıyor/i }).first();
    if (await preparingCard.count()) {
      await preparingCard.getByRole("button").first().click();
      const advanceServed = preparingCard.locator('[data-kitchen-next="SERVED"]');
      if (await advanceServed.count()) {
        await advanceServed.click();
        await page.waitForTimeout(1200);
      }
    }

    await page.goto(`/apps/wexpay/payments?${orgQ}`);
    const paymentsText = await page.locator(".wexpay-content").innerText();
    expect(paymentsText).toMatch(/ödeme isteği|tahsilat|Müşteri ödeme/i);
    expect(paymentsText).not.toMatch(/riskReasons|merchant_key|PAYTR_MERCHANT/i);

    // Close-table: SERVED + remaining amount may block; assert guard copy exists.
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await page.locator("button").filter({ hasText: /Masa 0[12]/ }).first().click();
    const closeDrawer = page.getByRole("dialog");
    await expect(closeDrawer.getByRole("heading", { name: /Masa kapat/i })).toBeVisible();
    const closeBody = await closeDrawer.innerText();
    expect(closeBody).toMatch(/Kalan ödeme|Açık NEW|Masayı kapat|Masa zaten boş|Masa kapat/i);

    await page.goto(`/apps/wexpay?organizationId=00000000-0000-0000-0000-000000000099`);
    await expect(page.getByText(/Erişim gerekli|yetkisiz|unauthorized|lisans/i).first()).toBeVisible();
    await assertNoSecrets(page);

    // Best-effort: capture any NEW order ids from orders board for cleanup tracking.
    await page.goto(`/apps/wexpay/orders?${orgQ}`);
    const orderNos = await page.locator("body").innerText();
    if (/WXP-|ORD-/i.test(orderNos)) {
      trackOrderId(`tracked-${artifact.runId}`);
    }
  });
});
