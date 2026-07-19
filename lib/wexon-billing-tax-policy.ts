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
  const netAmountMinor = subscriptionAmountMinor + activationFeeAmountMinor;
  const { taxAmountMinor, grossAmountMinor } = computeExclusiveTax({
    netAmountMinor,
    taxRateBps: policy.taxRateBps,
    taxEnabled: policy.taxEnabled,
  });
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
  };
}
