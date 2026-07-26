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
