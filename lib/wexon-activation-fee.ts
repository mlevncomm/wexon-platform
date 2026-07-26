import type { ActivationFeeStatus, Prisma } from ".prisma/client";
import type { CheckoutQuoteSnapshot } from "@/lib/wexon-billing-tax-policy";
import { majorFromMinor, parseMajorToMinor } from "@/lib/wexon-billing-money";
import { getCanonicalTier, resolveWexPayTierKey } from "@/lib/wexpay-canonical-catalog";

export const ACTIVATION_RESERVE_MS = 30 * 60 * 1000; // abandoned PENDING does not permanently lock

/** Shared advisory lock for all ActivationFeeLedger read-modify-write paths. */
export const ACTIVATION_FEE_LOCK_NAMESPACE = "wexon:activation-fee";

export type ActivationDueDecision =
  | { due: true; amountMinor: number; reason: "first_purchase" }
  | { due: false; amountMinor: 0; reason: "already_settled" | "waived" | "waived_legacy" | "demo" | "zero_fee" };

export class ActivationFeeError extends Error {
  readonly code:
    | "ACTIVATION_FEE_RESERVED"
    | "ACTIVATION_FEE_OWNERSHIP_MISMATCH"
    | "ACTIVATION_FEE_STALE_CALLBACK"
    | "ACTIVATION_FEE_IMMUTABLE"
    | "ACTIVATION_FEE_STALE_QUOTE";

  constructor(
    code:
      | "ACTIVATION_FEE_RESERVED"
      | "ACTIVATION_FEE_OWNERSHIP_MISMATCH"
      | "ACTIVATION_FEE_STALE_CALLBACK"
      | "ACTIVATION_FEE_IMMUTABLE"
      | "ACTIVATION_FEE_STALE_QUOTE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ActivationFeeError";
    this.code = code;
  }
}

type LedgerClient = {
  activationFeeLedger: Prisma.TransactionClient["activationFeeLedger"];
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  license: Prisma.TransactionClient["license"];
};

export function activationFeeLockEntity(organizationId: string, productId: string) {
  return `${organizationId}:${productId}`;
}

/** Transaction-scoped advisory lock; re-entrant within the same PostgreSQL transaction. */
export async function lockActivationFeeLedger(
  tx: Pick<LedgerClient, "$executeRaw">,
  organizationId: string,
  productId: string,
) {
  const entity = activationFeeLockEntity(organizationId, productId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ACTIVATION_FEE_LOCK_NAMESPACE}), hashtext(${entity}))`;
}

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

function isSettledStatus(status: ActivationFeeStatus) {
  return status === "PAID" || status === "WAIVED" || status === "WAIVED_LEGACY";
}

/**
 * Decide whether Smart Activation fee is due for org+product.
 * Settled statuses (PAID/WAIVED/WAIVED_LEGACY) → not due.
 * Expired PENDING reservations are ignored (re-openable).
 */
export async function resolveActivationFeeDue(
  tx: Pick<LedgerClient, "activationFeeLedger">,
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

async function assertReservePlanMatchesActiveLicense(
  tx: Pick<LedgerClient, "license">,
  input: { organizationId: string; productId: string; planId: string },
) {
  const activeLicense = await tx.license.findFirst({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      status: "ACTIVE",
    },
    select: { planId: true },
  });
  if (activeLicense && activeLicense.planId !== input.planId) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_STALE_QUOTE",
      "Aktivasyon rezervasyonu güncel lisans paketi ile uyuşmuyor.",
    );
  }
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

  await lockActivationFeeLedger(tx, input.organizationId, input.productId);
  await assertReservePlanMatchesActiveLicense(tx, input);

  const reservedUntil = new Date(Date.now() + ACTIVATION_RESERVE_MS);
  const existing = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });

  if (existing && isSettledStatus(existing.status)) {
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
    // Predicate update: never overwrite PAID/WAIVED/WAIVED_LEGACY via stale PENDING snapshot.
    const updated = await tx.activationFeeLedger.updateMany({
      where: { id: existing.id, status: "PENDING" },
      data,
    });
    if (updated.count === 0) {
      const raced = await tx.activationFeeLedger.findUnique({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: input.productId,
          },
        },
      });
      if (raced && isSettledStatus(raced.status)) {
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
    return { status: "PENDING", ledgerId: existing.id };
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
    if (raced && isSettledStatus(raced.status)) {
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
  await lockActivationFeeLedger(tx, input.organizationId, input.productId);

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

  const updated = await tx.activationFeeLedger.updateMany({
    where: {
      id: ledger.id,
      status: "PENDING",
      subscriptionPaymentId: input.subscriptionPaymentId,
    },
    data: {
      status: "PAID",
      paidAt: new Date(),
      subscriptionPaymentId: input.subscriptionPaymentId,
      reservedUntil: null,
    },
  });
  if (updated.count === 0) {
    const raced = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: input.productId,
        },
      },
    });
    if (raced?.status === "PAID" && raced.subscriptionPaymentId === input.subscriptionPaymentId) {
      return { updated: false as const, duplicate: true as const };
    }
    if (raced && (raced.status === "WAIVED" || raced.status === "WAIVED_LEGACY")) {
      if (intendedCharge > 0) {
        throw new ActivationFeeError(
          "ACTIVATION_FEE_IMMUTABLE",
          `Aktivasyon kaydı ${raced.status} durumunda; bu ödeme aktivasyon tahsil edemez.`,
        );
      }
      return { updated: false as const, waived: true as const, status: raced.status };
    }
    if (raced?.status === "PAID") {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_OWNERSHIP_MISMATCH",
        "Aktivasyon bedeli başka bir ödeme ile zaten tahsil edilmiş.",
      );
    }
    throw new ActivationFeeError(
      "ACTIVATION_FEE_STALE_CALLBACK",
      "Aktivasyon rezervasyonu süresi dolmuş; manuel reconciliation gerekir.",
    );
  }
  return { updated: true as const };
}

export async function releaseActivationFeeReservation(
  tx: LedgerClient,
  input: { organizationId: string; productId: string; subscriptionPaymentId: string },
) {
  await lockActivationFeeLedger(tx, input.organizationId, input.productId);

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
  await tx.activationFeeLedger.updateMany({
    where: {
      id: ledger.id,
      status: "PENDING",
      subscriptionPaymentId: input.subscriptionPaymentId,
    },
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
  await lockActivationFeeLedger(tx, input.organizationId, input.productId);

  const existing = await tx.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: input.productId,
      },
    },
  });
  if (existing && isSettledStatus(existing.status)) {
    throw new ActivationFeeError(
      "ACTIVATION_FEE_IMMUTABLE",
      `Aktivasyon kaydı ${existing.status} durumunda değiştirilemez.`,
    );
  }

  const status = input.legacy ? ("WAIVED_LEGACY" as const) : ("WAIVED" as const);
  const waiveData = {
    status,
    waivedReason: input.reason,
    waivedByUserId: input.waivedByUserId ?? null,
    reservedUntil: null,
    subscriptionPaymentId: null,
  };

  if (existing) {
    const updated = await tx.activationFeeLedger.updateMany({
      where: { id: existing.id, status: "PENDING" },
      data: waiveData,
    });
    if (updated.count === 0) {
      const raced = await tx.activationFeeLedger.findUniqueOrThrow({
        where: {
          organizationId_productId: {
            organizationId: input.organizationId,
            productId: input.productId,
          },
        },
      });
      throw new ActivationFeeError(
        "ACTIVATION_FEE_IMMUTABLE",
        `Aktivasyon kaydı ${raced.status} durumunda değiştirilemez.`,
      );
    }
    return tx.activationFeeLedger.findUniqueOrThrow({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: input.productId,
        },
      },
    });
  }

  try {
    return await tx.activationFeeLedger.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId,
        currency: "TRY",
        activationFeeMinor: 0,
        ...waiveData,
      },
    });
  } catch {
    const raced = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: input.productId,
        },
      },
    });
    if (raced && isSettledStatus(raced.status)) {
      throw new ActivationFeeError(
        "ACTIVATION_FEE_IMMUTABLE",
        `Aktivasyon kaydı ${raced.status} durumunda değiştirilemez.`,
      );
    }
    throw new ActivationFeeError(
      "ACTIVATION_FEE_IMMUTABLE",
      "Aktivasyon ücreti muafiyeti tamamlanamadı.",
    );
  }
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
