import { expect, test } from "@playwright/test";

test.describe.serial("public journey", () => {
  test("homepage renders brand and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Wexon").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /WexPay demosunu aç|Demo talep et/i }).first()).toBeVisible();
  });

  test("product and demo routes render without closed-site copy", async ({ page }) => {
    for (const path of ["/products/wexpay", "/products/wexhotel", "/products/wexb2b", "/links", "/demo-request", "/demo/wexpay/business"]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText(/site kapalı|coming soon only/i);
      await expect(page.locator("main, body").first()).toBeVisible();
    }

    await page.goto("/products/wexpay");
    await expect(page.getByText("WexPay").first()).toBeVisible();

    await page.goto("/links");
    await expect(page.getByRole("link").first()).toBeVisible();
  });

  test("demo request validation rejects empty and invalid fields", async ({ page }) => {
    await page.goto("/demo-request");

    await page.getByRole("button", { name: /Demo Talebi Gönder/i }).click();
    // HTML5 required should block submit; form should still be visible.
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.getByText("Talebiniz alındı")).toHaveCount(0);

    await page.locator('input[name="fullName"]').fill("E2E Tester");
    await page.locator('input[name="company"]').fill("E2E Co");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('input[name="phone"]').fill("12");
    await page.locator('select[name="product"]').selectOption("WexPay");
    await page.locator('textarea[name="message"]').fill("short");
    await page.getByRole("button", { name: /Demo Talebi Gönder/i }).click();

    // Either browser email validity or server validation message.
    const invalidEmail = page.locator('input[name="email"]:invalid');
    const errorBanner = page.getByText(/geçerli bir e-posta|telefon|en az 10 karakter/i);
    await expect(invalidEmail.or(errorBanner).first()).toBeVisible();
  });

  test("demo request succeeds with timestamped test lead", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `e2e.lead+${stamp}@example.com`;
    const company = `E2E Wexon Test Org ${stamp}`;

    await page.goto("/demo-request?product=wexpay&source=e2e-audit");
    await page.locator('input[name="fullName"]').fill("E2E Lead User");
    await page.locator('input[name="company"]').fill(company);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill("+905551112233");
    await page.locator('select[name="product"]').selectOption("WexPay");
    await page.locator('textarea[name="message"]').fill("E2E audit demo request for WexPay pilot flow.");
    await page.getByRole("button", { name: /Demo Talebi Gönder/i }).click();

    await expect(page.getByText("Talebiniz alındı")).toBeVisible();
    await expect(page.getByText(/Demo talebiniz Wexon ekibine iletildi/i)).toBeVisible();
  });

  test("unknown public route returns 404 page", async ({ page }) => {
    const response = await page.goto("/this-route-should-not-exist-e2e");
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });

  test("mobile viewport keeps homepage usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Wexon", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo|WexPay demosunu aç|Ön başvuru/i }).first()).toBeVisible();
  });
});
