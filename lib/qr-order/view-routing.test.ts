import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  qrPrimaryCta,
  qrShell,
  qrSystemTokenClasses,
  qrPrice,
  qrCard,
} from "@/components/qr-order/qr-theme";
import { getInitialQrView, shouldShowQrBottomNav } from "@/lib/qr-order/view-routing";

describe("qr view routing", () => {
  it("defaults to landing without PayTR return", () => {
    assert.equal(getInitialQrView(null), "landing");
    assert.equal(getInitialQrView(undefined), "landing");
  });

  it("opens bill when PayTR return is present", () => {
    assert.equal(getInitialQrView({ result: "success", paymentId: "pay_1" }), "bill");
    assert.equal(getInitialQrView({ result: "failed", paymentId: null }), "bill");
  });

  it("hides bottom nav on landing and shows it on menu/status/bill", () => {
    assert.equal(shouldShowQrBottomNav("landing"), false);
    assert.equal(shouldShowQrBottomNav("cart"), false);
    assert.equal(shouldShowQrBottomNav("success"), false);
    assert.equal(shouldShowQrBottomNav("menu"), true);
    assert.equal(shouldShowQrBottomNav("status"), true);
    assert.equal(shouldShowQrBottomNav("bill"), true);
  });
});

describe("qr theme system tokens", () => {
  it("binds primary surfaces and accents to wx kit classes", () => {
    for (const token of qrSystemTokenClasses) {
      const haystack = [qrShell, qrPrimaryCta, qrPrice, qrCard].join(" ");
      assert.match(haystack, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(qrPrimaryCta, /bg-wx-accent/);
    assert.match(qrPrice, /text-wx-accent/);
    assert.match(qrShell, /bg-wx-surface/);
    assert.doesNotMatch(qrPrimaryCta, /#152238|#F97316/);
    assert.doesNotMatch(qrShell, /#F5F7FB/);
  });
});
