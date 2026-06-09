import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import { resolvePublicTableByQr } from "@/lib/wexpay-read";
import { createPublicOrder } from "@/lib/wexpay-service";
import { validateOrderItems } from "@/lib/wexpay-validation";

/**
 * PUBLIC QR order creation (Phase 2B scaffold) -> /api/wexpay/public/[qrCode]/order.
 *
 * Unauthenticated diner endpoint. Resolves the owning tenant from the table
 * qrCode, requires Core WexPay access, then creates an order with a server-side
 * computed subtotal (client totals are never trusted). Audited as
 * `wexpay.order.created` with metadata source `public_qr`. This is a scaffold,
 * NOT a full PSP checkout.
 */
export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const ipAddress = getRequestIpAddress(request);
  const resolution = await resolvePublicTableByQr(qrCode);
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
      message: "QR sipariş erişimi kapalı.",
      level: "WARN",
      organizationId: resolution.organizationId,
      source: "public_qr",
      ipAddress,
      metadata: { qrCode, tableId: resolution.table.id },
    });
    return Response.json({ error: "Bu işletme şu anda QR sipariş kabul etmiyor.", reason: "access_closed" }, { status: 403 });
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const body = (parsed.body ?? {}) as { items?: unknown; note?: unknown };
    const items = validateOrderItems(body.items);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    const order = await createPublicOrder({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
      items,
      note,
      ipAddress,
    });

    return Response.json({ id: order.id, orderNo: order.orderNo, subtotal: Number(order.subtotal) }, { status: 201 });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/order",
    });
  }
}
