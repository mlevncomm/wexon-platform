import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePublicCheckoutAmount } from "./wexpay-public-checkout";

describe("resolvePublicCheckoutAmount", () => {
  it("uses remaining amount when no order", () => {
    assert.equal(resolvePublicCheckoutAmount({ orderSubtotal: null, remainingAmount: 250 }), 250);
  });

  it("caps order subtotal by remaining balance", () => {
    assert.equal(resolvePublicCheckoutAmount({ orderSubtotal: 390, remainingAmount: 120 }), 120);
  });

  it("uses full order subtotal when below remaining", () => {
    assert.equal(resolvePublicCheckoutAmount({ orderSubtotal: 120, remainingAmount: 390 }), 120);
  });

  it("returns zero when remaining is zero (fully paid)", () => {
    assert.equal(resolvePublicCheckoutAmount({ orderSubtotal: 120, remainingAmount: 0 }), 0);
  });

  it("returns zero when remaining is negative", () => {
    assert.equal(resolvePublicCheckoutAmount({ orderSubtotal: 50, remainingAmount: -1 }), 0);
  });
});
