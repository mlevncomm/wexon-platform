/**
 * Server-safe admin finance state transition policies (no Prisma).
 */

export type InvoiceStatusValue = "DRAFT" | "ISSUED" | "PAID" | "VOID" | "OVERDUE";
export type BillingPaymentStatusValue = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type SubscriptionStatusValue = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
export type LicenseStatusValue = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";

export type FinanceTransitionResult =
  | { ok: true; kind: "apply" | "noop" }
  | { ok: false; code: "invalid_state_transition"; message: string };

const INVOICE_ALLOWED: Record<InvoiceStatusValue, readonly InvoiceStatusValue[]> = {
  DRAFT: ["ISSUED", "VOID"],
  ISSUED: ["PAID", "OVERDUE", "VOID"],
  OVERDUE: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

const BILLING_PAYMENT_ALLOWED: Record<BillingPaymentStatusValue, readonly BillingPaymentStatusValue[]> = {
  PENDING: ["PAID", "FAILED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

const SUBSCRIPTION_ALLOWED: Record<SubscriptionStatusValue, readonly SubscriptionStatusValue[]> = {
  TRIALING: ["ACTIVE", "CANCELLED", "EXPIRED"],
  ACTIVE: ["PAST_DUE", "CANCELLED", "EXPIRED"],
  PAST_DUE: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCELLED: ["ACTIVE"],
  EXPIRED: ["ACTIVE"],
};

const LICENSE_TERMINAL = new Set<LicenseStatusValue>(["CANCELLED", "EXPIRED", "SUSPENDED"]);
const SUBSCRIPTION_TERMINAL = new Set<SubscriptionStatusValue>(["CANCELLED", "EXPIRED"]);

export function evaluateInvoiceStatusTransition(
  from: string,
  to: string,
): FinanceTransitionResult {
  if (from === to) return { ok: true, kind: "noop" };
  const allowed = INVOICE_ALLOWED[from as InvoiceStatusValue];
  if (!allowed) {
    return { ok: false, code: "invalid_state_transition", message: `Fatura durumu geçersiz: ${from}.` };
  }
  if (!(allowed as readonly string[]).includes(to)) {
    return {
      ok: false,
      code: "invalid_state_transition",
      message: `Fatura durumu ${from} → ${to} geçişine izin verilmez.`,
    };
  }
  return { ok: true, kind: "apply" };
}

export function evaluateBillingPaymentStatusTransition(
  from: string,
  to: string,
): FinanceTransitionResult {
  if (from === to) return { ok: true, kind: "noop" };
  const allowed = BILLING_PAYMENT_ALLOWED[from as BillingPaymentStatusValue];
  if (!allowed) {
    return { ok: false, code: "invalid_state_transition", message: `Tahsilat durumu geçersiz: ${from}.` };
  }
  if (!(allowed as readonly string[]).includes(to)) {
    return {
      ok: false,
      code: "invalid_state_transition",
      message: `Tahsilat durumu ${from} → ${to} geçişine izin verilmez.`,
    };
  }
  return { ok: true, kind: "apply" };
}

export function evaluateSubscriptionStatusTransition(
  from: string,
  to: string,
): FinanceTransitionResult {
  if (from === to) return { ok: true, kind: "noop" };
  const allowed = SUBSCRIPTION_ALLOWED[from as SubscriptionStatusValue];
  if (!allowed) {
    return { ok: false, code: "invalid_state_transition", message: `Abonelik durumu geçersiz: ${from}.` };
  }
  if (!(allowed as readonly string[]).includes(to)) {
    return {
      ok: false,
      code: "invalid_state_transition",
      message: `Abonelik durumu ${from} → ${to} geçişine izin verilmez.`,
    };
  }
  return { ok: true, kind: "apply" };
}

/**
 * License status must not contradict an active/non-terminal subscription.
 * Terminal subscription → license should be terminal/suspended.
 */
export function evaluateLicenseStatusAgainstSubscription(input: {
  licenseStatus: string;
  subscriptionStatus: string | null | undefined;
}): FinanceTransitionResult {
  if (!input.subscriptionStatus) return { ok: true, kind: "apply" };
  const sub = input.subscriptionStatus as SubscriptionStatusValue;
  const lic = input.licenseStatus as LicenseStatusValue;
  if (!SUBSCRIPTION_TERMINAL.has(sub)) {
    if (LICENSE_TERMINAL.has(lic) && (sub === "ACTIVE" || sub === "TRIALING" || sub === "PAST_DUE")) {
      return {
        ok: false,
        code: "invalid_state_transition",
        message:
          "Bağlı abonelik aktif yaşam döngüsündeyken lisans terminal/askıya alınamaz. Önce abonelik durumunu güncelleyin.",
      };
    }
  }
  return { ok: true, kind: "apply" };
}

export function assertMoneyInvariant(input: {
  subtotal: number;
  tax: number;
  total: number;
}): { ok: true } | { ok: false; message: string } {
  if (!(input.subtotal >= 0) || !(input.tax >= 0) || !(input.total > 0)) {
    return { ok: false, message: "Fatura tutarları pozitif ve geçerli olmalıdır." };
  }
  const expected = Math.round((input.subtotal + input.tax) * 100) / 100;
  const actual = Math.round(input.total * 100) / 100;
  if (expected !== actual) {
    return { ok: false, message: "Ara toplam + vergi, toplam tutara eşit olmalıdır." };
  }
  return { ok: true };
}

export function assertPositiveAmount(amount: number, label = "Tutar"): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: `${label} pozitif olmalıdır.` };
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    return { ok: false, message: `${label} en fazla iki ondalık basamak içerebilir.` };
  }
  return { ok: true };
}

/** Minor-unit (cents) helpers — avoid float comparison for invoice settlement. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minor: number): number {
  return Math.round(minor) / 100;
}

export type InvoicePaymentCoverageInput = {
  invoiceTotal: number;
  /** Sum of BillingPayment amounts with status PAID only. */
  paidCoverageMinor: number;
  /** New PAID payment amount being applied (0 when checking status-only). */
  newPaymentAmount?: number;
};

export type InvoicePaymentCoverageResult = {
  invoiceTotalMinor: number;
  outstandingBeforeMinor: number;
  paidCoverageAfterMinor: number;
  outstandingAfterMinor: number;
  invoiceAutoPaid: boolean;
  overpayment: boolean;
};

/**
 * Compute settlement coverage for a BillingPayment against an Invoice.
 * Only PAID payments count; REFUNDED/FAILED/PENDING do not.
 */
export function evaluateInvoicePaymentCoverage(input: InvoicePaymentCoverageInput): InvoicePaymentCoverageResult {
  const invoiceTotalMinor = toMinorUnits(input.invoiceTotal);
  const newPaymentMinor = toMinorUnits(input.newPaymentAmount ?? 0);
  const outstandingBeforeMinor = Math.max(0, invoiceTotalMinor - input.paidCoverageMinor);
  const paidCoverageAfterMinor = input.paidCoverageMinor + newPaymentMinor;
  const outstandingAfterMinor = invoiceTotalMinor - paidCoverageAfterMinor;
  const overpayment = outstandingAfterMinor < 0;
  const invoiceAutoPaid = !overpayment && outstandingAfterMinor === 0 && paidCoverageAfterMinor > 0;
  return {
    invoiceTotalMinor,
    outstandingBeforeMinor,
    paidCoverageAfterMinor,
    outstandingAfterMinor: Math.max(0, outstandingAfterMinor),
    invoiceAutoPaid,
    overpayment,
  };
}

export function assertInvoicePaidCoverageSufficient(input: {
  invoiceTotal: number;
  paidCoverageMinor: number;
}): { ok: true } | { ok: false; message: string } {
  const totalMinor = toMinorUnits(input.invoiceTotal);
  if (input.paidCoverageMinor < totalMinor) {
    return { ok: false, message: "Fatura için yeterli PAID tahsilat bulunmuyor." };
  }
  return { ok: true };
}

/** Invoice create may only start as DRAFT or ISSUED — never PAID/VOID/OVERDUE. */
export function assertInvoiceCreateStatus(status: string): { ok: true } | { ok: false; message: string } {
  if (status === "DRAFT" || status === "ISSUED") return { ok: true };
  return {
    ok: false,
    message: "Yeni fatura yalnız Taslak veya Kesildi durumunda oluşturulabilir. Ödeme ayrı tahsilat kaydı ile yapılır.",
  };
}
