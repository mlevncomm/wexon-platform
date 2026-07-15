import { expect, test } from "@playwright/test";
import { loadFixtures } from "./helpers";
import { skipUnlessDbReadable, skipUnlessPublicApiMutationAllowed } from "./mutation-gate";
import { ensureRunArtifact, trackIdempotencyKey, trackOrderId, cleanupAfterSuite } from "./wexpay-mutation-helpers";

/**
 * Public API security / abuse coverage.
 * Shared remote: read-only leak checks only.
 * Isolated: rate limits, assist cooldown, checkout idempotency, PayTR-off 503.
 *
 * Server must run with:
 *   WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT=true
 *   WEXON_PUBLIC_QR_*_LIMIT / WEXON_PUBLIC_ASSIST_COOLDOWN_MS (see npm script)
 */

const fixtures = loadFixtures();

function assertNoLeaks(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/organizationId/i);
  expect(text).not.toMatch(/riskReasons/i);
  expect(text).not.toMatch(/providerReference|merchant_key|PAYTR_MERCHANT|BEGIN PRIVATE/i);
  expect(text).not.toMatch(/"stack"|at Object\.|Error: .*\n\s+at /i);
}

test.describe("wexpay public API security — read-only", () => {
  test("invalid QR responses do not leak internals", async ({ request }) => {
    const response = await request.get("/api/wexpay/public/UNKNOWN-QR-SECURITY-404");
    expect(response.status()).toBe(404);
    const body = await response.json();
    assertNoLeaks(body);
    expect(body).toHaveProperty("error");
  });

  test("licensed menu omit organization/risk/provider secrets when fixture exists", async ({ request }) => {
    skipUnlessDbReadable(fixtures);
    test.skip(!fixtures.fixturesReady || !fixtures.qrCode, fixtures.setupError ?? "fixture required");
    const response = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
    expect([200, 403, 429]).toContain(response.status());
    const body = await response.json();
    assertNoLeaks(body);
  });
});

test.describe.serial("wexpay public API security — isolated mutation", () => {
  const artifact = ensureRunArtifact();

  test.afterAll(() => {
    cleanupAfterSuite();
  });

  test("order rate limit and checkout idempotency + PayTR-off 503", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    test.skip(process.env.WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT !== "true", "FORCE_PUBLIC_QR_RATE_LIMIT required");
    test.skip(process.env.WEXPAY_PAYTR_ENABLE_API === "true", "PayTR must stay off for this assertion");

    const qr = encodeURIComponent(fixtures.qrCode!);
    const menu = await request.get(`/api/wexpay/public/${qr}`);
    expect(menu.status()).toBe(200);
    const menuBody = (await menu.json()) as { menu: Array<{ products: Array<{ id: string }> }> };
    const productId = menuBody.menu.flatMap((c) => c.products)[0]?.id;
    test.skip(!productId, "no product");

    const orderLimit = Number(process.env.WEXON_PUBLIC_QR_ORDER_LIMIT || "5");
    let order429 = false;
    let lastOrderId: string | null = null;
    for (let i = 0; i < orderLimit + 2; i += 1) {
      const response = await request.post(`/api/wexpay/public/${qr}/order`, {
        data: {
          items: [{ productId, quantity: 1 }],
          note: `${artifact.note || artifact.token} security order ${i}`,
        },
      });
      if (response.status() === 429) {
        order429 = true;
        assertNoLeaks(await response.json());
        break;
      }
      expect(response.status()).toBe(201);
      const body = (await response.json()) as { id?: string; orderId?: string };
      lastOrderId = body.orderId || body.id || null;
      if (lastOrderId) trackOrderId(lastOrderId);
      assertNoLeaks(body);
    }
    expect(order429).toBe(true);
    test.skip(!lastOrderId, "need an order id for checkout");

    const idemKey = `sec-checkout-${artifact.runId}`;
    trackIdempotencyKey(`qr-checkout:${idemKey}`);
    const checkout1 = await request.post(`/api/wexpay/public/${qr}/checkout`, {
      headers: { "Idempotency-Key": idemKey },
      data: { orderId: lastOrderId },
    });
    expect(checkout1.status()).toBe(503);
    const c1 = await checkout1.json();
    expect(c1.reason).toBe("checkout_unavailable");
    assertNoLeaks(c1);
    expect(JSON.stringify(c1)).not.toMatch(/providerRef/i);

    const checkout2 = await request.post(`/api/wexpay/public/${qr}/checkout`, {
      headers: { "Idempotency-Key": idemKey },
      data: { orderId: lastOrderId },
    });
    expect(checkout2.status()).toBe(503);
    const c2 = await checkout2.json();
    expect(c2).toEqual(c1);
  });

  test("waiter table cooldown blocks rapid repeats; payment-request stays separate", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    test.skip(process.env.WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT !== "true", "FORCE_PUBLIC_QR_RATE_LIMIT required");

    const qr = encodeURIComponent(fixtures.qrCode!);
    const note = `${artifact.note || artifact.token} security waiter`;

    const first = await request.post(`/api/wexpay/public/${qr}/call-waiter`, {
      data: { reason: "other", note },
    });
    expect([201, 429]).toContain(first.status());
    if (first.status() === 201) {
      const body = await first.json();
      expect(body.ok).toBe(true);
      expect(String(body.title)).toMatch(/GARSON/i);
      expect(body).not.toHaveProperty("id");
      assertNoLeaks(body);
    }

    const second = await request.post(`/api/wexpay/public/${qr}/call-waiter`, {
      data: { reason: "other", note: `${note} 2` },
    });
    expect(second.status()).toBe(429);
    const cool = await second.json();
    expect(["cooldown", "rate_limited"]).toContain(String(cool.reason));
    assertNoLeaks(cool);

    const pay = await request.post(`/api/wexpay/public/${qr}/payment-request`, {
      data: { mode: "full_bill", note: `${artifact.note || artifact.token} security pay` },
    });
    expect([201, 429]).toContain(pay.status());
    if (pay.status() === 201) {
      const payBody = await pay.json();
      expect(payBody.charged).toBe(false);
      expect(payBody).not.toHaveProperty("id");
      assertNoLeaks(payBody);

      const payAgain = await request.post(`/api/wexpay/public/${qr}/payment-request`, {
        data: { mode: "full_bill", note: `${artifact.note || artifact.token} security pay 2` },
      });
      expect(payAgain.status()).toBe(429);
    }
  });

  test("menu IP rate limit returns 429", async ({ request }) => {
    skipUnlessPublicApiMutationAllowed(fixtures);
    test.skip(process.env.WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT !== "true", "FORCE_PUBLIC_QR_RATE_LIMIT required");

    const limit = Number(process.env.WEXON_PUBLIC_QR_MENU_LIMIT || "5");
    let saw429 = false;
    for (let i = 0; i < limit + 3; i += 1) {
      const response = await request.get(`/api/wexpay/public/${encodeURIComponent(fixtures.qrCode!)}`);
      if (response.status() === 429) {
        saw429 = true;
        const body = await response.json();
        expect(body.reason).toBe("rate_limited");
        assertNoLeaks(body);
        break;
      }
      expect([200, 403]).toContain(response.status());
    }
    expect(saw429).toBe(true);
  });

  test("inactive tenant crossover stays denied", async ({ request }) => {
    skipUnlessDbReadable(fixtures);
    test.skip(!fixtures.inactiveQrCode, "inactive QR fixture required");
    const response = await request.post(
      `/api/wexpay/public/${encodeURIComponent(fixtures.inactiveQrCode!)}/order`,
      { data: { items: [{ productId: "x", quantity: 1 }] } },
    );
    expect(response.status()).toBe(403);
    assertNoLeaks(await response.json());
  });
});
