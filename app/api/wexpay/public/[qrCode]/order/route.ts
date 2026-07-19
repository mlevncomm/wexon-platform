import { writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  getIdempotentResponse,
  readIdempotencyKeyFromRequest,
  storeIdempotentResponse,
} from "@/lib/wexpay-public-idempotency";
import { buildPublicQrAuditReference, inferPublicQrKeyKind } from "@/lib/wexpay-public-qr-audit";
import { enforcePublicQrIpRateLimit } from "@/lib/wexpay-public-rate-limit";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";
import { createPublicOrder } from "@/lib/wexpay-service";
import { validateOrderItems, validatePublicNote } from "@/lib/wexpay-validation";

/**
 * PUBLIC QR order creation -> POST /api/wexpay/public/[qrCode]/order
 * Optional Idempotency-Key reduces double-submit duplicates.
 */
export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "order", request, qrCode });
  if (!limited.ok) return limited.response;
  const ipAddress = limited.ipAddress;

  const resolution = await resolvePublicTableByPublicKey(qrCode);
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
      message: "QR sipariş erişimi kapalı.",
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
    return Response.json({ error: "Bu işletme şu anda QR sipariş kabul etmiyor.", reason: "access_closed" }, { status: 403 });
  }

  const idempotencyKey = readIdempotencyKeyFromRequest(request);
  const idempotencyScope = `qr-order:${resolution.table.id}`;
  const cached = await getIdempotentResponse(idempotencyScope, idempotencyKey);
  if (cached) {
    return Response.json(cached.body, { status: cached.status });
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const body = (parsed.body ?? {}) as { items?: unknown; note?: unknown; receiptRequested?: unknown };
    const items = validateOrderItems(body.items);
    const note = validatePublicNote(body.note);
    const receiptRequested = body.receiptRequested === true;

    const order = await createPublicOrder({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
      items,
      note,
      receiptRequested,
      ipAddress,
    });

    const payload = {
      orderId: order.id,
      id: order.id,
      orderNo: order.orderNo,
      tableName: order.table?.label ?? resolution.table.label,
      total: Number(order.subtotal),
      subtotal: Number(order.subtotal),
      status: String(order.status),
    };

    await storeIdempotentResponse(idempotencyScope, idempotencyKey, 201, payload);
    return Response.json(payload, { status: 201 });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/order",
    });
  }
}
