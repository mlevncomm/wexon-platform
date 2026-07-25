/**
 * Browser/server-safe commercial policy helpers (no Prisma / Node-only deps).
 * Single source for subscription provider allowlist and activation-fee waive eligibility.
 */

export const ADMIN_SUBSCRIPTION_PROVIDERS = ["admin_manual", "paytr"] as const;
export type AdminSubscriptionProvider = (typeof ADMIN_SUBSCRIPTION_PROVIDERS)[number];

export const ADMIN_SUBSCRIPTION_PROVIDER_LABELS: Record<AdminSubscriptionProvider, string> = {
  admin_manual: "Admin manuel",
  paytr: "PayTR (kayıt; ödeme başlatmaz)",
};

/** Payment statuses that may remain linked while still allowing admin waive. */
export const ACTIVATION_WAIVE_ALLOWED_PAYMENT_STATUSES = ["FAILED", "CANCELED", "EXPIRED"] as const;

/** Open / settled payment statuses that must block waive even if reservation expired. */
export const ACTIVATION_WAIVE_BLOCKED_PAYMENT_STATUSES = [
  "INITIATED",
  "TOKEN_CREATED",
  "PENDING_CALLBACK",
  "PAID",
] as const;

export type ActivationWaivePaymentStatus =
  | (typeof ACTIVATION_WAIVE_ALLOWED_PAYMENT_STATUSES)[number]
  | (typeof ACTIVATION_WAIVE_BLOCKED_PAYMENT_STATUSES)[number]
  | string
  | null
  | undefined;

export type ActivationFeeWaivePolicyInput = {
  status: string;
  reservedUntil: Date | string | null;
  subscriptionPaymentId: string | null;
  paymentStatus?: ActivationWaivePaymentStatus;
  now?: Date;
};

export type ActivationFeeWaivePolicyResult =
  | { canWaive: true; reservationFresh: boolean }
  | { canWaive: false; reservationFresh: boolean; code: string; message: string };

export function isAllowedAdminSubscriptionProvider(
  value: string | null | undefined,
): value is AdminSubscriptionProvider {
  return value != null && (ADMIN_SUBSCRIPTION_PROVIDERS as readonly string[]).includes(value);
}

export function isFreshActivationReservation(ledger: {
  status: string;
  reservedUntil: Date | string | null;
  subscriptionPaymentId: string | null;
  now?: Date;
}) {
  const now = ledger.now ?? new Date();
  const reservedUntil =
    ledger.reservedUntil == null
      ? null
      : ledger.reservedUntil instanceof Date
        ? ledger.reservedUntil
        : new Date(ledger.reservedUntil);
  return (
    ledger.status === "PENDING" &&
    reservedUntil != null &&
    !Number.isNaN(reservedUntil.getTime()) &&
    reservedUntil.getTime() > now.getTime() &&
    Boolean(ledger.subscriptionPaymentId)
  );
}

function normalizePaymentStatus(status: ActivationWaivePaymentStatus): string | null {
  if (status == null) return null;
  const value = String(status).trim().toUpperCase();
  return value.length > 0 ? value : null;
}

/**
 * Central waive eligibility used by admin UI summary and domain operation.
 * Reservation freshness alone is not enough — linked payment status is authoritative.
 */
export function evaluateActivationFeeWaivePolicy(
  input: ActivationFeeWaivePolicyInput,
): ActivationFeeWaivePolicyResult {
  const reservationFresh = isFreshActivationReservation(input);
  const paymentStatus = normalizePaymentStatus(input.paymentStatus);

  if (input.status === "PAID" || input.status === "WAIVED" || input.status === "WAIVED_LEGACY") {
    return {
      canWaive: false,
      reservationFresh,
      code: "immutable_ledger",
      message: "Bu aktivasyon ücreti kaydı değiştirilemez.",
    };
  }

  if (input.status !== "PENDING") {
    return {
      canWaive: false,
      reservationFresh,
      code: "invalid_status",
      message: "Bu aktivasyon ücreti kaydı muafiyet için uygun değil.",
    };
  }

  if (input.subscriptionPaymentId) {
    if (paymentStatus === "PAID") {
      return {
        canWaive: false,
        reservationFresh,
        code: "payment_paid",
        message:
          "Bu aktivasyon ücreti için tahsilat kaydı var. Muafiyet yapılamaz; manuel uzlaştırma gerekir.",
      };
    }
    if (
      paymentStatus === "INITIATED" ||
      paymentStatus === "TOKEN_CREATED" ||
      paymentStatus === "PENDING_CALLBACK"
    ) {
      return {
        canWaive: false,
        reservationFresh,
        code: "payment_in_flight",
        message:
          "Devam eden veya geç geri bildirim riski olan bir ödeme bağlantısı varken aktivasyon ücreti muaf tutulamaz.",
      };
    }
    if (
      paymentStatus &&
      !(ACTIVATION_WAIVE_ALLOWED_PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
    ) {
      return {
        canWaive: false,
        reservationFresh,
        code: "payment_blocked",
        message: "Bağlı ödeme durumu aktivasyon ücreti muafiyetine uygun değil.",
      };
    }
  }

  if (reservationFresh) {
    return {
      canWaive: false,
      reservationFresh: true,
      code: "fresh_reservation",
      message: "Devam eden bir ödeme rezervasyonu varken aktivasyon ücreti muaf tutulamaz.",
    };
  }

  return { canWaive: true, reservationFresh: false };
}

/** UI-only plan change label from server-provided sortOrder (backend remains authoritative). */
export function classifyPlanChangeBySortOrder(
  beforeSortOrder: number | null | undefined,
  afterSortOrder: number | null | undefined,
): "upgrade" | "downgrade" | "lateral" {
  if (
    beforeSortOrder == null ||
    afterSortOrder == null ||
    !Number.isFinite(beforeSortOrder) ||
    !Number.isFinite(afterSortOrder)
  ) {
    return "lateral";
  }
  if (afterSortOrder > beforeSortOrder) return "upgrade";
  if (afterSortOrder < beforeSortOrder) return "downgrade";
  return "lateral";
}

export function planChangeTypeLabelTr(changeType: "upgrade" | "downgrade" | "lateral"): string {
  if (changeType === "upgrade") return "Yükseltme";
  if (changeType === "downgrade") return "Düşürme";
  return "Yatay değişiklik";
}
