import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { buildPaytrCallbackHash } from "@/lib/wexpay-paytr-adapter";
import { processPaytrWebhookRequest } from "@/lib/wexpay-paytr-webhook";

/**
 * Pure (non-mutating) PayTR webhook unit coverage.
 * DB-backed mutation cases live in `wexpay-paytr-webhook.db.test.ts`.
 */

function buildPaytrWebhookBody(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}) {
  return new URLSearchParams({
    merchant_oid: input.merchantOid,
    status: input.status,
    total_amount: input.totalAmount,
    hash: input.hash,
  }).toString();
}

function signedBody(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  merchantKey?: string;
  merchantSalt?: string;
}) {
  const merchantKey = input.merchantKey ?? "integration-merchant-key";
  const merchantSalt = input.merchantSalt ?? "integration-merchant-salt";
  const hash = buildPaytrCallbackHash({
    merchantOid: input.merchantOid,
    status: input.status,
    totalAmount: input.totalAmount,
    hash: "",
    merchantKey,
    merchantSalt,
  });
  return buildPaytrWebhookBody({
    merchantOid: input.merchantOid,
    status: input.status,
    totalAmount: input.totalAmount,
    hash,
  });
}

function webhookRequest(rawBody: string) {
  return new Request("http://localhost/api/wexpay/webhooks/paytr", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
}

describe("processPaytrWebhookRequest (unit)", () => {
  it("returns 400 for invalid payload without DB mutation", async () => {
    const request = webhookRequest("merchant_oid=only");
    const result = await processPaytrWebhookRequest(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body, "invalid_payload");
    }
  });

  it("parses raw urlencoded body (not JSON)", async () => {
    const raw = signedBody({
      merchantOid: `raw-body-${Date.now()}`,
      status: "success",
      totalAmount: "100",
    });
    assert.ok(!raw.trim().startsWith("{"));
    const request = webhookRequest(raw);
    const text = await request.text();
    assert.ok(text.includes("merchant_oid="));
    assert.ok(text.includes("hash="));
  });
});

describe("PayTR callback HMAC (local)", () => {
  it("builds deterministic callback hash", () => {
    const hash = buildPaytrCallbackHash({
      merchantOid: "OID1",
      status: "success",
      totalAmount: "12000",
      hash: "",
      merchantKey: "key",
      merchantSalt: "salt",
    });
    const expected = createHmac("sha256", "key").update("OID1saltsuccess12000").digest("base64");
    assert.equal(hash, expected);
  });
});
