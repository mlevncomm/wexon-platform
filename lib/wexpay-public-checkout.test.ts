import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePublicCheckoutAmount, resolvePendingCheckoutReuseDecision } from "./wexpay-public-checkout";

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

describe("resolvePendingCheckoutReuseDecision", () => {
  it("reuses when pending amount matches validated amount", () => {
    assert.equal(
      resolvePendingCheckoutReuseDecision({
        hasPending: true,
        pendingAmount: 120,
        validatedAmount: 120,
        remainingAmount: 250,
      }),
      "reuse",
    );
  });

  it("invalidates stale pending when table is fully paid", () => {
    assert.equal(
      resolvePendingCheckoutReuseDecision({
        hasPending: true,
        pendingAmount: 120,
        validatedAmount: 0,
        remainingAmount: 0,
      }),
      "invalidate_stale",
    );
  });

  it("invalidates stale pending when amount drifted", () => {
    assert.equal(
      resolvePendingCheckoutReuseDecision({
        hasPending: true,
        pendingAmount: 120,
        validatedAmount: 90,
        remainingAmount: 200,
      }),
      "invalidate_stale",
    );
  });

  it("creates new when no pending payment", () => {
    assert.equal(
      resolvePendingCheckoutReuseDecision({
        hasPending: false,
        pendingAmount: 0,
        validatedAmount: 120,
        remainingAmount: 200,
      }),
      "create_new",
    );
  });
});
