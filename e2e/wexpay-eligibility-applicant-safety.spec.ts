import { expect, test } from "@playwright/test";

const INTERNAL_LEAK_PATTERNS = [
  /riskReasons/i,
  /marketplace_or_payout_request/i,
  /high_risk_sector/i,
  /custom_integration/i,
  /preferred_tier_uplift/i,
  /multi_location_floor_scale/i,
];

test.describe("wexpay eligibility applicant response safety", () => {
  test("success UI and network body omit internal riskReasons", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const bodies: string[] = [];

    page.on("response", async (response) => {
      try {
        const url = response.url();
        if (!url.includes("demo-request") && !url.includes("_next")) return;
        const text = await response.text();
        if (text) bodies.push(text);
      } catch {
        // Binary / unavailable bodies are ignored.
      }
    });

    await page.goto("/demo-request?product=wexpay&intent=eligibility&plan=growth&source=e2e-eligibility-safety");
    await page.locator('input[name="fullName"]').fill("E2E Eligibility Applicant");
    await page.locator('input[name="company"]').fill(`E2E Eligibility Co ${stamp}`);
    await page.locator('input[name="email"]').fill(`e2e.elig+${stamp}@example.com`);
    await page.locator('input[name="phone"]').fill("+905551112244");
    await page.locator('textarea[name="message"]').fill(
      "E2E eligibility applicant-facing response must never include internal risk reason keys.",
    );

    const gmv = page.locator('select[name="monthlyGmvBand"], input[name="monthlyGmvBand"]');
    if (await gmv.count()) {
      const tag = await gmv.first().evaluate((el) => el.tagName.toLowerCase());
      if (tag === "select") {
        const options = await gmv.first().locator("option").allTextContents();
        if (options.length > 1) {
          await gmv.first().selectOption({ index: Math.min(2, options.length - 1) });
        }
      } else {
        await gmv.first().fill("750k-3m");
      }
    }

    await page.getByRole("button", { name: /Uygunluğunu Kontrol Et|Demo Talebi Gönder|Başvur/i }).first().click();
    await expect(page.getByText("Talebiniz alındı")).toBeVisible({ timeout: 20_000 });

    const bodyText = await page.locator("body").innerText();
    for (const pattern of INTERNAL_LEAK_PATTERNS) {
      expect(bodyText).not.toMatch(pattern);
    }

    const leaked = bodies.some((body) =>
      INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(body) && /"riskReasons"\s*:/.test(body)),
    );
    expect(leaked, "applicant network payload must not serialize riskReasons").toBe(false);
  });
});
