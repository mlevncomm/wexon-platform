import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPaymentRequestV2Enabled,
  isPaymentRequestV2GlobalEnabled,
} from "@/lib/wexpay-payment-request-flags";

describe("payment-request v2 flags", () => {
  it("global kill-switch defaults to false when unset", () => {
    assert.equal(isPaymentRequestV2GlobalEnabled({}), false);
    assert.equal(isPaymentRequestV2GlobalEnabled({ WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "" }), false);
    assert.equal(isPaymentRequestV2GlobalEnabled({ WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "false" }), false);
  });

  it("global kill-switch accepts true/1/yes/on", () => {
    assert.equal(isPaymentRequestV2GlobalEnabled({ WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "true" }), true);
    assert.equal(isPaymentRequestV2GlobalEnabled({ WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "1" }), true);
    assert.equal(isPaymentRequestV2GlobalEnabled({ WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "YES" }), true);
  });

  it("requires both global and org allowlist", () => {
    assert.equal(
      isPaymentRequestV2Enabled({
        organizationPaymentRequestV2Enabled: true,
        env: { WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "false" },
      }),
      false,
    );
    assert.equal(
      isPaymentRequestV2Enabled({
        organizationPaymentRequestV2Enabled: false,
        env: { WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "true" },
      }),
      false,
    );
    assert.equal(
      isPaymentRequestV2Enabled({
        organizationPaymentRequestV2Enabled: true,
        env: { WEXPAY_PAYMENT_REQUEST_V2_ENABLED: "true" },
      }),
      true,
    );
  });
});
