import type { Payment } from ".prisma/client";

export type PaytrWebhookPaymentCandidate = Payment & {
  branch: {
    restaurant: {
      organizationId: string | null;
    } | null;
  };
};

export type PaytrWebhookPaymentResolution =
  | { ok: true; payment: PaytrWebhookPaymentCandidate }
  | { ok: false; reason: "payment_not_found" | "ambiguous_payment_ref" | "tenant_unresolvable" };

export function resolvePaytrWebhookPaymentCandidates(
  candidates: PaytrWebhookPaymentCandidate[],
): PaytrWebhookPaymentResolution {
  if (candidates.length === 0) {
    return { ok: false, reason: "payment_not_found" };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: "ambiguous_payment_ref" };
  }
  const payment = candidates[0];
  if (!payment.branch.restaurant?.organizationId) {
    return { ok: false, reason: "tenant_unresolvable" };
  }
  return { ok: true, payment };
}
