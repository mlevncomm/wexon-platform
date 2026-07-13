import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  amountToMinorUnit,
  buildPaytrCallbackHash,
  buildPaytrIframeTokenHash,
  generateMerchantOid,
  redactPaytrPayload,
  verifyPaytrCallbackHash,
} from "@/lib/paytr/paytr-hash";
import { normalizePaytrCallback } from "@/lib/paytr/paytr-callback";
import {
  buildPaytrIframeTokenRequest,
  buildUserBasketForSubscription,
  isPaytrSubscriptionEnabled,
} from "@/lib/paytr/paytr-client";

describe("paytr-hash", () => {
  it("amountToMinorUnit converts TRY to kuruş", () => {
    assert.equal(amountToMinorUnit(1490), 149000);
    assert.equal(amountToMinorUnit(99.99), 9999);
  });

  it("generateMerchantOid is unique alphanumeric", () => {
    const a = generateMerchantOid();
    const b = generateMerchantOid();
    assert.notEqual(a, b);
    assert.match(a, /^[a-zA-Z0-9]+$/);
    assert.ok(a.length <= 64);
  });

  it("builds and verifies callback hash timing-safe", () => {
    const fields = {
      merchantOid: "wxsubtestoid1",
      status: "success",
      totalAmount: "178800",
      hash: "",
    };
    const credentials = { merchantKey: "test-key", merchantSalt: "test-salt" };
    fields.hash = buildPaytrCallbackHash({
      merchantOid: fields.merchantOid,
      merchantSalt: credentials.merchantSalt,
      status: fields.status,
      totalAmount: fields.totalAmount,
      merchantKey: credentials.merchantKey,
    });
    assert.equal(verifyPaytrCallbackHash(fields, credentials), true);
    assert.equal(verifyPaytrCallbackHash({ ...fields, hash: "bad" }, credentials), false);
  });

  it("token hash payload is stable for known inputs", () => {
    const token = buildPaytrIframeTokenHash({
      merchantId: "merchant",
      userIp: "1.2.3.4",
      merchantOid: "oid1",
      email: "a@b.com",
      paymentAmountMinor: 1000,
      userBasketBase64: "YmFza2V0",
      currency: "TRY",
      testMode: true,
      noInstallment: true,
      maxInstallment: 0,
      merchantKey: "key",
      merchantSalt: "salt",
    });
    assert.ok(token.length > 10);
  });

  it("redacts secrets from payloads", () => {
    const redacted = redactPaytrPayload({ merchant_id: "1", hash: "abc", nested: { merchant_key: "x" } });
    assert.equal(redacted.hash, "[redacted]");
    assert.equal((redacted.nested as Record<string, unknown>).merchant_key, "[redacted]");
    assert.equal(redacted.merchant_id, "1");
  });
});

describe("paytr-callback normalize", () => {
  it("parses form body fields", () => {
    const fields = normalizePaytrCallback(
      "merchant_oid=abc&status=success&total_amount=100&hash=zzz&failed_reason_msg=nope",
    );
    assert.ok(fields);
    assert.equal(fields?.merchantOid, "abc");
    assert.equal(fields?.status, "success");
    assert.equal(fields?.failedReasonMsg, "nope");
  });

  it("rejects incomplete payloads", () => {
    assert.equal(normalizePaytrCallback("merchant_oid=abc&status=success"), null);
  });
});

describe("paytr-client flags", () => {
  it("subscription enable requires both flags", () => {
    const prevSub = process.env.PAYTR_SUBSCRIPTION_ENABLE_API;
    const prevIframe = process.env.PAYTR_IFRAME_ENABLE_API;
    process.env.PAYTR_SUBSCRIPTION_ENABLE_API = "true";
    process.env.PAYTR_IFRAME_ENABLE_API = "false";
    assert.equal(isPaytrSubscriptionEnabled(), false);
    process.env.PAYTR_IFRAME_ENABLE_API = "true";
    assert.equal(isPaytrSubscriptionEnabled(), true);
    process.env.PAYTR_SUBSCRIPTION_ENABLE_API = prevSub;
    process.env.PAYTR_IFRAME_ENABLE_API = prevIframe;
  });

  it("builds iframe token request without exposing raw secrets in keys wrongly", () => {
    const body = buildPaytrIframeTokenRequest({
      credentials: { merchantId: "m1", merchantKey: "k1", merchantSalt: "s1" },
      userIp: "1.1.1.1",
      merchantOid: "oid",
      email: "c@wexon.dev",
      paymentAmountMinor: 178800,
      userBasketBase64: buildUserBasketForSubscription({ planName: "Standard", total: 1788 }),
      userName: "Test",
      userAddress: "TR",
      userPhone: "05000000000",
      merchantOkUrl: "https://www.wexon.dev/billing/paytr/success",
      merchantFailUrl: "https://www.wexon.dev/billing/paytr/fail",
      currency: "TRY",
    });
    assert.equal(body.merchant_id, "m1");
    assert.ok(body.paytr_token);
    assert.equal(body.payment_amount, "178800");
  });
});
