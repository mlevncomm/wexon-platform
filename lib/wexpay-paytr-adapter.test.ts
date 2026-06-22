import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  parsePaytrCallbackFields,
  paytrPaymentAmountKurus,
  verifyPaytrCallbackAmount,
  verifyPaytrCallbackHash,
} from "./wexpay-paytr-adapter";

function buildPaytrCallbackHash(fields: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
  merchantSalt: string;
}) {
  const payload = `${fields.merchantOid}${fields.merchantSalt}${fields.status}${fields.totalAmount}`;
  return createHmac("sha256", fields.merchantKey).update(payload).digest("base64");
}

describe("PayTR callback parsing", () => {
  it("parses urlencoded callback body", () => {
    const raw = "merchant_oid=WXP123&status=success&total_amount=12000&hash=abc";
    const fields = parsePaytrCallbackFields(raw);
    assert.ok(fields);
    assert.equal(fields.merchantOid, "WXP123");
    assert.equal(fields.status, "success");
    assert.equal(fields.totalAmount, "12000");
  });

  it("rejects incomplete callback body", () => {
    assert.equal(parsePaytrCallbackFields("merchant_oid=only"), null);
  });
});

describe("PayTR callback hash", () => {
  const base = {
    merchantOid: "WXPTEST001",
    status: "success",
    totalAmount: "12000",
    merchantKey: "test-merchant-key",
    merchantSalt: "test-merchant-salt",
  };

  it("verifies valid HMAC hash", () => {
    const hash = buildPaytrCallbackHash(base);
    assert.equal(verifyPaytrCallbackHash({ ...base, hash }), true);
  });

  it("rejects invalid hash", () => {
    assert.equal(verifyPaytrCallbackHash({ ...base, hash: "invalid" }), false);
  });
});

describe("PayTR callback amount", () => {
  it("matches payment amount in kurus", () => {
    assert.equal(verifyPaytrCallbackAmount(120, "12000"), true);
  });

  it("rejects amount mismatch", () => {
    assert.equal(verifyPaytrCallbackAmount(120, "11999"), false);
  });

  it("converts lira to kurus", () => {
    assert.equal(paytrPaymentAmountKurus(99.99), 9999);
  });
});
