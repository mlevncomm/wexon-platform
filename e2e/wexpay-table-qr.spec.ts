import { expect, test } from "@playwright/test";
import { customerPassword, loadFixtures, loginCustomer } from "./helpers";

/**
 * Table QR download / copy regression — no DB mutations.
 * Safe for shared DB; also included in isolated suite for mutation-count guard.
 */
test.describe.serial("wexpay table QR actions", () => {
  const fixtures = loadFixtures();

  test("PNG and SVG downloads use safe filenames without mutating tables", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database fixtures unavailable");
    test.skip(
      !fixtures.fixturesReady || !fixtures.licensedOrgId || !fixtures.licensedCustomerEmail || !fixtures.qrCode,
      fixtures.setupError ?? "licensed WexPay fixture required",
    );

    const mutationPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") {
        mutationPosts.push(request.url());
      }
    });

    await loginCustomer(page, fixtures.licensedCustomerEmail, customerPassword());
    const orgQ = `organizationId=${fixtures.licensedOrgId}`;
    await page.goto(`/apps/wexpay/tables?${orgQ}`);
    await expect(page.getByText("Kasa workspace")).toBeVisible();

    const qrButton = page
      .locator('[data-testid="cashier-table-card"][data-table-label="Masa 01"]')
      .getByTestId("cashier-table-qr-button");
    await expect(qrButton).toBeVisible();
    await qrButton.click();

    const dialog = page.getByTestId("table-qr-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("table-qr-url")).toHaveValue(new RegExp(`/wexpay/t/${fixtures.qrCode}`));
    await expect(page.getByTestId("table-qr-skeleton")).toHaveCount(0, { timeout: 20_000 });

    const pngDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByTestId("table-qr-download-png").click();
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toBe("wexpay-masa-01-qr.png");
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();

    const svgDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByTestId("table-qr-download-svg").click();
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toBe("wexpay-masa-01-qr.svg");
    const svgFailure = await svgDownload.failure();
    expect(svgFailure).toBeNull();
    const svgStream = await svgDownload.createReadStream();
    expect(svgStream).toBeTruthy();
    const chunks: Buffer[] = [];
    for await (const chunk of svgStream!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const svgText = Buffer.concat(chunks).toString("utf8");
    expect(svgText.length).toBeGreaterThan(100);
    expect(svgText).toMatch(/<svg[\s>]/i);
    expect(svgText).not.toMatch(/<script/i);

    const mutating = mutationPosts.filter(
      (url) =>
        /\/apps\/wexpay\//.test(url) ||
        /createTable|updateTable|closeTable|createOrder|recordPayment/i.test(url),
    );
    expect(mutating, `unexpected mutation POSTs: ${mutating.join(", ")}`).toEqual([]);
  });
});
