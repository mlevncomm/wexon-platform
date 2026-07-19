import type { ActivationFeeStatus, Prisma } from ".prisma/client";
import type { CheckoutQuoteSnapshot } from "@/lib/wexon-billing-tax-policy";
import { majorFromMinor, parseMajorToMinor } from "@/lib/wexon-billing-money";
import { getCanonicalTier, resolveWexPayTierKey } from "@/lib/wexpay-canonical-catalog";

const ACTIVATION_RESERVE_MS = 30 * 60 * 1000; // abandoned PENDING does not permanently lock

export type ActivationDueDecision =
  | { due: true; amountMinor: number; reason: "first_purchase" }
  | { due: false; amountMinor: 0; reason: "already_settled" | "waived" | "waived_legacy" | "demo" | "zero_fee" };

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
    // PENDING: if reservation expired or no payment link, fee still due (retry).
    const reservedFresh =
      existing.reservedUntil != null && existing.reservedUntil.getTime() > Date.now() && existing.subscriptionPaymentId;
    if (reservedFresh) {
      // Concurrent checkout holds a short reservation — still "due" conceptually but blocked by unique row.
      return { due: true, amountMinor: existing.activationFeeMinor || amountMinor, reason: "first_purchase", ledgerId: existing.id };
    }
    return { due: true, amountMinor: amountMinor, reason: "first_purchase", ledgerId: existing.id };
  }

  return { due: true, amountMinor, reason: "first_purchase" };
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

  if (existing?.status === "PENDING" && existing.reservedUntil && existing.reservedUntil.getTime() > Date.now() && existing.subscriptionPaymentId && existing.subscriptionPaymentId !== input.subscriptionPaymentId) {
    throw new Error("ACTIVATION_FEE_RESERVED");
  }

  const data = {
    planId: input.planId,
    status: "PENDING" as const,
    currency: input.quote.currency,
    activationFeeMinor: input.activationFeeMinor,
    taxRateBps: input.quote.taxRateBps,
    taxEnabledAtPurchase: input.quote.taxEnabledAtPurchase,
    taxModeAtPurchase: input.quote.taxModeAtPurchase,
    taxAmountMinor: input.quote.taxAmountMinor,
    grossAmountMinor: input.quote.grossAmountMinor,
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
  } catch (error) {
    // Unique race: re-read
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
    throw error;
  }
}

export async function markActivationFeePaid(
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
  if (!ledger) return { updated: false as const };
  if (ledger.status === "PAID") return { updated: false as const, duplicate: true as const };
  if (ledger.status === "WAIVED" || ledger.status === "WAIVED_LEGACY") {
    return { updated: false as const, waived: true as const };
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
