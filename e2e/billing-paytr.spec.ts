import { test, expect } from "@playwright/test";

/**
 * Billing / PayTR subscription E2E (mocked, no live charge).
 * Requires local fixtures or seeded plans. Skips when PayTR subscription flags are off
 * for paths that need iframe-token, and always covers public pricing + disabled gate.
 */

test.describe("billing paytr subscription", () => {
  test("public pricing surfaces load", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/checkout?product=wexpay&plan=standard&interval=monthly");
    await expect(page.getByText(/WexPay/i).first()).toBeVisible();
  });

  test("iframe-token rejects unauthenticated requests", async ({ request }) => {
    const res = await request.post("/api/billing/paytr/iframe-token", {
      data: { planId: "missing", billingInterval: "monthly", amount: 1 },
    });
    // Auth always first: unauthenticated requests must get 401 even when flags are off.
    expect(res.status()).toBe(401);
  });

  test("callback rejects invalid hash without OK", async ({ request }) => {
    const res = await request.post("/api/billing/paytr/callback", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "merchant_oid=does-not-exist&status=success&total_amount=100&hash=bad",
    });
    expect(res.status()).not.toBe(200);
    const text = await res.text();
    expect(text.trim()).not.toBe("OK");
  });

  test("success/fail pages are informational", async ({ page }) => {
    await page.goto("/billing/paytr/success");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/billing/paytr/fail");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Uygunluğunu Kontrol Et/i })).toBeVisible();
  });
});
