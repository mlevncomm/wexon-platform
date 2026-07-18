import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePaytrReturnBanner } from "@/lib/qr-order/paytr-return";

describe("resolvePaytrReturnBanner", () => {
  it("returns null when there is no return payload", () => {
    assert.equal(resolvePaytrReturnBanner(null), null);
    assert.equal(resolvePaytrReturnBanner(undefined), null);
  });

  it("shows failure copy when result is failed", () => {
    const banner = resolvePaytrReturnBanner({ result: "failed", paymentId: "pay_1" });
    assert.match(banner ?? "", /tamamlanamadı/i);
  });

  it("asks for staff confirmation when paymentId is missing", () => {
    const banner = resolvePaytrReturnBanner({ result: "success", paymentId: null });
    assert.match(banner ?? "", /personelle teyit/i);
  });

  it("shows pending status check when paymentId is present", () => {
    const banner = resolvePaytrReturnBanner({ result: "success", paymentId: "pay_1" });
    assert.match(banner ?? "", /kontrol ediliyor/i);
  });
});
