import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCanonicalTier } from "@/lib/wexpay-canonical-catalog";
import { buildCheckoutQuote } from "@/lib/wexon-billing-tax-policy";
import { computeCheckoutQuote } from "@/lib/wexon-checkout-validation";

/**
 * Pure activation-fee due matrix (ledger decisions without DB).
 * Mirrors resolveActivationFeeDue status transitions.
 */
function isActivationDue(status: "none" | "PENDING" | "PAID" | "WAIVED" | "WAIVED_LEGACY", opts?: { demo?: boolean; reservedFresh?: boolean }) {
  if (opts?.demo) return { due: false as const, reason: "demo" as const };
  if (status === "PAID") return { due: false as const, reason: "already_settled" as const };
  if (status === "WAIVED") return { due: false as const, reason: "waived" as const };
  if (status === "WAIVED_LEGACY") return { due: false as const, reason: "waived_legacy" as const };
  if (status === "PENDING" && opts?.reservedFresh) return { due: true as const, reason: "first_purchase" as const, blocked: true as const };
  return { due: true as const, reason: "first_purchase" as const };
}

describe("smart activation fee policy", () => {
  it("adds activation only on first purchase quote", () => {
    const tier = getCanonicalTier("essential");
    const first = computeCheckoutQuote({
      plan: { tierKey: "essential" },
      interval: "monthly",
      activationFeeAmountMinor: tier.activationFeeMinor,
    });
    assert.equal(first.subscriptionAmountMinor, 750_000);
    assert.equal(first.activationFeeAmountMinor, 2_000_000);
    assert.equal(first.grossAmountMinor, 2_750_000);

    const monthlyRenewal = computeCheckoutQuote({
      plan: { tierKey: "essential" },
      interval: "monthly",
      activationFeeAmountMinor: 0,
    });
    assert.equal(monthlyRenewal.activationFeeAmountMinor, 0);
    assert.equal(monthlyRenewal.grossAmountMinor, 750_000);

    const yearlyRenewal = computeCheckoutQuote({
      plan: { tierKey: "essential" },
      interval: "yearly",
      activationFeeAmountMinor: 0,
    });
    assert.equal(yearlyRenewal.grossAmountMinor, 7_500_000);

    const upgrade = computeCheckoutQuote({
      plan: { tierKey: "growth" },
      interval: "monthly",
      activationFeeAmountMinor: 0,
    });
    assert.equal(upgrade.activationFeeAmountMinor, 0);
    assert.equal(upgrade.grossAmountMinor, 1_500_000);
  });

  it("treats failed checkout as still due and PAID/WAIVED/legacy as not due", () => {
    assert.equal(isActivationDue("none").due, true);
    assert.equal(isActivationDue("PENDING").due, true);
    assert.equal(isActivationDue("PAID").due, false);
    assert.equal(isActivationDue("WAIVED").due, false);
    assert.equal(isActivationDue("WAIVED_LEGACY").due, false);
    assert.equal(isActivationDue("none", { demo: true }).due, false);
    const reserved = isActivationDue("PENDING", { reservedFresh: true });
    assert.equal(reserved.due, true);
    assert.equal("blocked" in reserved && reserved.blocked, true);
  });

  it("isolates org/product quote amounts by tier", () => {
    const a = buildCheckoutQuote({
      subscriptionAmountMinor: getCanonicalTier("essential").monthlyPriceMinor,
      activationFeeAmountMinor: getCanonicalTier("essential").activationFeeMinor,
    });
    const b = buildCheckoutQuote({
      subscriptionAmountMinor: getCanonicalTier("growth").monthlyPriceMinor,
      activationFeeAmountMinor: getCanonicalTier("growth").activationFeeMinor,
    });
    assert.notEqual(a.grossAmountMinor, b.grossAmountMinor);
    assert.equal(a.activationFeeAmountMinor, 2_000_000);
    assert.equal(b.activationFeeAmountMinor, 4_000_000);
  });
});
