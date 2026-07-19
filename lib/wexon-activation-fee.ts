import type { ActivationFeeStatus, Prisma } from ".prisma/client";
import type { CheckoutQuoteSnapshot } from "@/lib/wexon-billing-tax-policy";
import { majorFromMinor, parseMajorToMinor } from "@/lib/wexon-billing-money";
import { getCanonicalTier, resolveWexPayTierKey } from "@/lib/wexpay-canonical-catalog";

export const ACTIVATION_RESERVE_MS = 30 * 60 * 1000; // abandoned PENDING does not permanently lock

export type ActivationDueDecision =
  | { due: true; amountMinor: number; reason: "first_purchase" }
  | { due: false; amountMinor: 0; reason: "already_settled" | "waived" | "waived_legacy" | "demo" | "zero_fee" };

export class ActivationFeeError extends Error {
  readonly code:
    | "ACTIVATION_FEE_RESERVED"
    | "ACTIVATION_FEE_OWNERSHIP_MISMATCH"
    | "ACTIVATION_FEE_STALE_CALLBACK"
    | "ACTIVATION_FEE_IMMUTABLE";

  constructor(
    code:
      | "ACTIVATION_FEE_RESERVED"
      | "ACTIVATION_FEE_OWNERSHIP_MISMATCH"
      | "ACTIVATION_FEE_STALE_CALLBACK"
      | "ACTIVATION_FEE_IMMUTABLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ActivationFeeError";
    this.code = code;
  }
}

type LedgerClient = {
  activationFeeLedger: Prisma.TransactionClient["activationFeeLedger"];
};

function activationMinorForPlan(plan: { tierKey?: string | null; setupFee?: unknown; key?: string | null }): number {
  const tierKey = resolveWexPayTierKey(plan.tierKey ?? plan.key ?? null);
  if (tierKey) {
    return getCanonicalTier(tierKey).activationFeeMinor;
  }
  return parseMajorToMinor(plan.setupFee) ?? 0;
}

function isFreshReservation(ledger: {
  status: ActivationFeeStatus;
  reservedUntil: Date | null;
  subscriptionPaymentId: string | null;
}) {
  return (
    ledger.status === "PENDING" &&
    ledger.reservedUntil != null &&
    ledger.reservedUntil.getTime() > Date.now() &&
    Boolean(ledger.subscriptionPaymentId)
  );
}

/**
 * Decide whether Smart Activation fee is due for org+product.
 * Settled statuses (PAID/WAIVED/WAIVED_LEGACY) → not due.
 * Expired PENDING reservations are ignored (re-openable).
 */
export async function resolveActivationFeeDue(
  tx: LedgerClient,
  input: {
    organizationId: string;
    productId: string;
    plan: { tierKey?: string | null; setupFee?: unknown; key?: string | null; id?: string };
    isDemo: boolean;
  },
): Promise<ActivationDueDecision & { ledgerId?: string }> {
  if (input.isDemo) {
    return { due: false, amountMinor: 0, reason: "demo" };
  }

  const amountMinor = activationMinorForPlan(input.plan);
  if (amountMinor <= 0) {
    return { due: false, amountMinor: 0, reason: "zero_fee" };
  }

  const existing = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });

  if (existing) {
    if (existing.status === "PAID") return { due: false, amountMinor: 0, reason: "already_settled", ledgerId: existing.id };
    if (existing.status === "WAIVED") return { due: false, amountMinor: 0, reason: "waived", ledgerId: existing.id };
    if (existing.status === "WAIVED_LEGACY") {
      return { due: false, amountMinor: 0, reason: "waived_legacy", ledgerId: existing.id };
    }
    if (isFreshReservation(existing)) {
      return { due: true, amountMinor: existing.activationFeeMinor || amountMinor, reason: "first_purchase", ledgerId: existing.id };
    }
    return { due: true, amountMinor: amountMinor, reason: "first_purchase", ledgerId: existing.id };
  }

  return { due: true, amountMinor, reason: "first_purchase" };
}

/** Ledger stores activation line-item only (not full checkout gross). */
function activationLedgerAmounts(quote: CheckoutQuoteSnapshot, activationFeeMinor: number) {
  return {
    activationFeeMinor,
    taxRateBps: quote.taxRateBps,
    taxEnabledAtPurchase: quote.taxEnabledAtPurchase,
    taxModeAtPurchase: quote.taxModeAtPurchase,
    taxAmountMinor: quote.activationTaxAmountMinor,
    grossAmountMinor: quote.activationGrossAmountMinor,
  };
}

export async function reserveActivationFeeForCheckout(
  tx: LedgerClient,
  input: {
    organizationId: string;
    productId: string;
    planId: string;
    activationFeeMinor: number;
    quote: CheckoutQuoteSnapshot;
    subscriptionPaymentId: string;
    isDemo: boolean;
  },
): Promise<{ status: ActivationFeeStatus; ledgerId: string | null }> {
  if (input.isDemo || input.activationFeeMinor <= 0) {
    return { status: "WAIVED", ledgerId: null };
  }

  const reservedUntil = new Date(Date.now() + ACTIVATION_RESERVE_MS);
  const existing = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });

  if (existing && (existing.status === "PAID" || existing.status === "WAIVED" || existing.status === "WAIVED_LEGACY")) {
    return { status: existing.status, ledgerId: existing.id };
  }

  if (
    existing?.status === "PENDING" &&
    isFreshReservation(existing) &&
    existing.subscriptionPaymentId !== input.subscriptionPaymentId
  ) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_RESERVED",
      "Aktivasyon bedeli için eşzamanlı bir ödeme zaten devam ediyor.",
    );
  }

  const data = {
    planId: input.planId,
    status: "PENDING" as const,
    currency: input.quote.currency,
    ...activationLedgerAmounts(input.quote, input.activationFeeMinor),
    subscriptionPaymentId: input.subscriptionPaymentId,
    reservedUntil,
  };

  if (existing) {
    const updated = await tx.activationFeeLedger.update({
      where: { id: existing.id },
      data,
    });
    return { status: updated.status, ledgerId: updated.id };
  }

  try {
    const created = await tx.activationFeeLedger.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId,
        ...data,
      },
    });
    return { status: created.status, ledgerId: created.id };
  } catch {
    const raced = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: input.productId,
        },
      },
    });
    if (raced && (raced.status === "PAID" || raced.status === "WAIVED" || raced.status === "WAIVED_LEGACY")) {
      return { status: raced.status, ledgerId: raced.id };
    }
    if (raced && isFreshReservation(raced) && raced.subscriptionPaymentId !== input.subscriptionPaymentId) {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_RESERVED",
        "Aktivasyon bedeli için eşzamanlı bir ödeme zaten devam ediyor.",
      );
    }
    throw new ActivationFeeError(
      "ACTIVATION_FEE_RESERVED",
      "Aktivasyon bedeli rezervasyonu oluşturulamadı; lütfen yeniden deneyin.",
    );
  }
}

/**
 * Mark PENDING ledger PAID only when subscriptionPaymentId matches.
 * Never overwrites PAID/WAIVED/WAIVED_LEGACY with another payment.
 * Renewals (activationFeeAmountMinor=0) no-op when already settled.
 */
export async function markActivationFeePaid(
  tx: LedgerClient,
  input: {
    organizationId: string;
    productId: string;
    subscriptionPaymentId: string;
    /** From immutable payment snapshot; >0 means this payment intended to settle activation. */
    activationFeeAmountMinor?: number | null;
  },
) {
  const intendedCharge = input.activationFeeAmountMinor ?? 0;
  const ledger = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });
  if (!ledger) {
    if (intendedCharge > 0) {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
        "Aktivasyon bedeli ledger kaydı bulunamadı.",
      );
    }
    return { updated: false as const, reason: "missing" as const };
  }

  if (ledger.status === "PAID") {
    if (ledger.subscriptionPaymentId === input.subscriptionPaymentId) {
      return { updated: false as const, duplicate: true as const };
    }
    if (intendedCharge > 0) {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
        "Aktivasyon bedeli başka bir ödeme ile zaten tahsil edilmiş.",
      );
    }
    return { updated: false as const, alreadySettled: true as const };
  }

  if (ledger.status === "WAIVED" || ledger.status === "WAIVED_LEGACY") {
    if (intendedCharge > 0) {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_IMMUTABLE",
        `Aktivasyon kaydı ${ledger.status} durumunda; bu ödeme aktivasyon tahsil edemez.`,
      );
    }
    return { updated: false as const, waived: true as const, status: ledger.status };
  }

  // PENDING
  if (ledger.subscriptionPaymentId == null) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_STALE_CALLBACK",
      "Aktivasyon rezervasyonu süresi dolmuş; manuel reconciliation gerekir.",
    );
  }

  if (ledger.subscriptionPaymentId !== input.subscriptionPaymentId) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
      "Aktivasyon bedeli rezervasyonu bu ödemeye ait değil.",
    );
  }

  await tx.activationFeeLedger.update({
    where: { id: ledger.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      subscriptionPaymentId: input.subscriptionPaymentId,
      reservedUntil: null,
    },
  });
  return { updated: true as const };
}

export async function releaseActivationFeeReservation(
  tx: LedgerClient,
  input: { organizationId: string; productId: string; subscriptionPaymentId: string },
) {
  const ledger = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });
  if (!ledger || ledger.status !== "PENDING") return;
  if (ledger.subscriptionPaymentId !== input.subscriptionPaymentId) return;
  await tx.activationFeeLedger.update({
    where: { id: ledger.id },
    data: {
      subscriptionPaymentId: null,
      reservedUntil: null,
    },
  });
}

export async function waiveActivationFee(
  tx: LedgerClient,
  input: {
    organizationId: string;
    productId: string;
    reason: string;
    waivedByUserId?: string | null;
    legacy?: boolean;
  },
) {
  const existing = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });
  if (existing && (existing.status === "PAID" || existing.status === "WAIVED" || existing.status === "WAIVED_LEGACY")) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_IMMUTABLE",
      `Aktivasyon kaydı ${existing.status} durumunda değiştirilemez.`,
    );
  }

  const status = input.legacy ? ("WAIVED_LEGACY" as const) : ("WAIVED" as const);
  return tx.activationFeeLedger.upsert({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
    create: {
      organizationId: input.organizationId,
      productId: input.productId,
      status,
      currency: "TRY",
      activationFeeMinor: 0,
      waivedReason: input.reason,
      waivedByUserId: input.waivedByUserId ?? null,
    },
    update: {
      status,
      waivedReason: input.reason,
      waivedByUserId: input.waivedByUserId ?? null,
      reservedUntil: null,
      subscriptionPaymentId: null,
    },
  });
}

export function quoteToLegacyMajorDisplay(quote: CheckoutQuoteSnapshot) {
  return {
    subtotal: majorFromMinor(quote.netAmountMinor),
    tax: majorFromMinor(quote.taxAmountMinor),
    total: majorFromMinor(quote.grossAmountMinor),
    currency: quote.currency,
    taxRatePct: Math.round(quote.taxRateBps / 100),
  };
}
