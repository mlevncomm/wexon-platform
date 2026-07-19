import { writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  getIdempotentResponse,
  readIdempotencyKeyFromRequest,
  storeIdempotentResponse,
} from "@/lib/wexpay-public-idempotency";
import {
  createPublicCheckoutPayment,
  getPublicCheckoutPaymentStatus,
  WexPayPublicCheckoutUnavailableError,
} from "@/lib/wexpay-public-checkout";
import { buildPublicQrAuditReference, inferPublicQrKeyKind } from "@/lib/wexpay-public-qr-audit";
import { enforcePublicQrIpRateLimit } from "@/lib/wexpay-public-rate-limit";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";

/**
 * PUBLIC QR PayTR checkout -> POST /api/wexpay/public/[qrCode]/checkout.
 *
 * When PayTR is disabled, responds with honest 503 checkout_unavailable.
 * Idempotency-Key scopes to table to prevent duplicate checkout intents.
 *
 * GET with ?paymentId= polls payment status after PayTR redirect (webhook may lag).
 */
export async function GET(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;
  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim();

  if (!paymentId) {
    return Response.json({ error: "paymentId gerekli." }, { status: 400 });
  }

  const limited = enforcePublicQrIpRateLimit({ kind: "bill", request, qrCode });
  if (!limited.ok) return limited.response;

  let resolution;
  try {
    resolution = await resolvePublicTableByPublicKey(qrCode);
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

  const limited = enforcePublicQrIpRateLimit({ kind: "checkout", request, qrCode });
  if (!limited.ok) return limited.response;
  const ipAddress = limited.ipAddress;

  let resolution;
  try {
    resolution = await resolvePublicTableByPublicKey(qrCode);
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
      metadata: buildPublicQrAuditReference({
        publicKey: qrCode,
        keyKind: inferPublicQrKeyKind(qrCode),
      }),
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
      metadata: buildPublicQrAuditReference({
        publicKey: qrCode,
        keyKind: resolution.keyKind,
        tableId: resolution.table.id,
        tokenId: resolution.tokenId,
        tokenPrefix: resolution.tokenPrefix,
      }),
    });
    return Response.json({ error: "Bu işletme şu anda QR ödeme kabul etmiyor.", reason: "access_closed" }, { status: 403 });
  }

  const idempotencyKey = readIdempotencyKeyFromRequest(request);
  const idempotencyScope = `qr-checkout:${resolution.table.id}`;
  const cached = await getIdempotentResponse(idempotencyScope, idempotencyKey);
  if (cached) {
    return Response.json(cached.body, { status: cached.status });
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
      publicPath: resolution.publicPath,
      keyKind: resolution.keyKind,
      tokenId: resolution.tokenId,
      tokenPrefix: resolution.tokenPrefix,
      orderId,
      ipAddress,
    });

    const payload = {
      paymentId: result.paymentId,
      amount: result.amount,
      externalCheckoutUrl: result.externalCheckoutUrl,
      reusedPending: result.reusedPending,
    };

    await storeIdempotentResponse(idempotencyScope, idempotencyKey, 201, payload);
    return Response.json(payload, { status: 201 });
  } catch (error) {
    if (error instanceof WexPayPublicCheckoutUnavailableError) {
      writeAuditFailure({
        action: "wexpay.public.checkout_unavailable",
        message: error.message,
        level: "WARN",
        organizationId: resolution.organizationId,
        source: "public_qr",
        ipAddress,
        metadata: buildPublicQrAuditReference({
          publicKey: qrCode,
          keyKind: resolution.keyKind,
          tableId: resolution.table.id,
          tokenId: resolution.tokenId,
          tokenPrefix: resolution.tokenPrefix,
        }),
      });
      const unavailable = { error: error.message, reason: "checkout_unavailable" as const };
      // Cache unavailable decisions briefly so double-submit does not spawn parallel intents.
      await storeIdempotentResponse(idempotencyScope, idempotencyKey, 503, unavailable);
      return Response.json(unavailable, { status: 503 });
    }
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/checkout",
    });
  }
}
