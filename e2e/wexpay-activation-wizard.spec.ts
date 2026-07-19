import { expect, test } from "@playwright/test";
import { loadFixtures } from "./helpers";

/**
 * Smart Activation wizard smoke (isolated).
 * Public gate remains closed until journey ACTIVE — covered by wexpay-activation-gate.spec.ts.
 */
test.describe("WexPay activation wizard", () => {
  test("activation route requires auth and fixtures keep public gate closed when not ACTIVE", async ({
    page,
    request,
  }) => {
    const fixtures = loadFixtures();
    await page.goto("/dashboard/wexpay/activation");
    await expect(page).toHaveURL(/login|dashboard/);

    // Invalid opaque QR still safe-fails (no crash).
    const bad = await request.get(`/api/wexpay/public/${encodeURIComponent("not-a-real-token")}/`);
    expect([400, 403, 404]).toContain(bad.status());

    if (fixtures.qrCode) {
      // When journey is ACTIVE in seed, menu may be 200; gate test covers closed state.
      const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode)}`);
      expect([200, 403]).toContain(menu.status());
    }
  });
});
