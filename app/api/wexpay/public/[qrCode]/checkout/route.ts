import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  createPublicCheckoutPayment,
  getPublicCheckoutPaymentStatus,
  WexPayPublicCheckoutUnavailableError,
} from "@/lib/wexpay-public-checkout";
import { resolvePublicTableByQr } from "@/lib/wexpay-read";

/**
 * PUBLIC QR PayTR checkout -> POST /api/wexpay/public/[qrCode]/checkout.
 *
 * Unauthenticated diner endpoint. Resolves tenant from qrCode, computes amount
 * server-side (order subtotal or table remaining), then starts a PayTR checkout.
 * Manual provider is not available on this route.
 *
 * GET with ?paymentId= polls payment status after PayTR redirect (webhook may lag).
 */
export async function GET(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;
  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim();

  if (!paymentId) {
    return Response.json({ error: "paymentId gerekli." }, { status: 400 });
  }

  let resolution;
  try {
    resolution = await resolvePublicTableByQr(qrCode);
  } catch {
    return Response.json(
      { error: "Servis geçici olarak kullanılamıyor.", reason: "service_unavailable" },
      { status: 503 },
    );
  }

  if (!resolution || !resolution.allowed) {
    return Response.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  const status = await getPublicCheckoutPaymentStatus({
    organizationId: resolution.organizationId,
    branchId: resolution.branch.id,
    tableId: resolution.table.id,
    paymentId,
  });

  if (!status) {
    return Response.json({ error: "Ödeme kaydı bulunamadı." }, { status: 404 });
  }

  return Response.json(status);
}

export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const ipAddress = getRequestIpAddress(request) ?? "unknown";
  const rateLimit = enforceRateLimit("wexpay.public.qr_checkout", ipAddress, RATE_LIMITS.publicQrCheckout);
  if (!rateLimit.ok) {
    writeAuditFailure({
      action: "wexpay.public.rate_limited",
      message: "QR ödeme isteği hız sınırına takıldı.",
      level: "WARN",
      source: "public_qr",
      ipAddress,
      metadata: { qrCode, retryAfterSeconds: rateLimit.retryAfterSeconds },
    });
    return Response.json(
      { error: "Çok fazla istek. Lütfen kısa bir süre sonra tekrar deneyin.", reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let resolution;
  try {
    resolution = await resolvePublicTableByQr(qrCode);
  } catch {
    return Response.json(
      { error: "Servis geçici olarak kullanılamıyor.", reason: "service_unavailable" },
      { status: 503 },
    );
  }
  if (!resolution) {
    writeAuditFailure({
      action: "wexpay.public.qr_not_found",
      message: "QR masa bulunamadı.",
      level: "WARN",
      source: "public_qr",
      ipAddress,
      metadata: { qrCode },
    });
    return Response.json({ error: "Masa bulunamadı." }, { status: 404 });
  }
  if (!resolution.allowed) {
    writeAuditFailure({
      action: "wexpay.public.access_closed",
      message: "QR ödeme erişimi kapalı.",
      level: "WARN",
      organizationId: resolution.organizationId,
      source: "public_qr",
      ipAddress,
      metadata: { qrCode, tableId: resolution.table.id },
    });
    return Response.json({ error: "Bu işletme şu anda QR ödeme kabul etmiyor.", reason: "access_closed" }, { status: 403 });
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const body = (parsed.body ?? {}) as { orderId?: unknown; amount?: unknown };
    // Client-supplied amount is never trusted; only orderId is accepted for checkout scope.
    void body.amount;

    const orderId =
      typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null;

    const result = await createPublicCheckoutPayment({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
      qrCode,
      orderId,
      ipAddress,
    });

    return Response.json(
      {
        paymentId: result.paymentId,
        amount: result.amount,
        providerRef: result.providerRef,
        externalCheckoutUrl: result.externalCheckoutUrl,
        reusedPending: result.reusedPending,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof WexPayPublicCheckoutUnavailableError) {
      writeAuditFailure({
        action: "wexpay.public.checkout_unavailable",
        message: error.message,
        level: "WARN",
        organizationId: resolution.organizationId,
        source: "public_qr",
        ipAddress,
        metadata: { qrCode, tableId: resolution.table.id },
      });
      return Response.json({ error: error.message, reason: "checkout_unavailable" }, { status: 503 });
    }
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/checkout",
    });
  }
}
