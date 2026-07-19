/**
 * Shared guards for unauthenticated WexPay public QR routes.
 */

import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { isHostedProduction } from "@/lib/wexon-production-guards";
import {
  buildPublicQrAuditReference,
  inferPublicQrKeyKind,
} from "@/lib/wexpay-public-qr-audit";
import {
  enforceRateLimit,
  RATE_LIMITS,
  resolveRateLimitConfig,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/lib/wexon-rate-limit";

export type PublicQrRateKind =
  | "menu"
  | "order"
  | "bill"
  | "waiter"
  | "payment_request"
  | "checkout";

const KIND_CONFIG: Record<
  PublicQrRateKind,
  { scope: string; config: RateLimitConfig; overrideEnv?: string; auditMessage: string }
> = {
  menu: {
    scope: "wexpay.public.qr_menu",
    config: RATE_LIMITS.publicQrMenu,
    overrideEnv: "WEXON_PUBLIC_QR_MENU_LIMIT",
    auditMessage: "QR menü isteği hız sınırına takıldı.",
  },
  order: {
    scope: "wexpay.public.qr_order",
    config: RATE_LIMITS.publicQrOrder,
    overrideEnv: "WEXON_PUBLIC_QR_ORDER_LIMIT",
    auditMessage: "QR sipariş isteği hız sınırına takıldı.",
  },
  bill: {
    scope: "wexpay.public.qr_bill",
    config: RATE_LIMITS.publicQrBill,
    overrideEnv: "WEXON_PUBLIC_QR_BILL_LIMIT",
    auditMessage: "QR hesap isteği hız sınırına takıldı.",
  },
  waiter: {
    scope: "wexpay.public.qr_waiter",
    config: RATE_LIMITS.publicQrWaiterCall,
    overrideEnv: "WEXON_PUBLIC_QR_WAITER_LIMIT",
    auditMessage: "QR garson çağrısı hız sınırına takıldı.",
  },
  payment_request: {
    scope: "wexpay.public.qr_payment_request",
    config: RATE_LIMITS.publicQrPaymentRequest,
    overrideEnv: "WEXON_PUBLIC_QR_PAYMENT_REQUEST_LIMIT",
    auditMessage: "QR ödeme talebi hız sınırına takıldı.",
  },
  checkout: {
    scope: "wexpay.public.qr_checkout",
    config: RATE_LIMITS.publicQrCheckout,
    overrideEnv: "WEXON_PUBLIC_QR_CHECKOUT_LIMIT",
    auditMessage: "QR ödeme isteği hız sınırına takıldı.",
  },
};

function assistCooldownConfig(kind: "waiter" | "payment_request"): RateLimitConfig {
  const base =
    kind === "waiter"
      ? RATE_LIMITS.publicQrWaiterTableCooldown
      : RATE_LIMITS.publicQrPaymentRequestTableCooldown;

  if (isHostedProduction()) return base;

  const overrideMs = Number(process.env.WEXON_PUBLIC_ASSIST_COOLDOWN_MS);
  if (Number.isFinite(overrideMs) && overrideMs >= 200) {
    return { limit: 1, windowMs: Math.floor(overrideMs) };
  }
  return base;
}

export function publicQrClientIp(request: Request): string {
  return getRequestIpAddress(request) ?? "unknown";
}

export function rateLimitedJsonResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return Response.json(
    {
      error: "Çok fazla istek. Lütfen kısa bir süre sonra tekrar deneyin.",
      reason: "rate_limited",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

export function cooldownJsonResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return Response.json(
    {
      error: "Bu masa için kısa süre önce bildirim gönderildi. Lütfen biraz bekleyin.",
      reason: "cooldown",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

export function enforcePublicQrIpRateLimit(input: {
  kind: PublicQrRateKind;
  request: Request;
  qrCode: string;
}): { ok: true; ipAddress: string } | { ok: false; ipAddress: string; response: Response } {
  const ipAddress = publicQrClientIp(input.request);
  const meta = KIND_CONFIG[input.kind];
  const config = resolveRateLimitConfig(meta.config, meta.overrideEnv);
  const rateLimit = enforceRateLimit(meta.scope, ipAddress, config);
  if (rateLimit.ok) {
    return { ok: true, ipAddress };
  }

  writeAuditFailure({
    action: "wexpay.public.rate_limited",
    message: meta.auditMessage,
    level: "WARN",
    source: "public_qr",
    ipAddress,
    metadata: buildPublicQrAuditReference({
      publicKey: input.qrCode,
      keyKind: inferPublicQrKeyKind(input.qrCode),
      kind: input.kind,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    }),
  });

  return { ok: false, ipAddress, response: rateLimitedJsonResponse(rateLimit) };
}

/**
 * Server-side per-table cooldown after a successful assist.
 * Separate buckets for waiter vs payment-request — no shared assist key.
 */
export function enforcePublicAssistTableCooldown(input: {
  kind: "waiter" | "payment_request";
  tableId: string;
  qrCode: string;
  ipAddress: string;
}): { ok: true } | { ok: false; response: Response } {
  const scope =
    input.kind === "waiter"
      ? "wexpay.public.waiter_table_cooldown"
      : "wexpay.public.payment_request_table_cooldown";
  const config = assistCooldownConfig(input.kind);
  const rateLimit = enforceRateLimit(scope, input.tableId, config);
  if (rateLimit.ok) return { ok: true };

  writeAuditFailure({
    action: "wexpay.public.assist_cooldown",
    message:
      input.kind === "waiter"
        ? "QR garson çağrısı masa cooldown'una takıldı."
        : "QR ödeme talebi masa cooldown'una takıldı.",
    level: "WARN",
    source: "public_qr",
    ipAddress: input.ipAddress,
    metadata: buildPublicQrAuditReference({
      publicKey: input.qrCode,
      keyKind: inferPublicQrKeyKind(input.qrCode),
      tableId: input.tableId,
      kind: input.kind,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    }),
  });

  return { ok: false, response: cooldownJsonResponse(rateLimit) };
}

/** Strip fields that must never appear on public JSON bodies. */
export function assertPublicPayloadSafe(body: unknown): void {
  const text = JSON.stringify(body);
  if (/organizationId|riskReasons|providerReference|merchant_key|PAYTR_MERCHANT|stack|BEGIN PRIVATE/i.test(text)) {
    throw new Error("Public payload failed leak audit.");
  }
}
