import { PaymentStatus } from ".prisma/client";
import { isProviderCredentialConfigured } from "@/lib/wexpay-provider-credentials";

/**
 * Operational WexPay payment provider adapters (NOT Core BillingPayment).
 *
 * Manual provider covers today's operator-recorded payments. PSP adapters
 * (PayTR, iyzico, Param) are registered stubs until tenant credentials and
 * webhook routes are wired. Public QR checkout must call
 * `createPublicQrCheckoutSessionBoundary` from a dedicated route — not from
 * order creation.
 */

export const WEXPAY_PAYMENT_PROVIDER_KEYS = ["manual", "paytr", "iyzico", "param"] as const;

export type WexPayPaymentProviderKey = (typeof WEXPAY_PAYMENT_PROVIDER_KEYS)[number];

export const WEXPAY_PROVIDER_NOT_CONFIGURED_MESSAGE = "Provider adapter not configured.";

export class WexPayPaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WexPayPaymentProviderError";
  }
}

export class WexPayProviderNotConfiguredError extends WexPayPaymentProviderError {
  readonly provider: WexPayPaymentProviderKey;

  constructor(provider: WexPayPaymentProviderKey) {
    super(WEXPAY_PROVIDER_NOT_CONFIGURED_MESSAGE);
    this.name = "WexPayProviderNotConfiguredError";
    this.provider = provider;
  }
}

export type WexPayPaymentCheckoutContext = {
  organizationId: string;
  branchId: string;
  tableId: string;
  orderId: string | null;
  amount: number;
  currency: string;
  /** Reserved for PSP idempotency keys — see docs/wexpay-payment-provider-adapters.md */
  idempotencyKey?: string;
  /** Payer IP for PSP token requests (PayTR user_ip). */
  clientIp?: string | null;
  /** Reuse existing PayTR merchant_oid when regenerating checkout. */
  existingProviderRef?: string | null;
  /** Optional PayTR redirect URLs (public QR checkout). */
  checkoutRedirect?: { successUrl: string; failUrl: string };
};

export type WexPayPaymentIntentResult = {
  provider: WexPayPaymentProviderKey;
  providerRef: string | null;
  externalCheckoutUrl: string | null;
  requiresExternalCheckout: boolean;
  metadata?: Record<string, unknown>;
};

export type WexPayProviderCallbackPayload = {
  providerRef: string;
  rawPayload: unknown;
  signature?: string | null;
};

export type WexPayProviderCallbackResult = {
  providerRef: string;
  status: PaymentStatus;
  amount?: number;
  verified: boolean;
};

export interface WexPayPaymentProviderAdapter {
  readonly key: WexPayPaymentProviderKey;
  createPaymentIntent(context: WexPayPaymentCheckoutContext): Promise<WexPayPaymentIntentResult>;
  createCheckoutSession(context: WexPayPaymentCheckoutContext): Promise<WexPayPaymentIntentResult>;
  verifyCallback(payload: WexPayProviderCallbackPayload): Promise<WexPayProviderCallbackResult>;
  mapProviderStatus(rawStatus: string): PaymentStatus;
}

export function isWexPayPaymentProviderKey(value: string): value is WexPayPaymentProviderKey {
  return (WEXPAY_PAYMENT_PROVIDER_KEYS as readonly string[]).includes(value);
}

export function normalizeWexPayPaymentProviderRaw(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Validates and normalizes a provider key. Empty input defaults to `manual`. */
export function parseWexPayPaymentProviderKey(raw: string | null | undefined): WexPayPaymentProviderKey {
  const normalized = normalizeWexPayPaymentProviderRaw(raw);
  if (!normalized) return "manual";
  if (!isWexPayPaymentProviderKey(normalized)) {
    throw new WexPayPaymentProviderError(`Geçersiz ödeme sağlayıcısı: ${raw}`);
  }
  return normalized;
}

export async function resolveWexPayPaymentProvider(raw: string | null | undefined): Promise<{
  key: WexPayPaymentProviderKey;
  adapter: WexPayPaymentProviderAdapter;
}> {
  const key = parseWexPayPaymentProviderKey(raw);
  return { key, adapter: await getWexPayPaymentProviderAdapter(key) };
}

function mapCommonProviderStatus(rawStatus: string): PaymentStatus {
  const normalized = rawStatus.trim().toUpperCase();
  switch (normalized) {
    case "PAID":
    case "SUCCESS":
    case "COMPLETED":
      return PaymentStatus.PAID;
    case "PARTIAL":
      return PaymentStatus.PARTIAL;
    case "PENDING":
    case "WAITING":
      return PaymentStatus.PENDING;
    case "FAILED":
    case "CANCELLED":
    case "CANCELED":
      return PaymentStatus.FAILED;
    case "REFUNDED":
      return PaymentStatus.REFUNDED;
    default:
      throw new WexPayPaymentProviderError(`Bilinmeyen provider durumu: ${rawStatus}`);
  }
}

const manualAdapter: WexPayPaymentProviderAdapter = {
  key: "manual",
  async createPaymentIntent(_context: WexPayPaymentCheckoutContext) {
    void _context;
    return {
      provider: "manual",
      providerRef: null,
      externalCheckoutUrl: null,
      requiresExternalCheckout: false,
    };
  },
  async createCheckoutSession(context) {
    return this.createPaymentIntent(context);
  },
  async verifyCallback() {
    throw new WexPayPaymentProviderError("Manuel ödemeler için provider callback desteklenmiyor.");
  },
  mapProviderStatus: mapCommonProviderStatus,
};

function createUnconfiguredAdapter(key: Exclude<WexPayPaymentProviderKey, "manual">): WexPayPaymentProviderAdapter {
  const guardIntent = async (context: WexPayPaymentCheckoutContext) => {
    await isProviderCredentialConfigured(context.organizationId, key);
    throw new WexPayProviderNotConfiguredError(key);
  };
  const guardCallback = async (_payload: WexPayProviderCallbackPayload) => {
    void _payload;
    throw new WexPayProviderNotConfiguredError(key);
  };
  return {
    key,
    createPaymentIntent: guardIntent,
    createCheckoutSession: guardIntent,
    verifyCallback: guardCallback,
    mapProviderStatus: () => {
      throw new WexPayProviderNotConfiguredError(key);
    },
  };
}

const STATIC_ADAPTERS: Record<Exclude<WexPayPaymentProviderKey, "paytr">, WexPayPaymentProviderAdapter> = {
  manual: manualAdapter,
  iyzico: createUnconfiguredAdapter("iyzico"),
  param: createUnconfiguredAdapter("param"),
};

let paytrAdapterCache: Promise<WexPayPaymentProviderAdapter> | null = null;

function loadPaytrAdapter(): Promise<WexPayPaymentProviderAdapter> {
  if (!paytrAdapterCache) {
    // Lazy import breaks circular dependency with wexpay-paytr-adapter.ts.
    paytrAdapterCache = import("@/lib/wexpay-paytr-adapter").then((module) => module.paytrAdapter);
  }
  return paytrAdapterCache;
}

export async function getWexPayPaymentProviderAdapter(key: WexPayPaymentProviderKey): Promise<WexPayPaymentProviderAdapter> {
  if (key === "paytr") return loadPaytrAdapter();
  return STATIC_ADAPTERS[key];
}

/**
 * Future public QR PSP checkout boundary (not wired to routes in Phase 5).
 *
 * When enabled, keep POST /api/wexpay/public/[qrCode]/order order-only and add a
 * dedicated checkout route that resolves the tenant provider and redirects to
 * `externalCheckoutUrl` when `requiresExternalCheckout` is true.
 */
export async function createPublicQrCheckoutSessionBoundary(
  input: WexPayPaymentCheckoutContext & { qrCode: string; provider?: string | null },
): Promise<WexPayPaymentIntentResult> {
  const { adapter } = await resolveWexPayPaymentProvider(input.provider);
  return adapter.createCheckoutSession({
    organizationId: input.organizationId,
    branchId: input.branchId,
    tableId: input.tableId,
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
  });
}
