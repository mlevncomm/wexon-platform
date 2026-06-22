import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processPaytrWebhookRequest } from "./wexpay-paytr-webhook";

describe("processPaytrWebhookRequest", () => {
  it("returns 400 for invalid payload without DB mutation", async () => {
    const request = new Request("http://localhost/api/wexpay/webhooks/paytr", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "merchant_oid=only",
    });
    const result = await processPaytrWebhookRequest(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body, "invalid_payload");
    }
  });

  it("returns 404 when payment is not found for valid-shaped callback", async (t) => {
    const request = new Request("http://localhost/api/wexpay/webhooks/paytr", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "merchant_oid=missing-oid-xyz&status=success&total_amount=100&hash=fakehash",
    });
    try {
      const result = await processPaytrWebhookRequest(request);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 404);
        assert.equal(result.body, "payment_not_found");
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : String(error);
      if (name.startsWith("PrismaClient") || message.includes("ENOTFOUND") || message.includes("database")) {
        t.skip(`database unavailable: ${message}`);
        return;
      }
      throw error;
    }
  });
});
