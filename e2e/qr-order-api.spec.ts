import { expect, test } from "@playwright/test";
import { loadFixtures } from "./helpers";
import { skipUnlessDbReadable, skipUnlessPublicApiMutationAllowed } from "./mutation-gate";

const fixtures = loadFixtures();

test.describe.serial("QR order public API", () => {
  test("invalid QR order returns 404", async ({ request }) => {
    const response = await request.post("/api/wexpay/public/UNKNOWN-QR-CODE-404/order", {
      data: { items: [{ productId: "x", quantity: 1 }] },
    });
    expect(response.status()).toBe(404);
  });

  test("price manipulation fields are rejected", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(menu.ok()).toBeTruthy();
    const menuBody = await menu.json();
    const productId = menuBody?.menu?.[0]?.products?.[0]?.id ?? null;
    test.skip(!productId, "no menu product in fixture");

    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      data: { items: [{ productId, quantity: 1, unitPrice: 0.01 }] },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(String(body.error)).toMatch(/fiyat/i);
  });

  test("valid order returns orderId/orderNo/total/status", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    const menu = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect(menu.ok()).toBeTruthy();
    const menuBody = await menu.json();
    const product = menuBody?.menu?.[0]?.products?.[0] ?? null;
    test.skip(!product?.id, "no menu product in fixture");
    const idempotencyKey = `e2e-order-${Date.now()}`;
    const response = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      headers: { "Idempotency-Key": idempotencyKey },
      data: { items: [{ productId: product.id, quantity: 1 }], note: "E2E[WXP] API order" },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.orderId || body.id).toBeTruthy();
    expect(body.orderNo).toBeTruthy();
    expect(typeof body.total === "number" || typeof body.subtotal === "number").toBeTruthy();
    expect(body.status).toBeTruthy();
    expect(body.tableName).toBeTruthy();

    const replay = await request.post(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/order`, {
      headers: { "Idempotency-Key": idempotencyKey },
      data: { items: [{ productId: product.id, quantity: 1 }], note: "E2E[WXP] API order" },
    });
    expect(replay.status()).toBe(201);
    const replayBody = await replay.json();
    expect(replayBody.orderId || replayBody.id).toBe(body.orderId || body.id);
  });

  test("bill endpoint returns empty or account snapshot", async ({ request }) => {
    skipUnlessDbReadable(fixtures);
    test.skip(!fixtures.fixturesReady || !fixtures.qrCode, fixtures.setupError ?? "qr fixture required");
    const response = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/bill`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.bill).toBeTruthy();
    expect(body.paymentAvailability).toBeTruthy();
    expect(body.paymentAvailability.liveChargeFromThisEndpoint).toBe(false);
    expect(body.paymentAvailability.staffPaymentRequest).toBe(true);
  });

  test("payment-request does not charge", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    const response = await request.post(
      `/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/payment-request`,
      { data: { mode: "full_bill", note: "E2E[WXP] payment request" } },
    );
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.charged).toBe(false);
  });

  test("waiter call succeeds", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    const response = await request.post(
      `/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}/call-waiter`,
      { data: { reason: "other", note: "E2E[WXP] waiter" } },
    );
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(String(body.title)).toMatch(/GARSON/i);
  });

  test("inactive tenant QR rejects order", async ({ request }) => {
    skipUnlessDbReadable(fixtures);
    test.skip(!fixtures.inactiveQrCode, "inactiveQrCode fixture required");

    const response = await request.post(
      `/api/wexpay/public/${encodeURIComponent(fixtures.inactiveQrCode!)}/order`,
      { data: { items: [{ productId: "x", quantity: 1 }] } },
    );
    expect(response.status()).toBe(403);
  });
});
