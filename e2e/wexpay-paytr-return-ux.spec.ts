import { expect, test } from "@playwright/test";
import { loadFixtures } from "./helpers";
import { skipUnlessIsolatedMutation } from "./wexpay-mutation-helpers";

/**
 * PayTR return UX without calling PayTR or charging cards.
 * Uses public QR query params only.
 */
test.describe("wexpay paytr return UX (isolated)", () => {
  const fixtures = loadFixtures();

  test("failed return shows failure banner; success without paymentId asks for staff confirm", async ({
    page,
  }) => {
    skipUnlessIsolatedMutation();
    const qr = fixtures.qrCode!;

    await page.goto(`/wexpay/t/${encodeURIComponent(qr)}?paytr=failed`);
    await expect(page.getByText(/Online ödeme tamamlanamadı/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/wexpay/t/${encodeURIComponent(qr)}?paytr=success`);
    await expect(page.getByText(/personelle teyit|kontrol ediliyor/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
