import { getCanonicalTaxPolicy } from "@/lib/wexpay-canonical-catalog";
import { computeExclusiveTax, type TaxMode } from "@/lib/wexon-billing-money";

export type BillingTaxPolicy = {
  taxEnabled: boolean;
  taxRateBps: number;
  taxMode: TaxMode;
};

/** Single canonical billing tax policy (not per-plan booleans). */
export function getBillingTaxPolicy(): BillingTaxPolicy {
  const p = getCanonicalTaxPolicy();
  return {
    taxEnabled: p.taxEnabled === true,
    taxRateBps: p.taxRateBps,
    taxMode: p.taxMode,
  };
}

export type CheckoutQuoteSnapshot = {
  subscriptionAmountMinor: number;
  activationFeeAmountMinor: number;
  netAmountMinor: number;
  taxRateBps: number;
  taxAmountMinor: number;
  grossAmountMinor: number;
  taxEnabledAtPurchase: boolean;
  taxModeAtPurchase: TaxMode;
  currency: string;
  /** Line-item tax split (deterministic; sums to taxAmountMinor). */
  subscriptionTaxAmountMinor: number;
  activationTaxAmountMinor: number;
  subscriptionGrossAmountMinor: number;
  activationGrossAmountMinor: number;
};

export function buildCheckoutQuote(input: {
  subscriptionAmountMinor: number;
  activationFeeAmountMinor: number;
  currency?: string;
  /** Test override only — production uses getBillingTaxPolicy(). */
  taxPolicy?: BillingTaxPolicy;
}): CheckoutQuoteSnapshot {
  const policy = input.taxPolicy ?? getBillingTaxPolicy();
  if (policy.taxMode !== "EXCLUSIVE") {
    throw new Error(`Unsupported taxMode: ${policy.taxMode}`);
  }
  const subscriptionAmountMinor = input.subscriptionAmountMinor;
  const activationFeeAmountMinor = input.activationFeeAmountMinor;
  if (!Number.isInteger(subscriptionAmountMinor) || subscriptionAmountMinor < 0) {
    throw new Error("subscriptionAmountMinor invalid");
  }
  if (!Number.isInteger(activationFeeAmountMinor) || activationFeeAmountMinor < 0) {
    throw new Error("activationFeeAmountMinor invalid");
  }

  const subscriptionTax = computeExclusiveTax({
    netAmountMinor: subscriptionAmountMinor,
    taxRateBps: policy.taxRateBps,
    taxEnabled: policy.taxEnabled,
  });
  const activationTax = computeExclusiveTax({
    netAmountMinor: activationFeeAmountMinor,
    taxRateBps: policy.taxRateBps,
    taxEnabled: policy.taxEnabled,
  });

  const netAmountMinor = subscriptionAmountMinor + activationFeeAmountMinor;
  const taxAmountMinor = subscriptionTax.taxAmountMinor + activationTax.taxAmountMinor;
  const grossAmountMinor = subscriptionTax.grossAmountMinor + activationTax.grossAmountMinor;

  return {
    subscriptionAmountMinor,
    activationFeeAmountMinor,
    netAmountMinor,
    taxRateBps: policy.taxRateBps,
    taxAmountMinor,
    grossAmountMinor,
    taxEnabledAtPurchase: policy.taxEnabled,
    taxModeAtPurchase: policy.taxMode,
    currency: (input.currency ?? "TRY").toUpperCase(),
    subscriptionTaxAmountMinor: subscriptionTax.taxAmountMinor,
    activationTaxAmountMinor: activationTax.taxAmountMinor,
    subscriptionGrossAmountMinor: subscriptionTax.grossAmountMinor,
    activationGrossAmountMinor: activationTax.grossAmountMinor,
  };
}
