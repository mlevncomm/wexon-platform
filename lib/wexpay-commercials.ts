/**
 * Commercial math helpers. Pass DB values at call time — do not hardcode live prices here.
 * Invoice semantics: minimumTransactionCommitment is a TRANSACTION FEE floor, not a total-invoice floor.
 */

export type MonthlyInvoiceInput = {
  planFee: number;
  actualTransactionFees: number;
  /** Transaction-fee floor (₺). */
  minimumTransactionCommitment: number;
};

export type MonthlyInvoiceResult = {
  planFee: number;
  transactionFeePortion: number;
  commitmentApplied: boolean;
  monthlyInvoice: number;
};

/**
 * monthlyInvoice = planFee + max(actualTransactionFees, minimumTransactionCommitment)
 */
export function calculateMonthlyInvoice(input: MonthlyInvoiceInput): MonthlyInvoiceResult {
  const planFee = Math.max(0, Number(input.planFee) || 0);
  const actual = Math.max(0, Number(input.actualTransactionFees) || 0);
  const commitment = Math.max(0, Number(input.minimumTransactionCommitment) || 0);
  const transactionFeePortion = Math.max(actual, commitment);
  return {
    planFee,
    transactionFeePortion,
    commitmentApplied: commitment > actual,
    monthlyInvoice: planFee + transactionFeePortion,
  };
}

/** merchantRate = partnerWholesaleFee + markup (params only; not charged live here). */
export function calculateMerchantRate(partnerWholesaleFeePct: number, markupPct: number): number {
  return Math.max(0, partnerWholesaleFeePct) + Math.max(0, markupPct);
}

/** Placeholder assumption — never treat as live PayTR rate. */
export const PARTNER_WHOLESALE_FEE_ASSUMPTION_PCT = 2.2;
