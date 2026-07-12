import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import { resolvePublicTableByQr } from "@/lib/wexpay-read";
import { getPublicTableBill } from "@/lib/wexpay-service";

/**
 * PUBLIC QR table bill -> GET /api/wexpay/public/[qrCode]/bill
 * Session-scoped account snapshot for the diner payment screen.
 */
export async function GET(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;
  const ipAddress = getRequestIpAddress(request) ?? "unknown";
  const rateLimit = enforceRateLimit("wexpay.public.qr_bill", ipAddress, RATE_LIMITS.publicQrBill);
  if (!rateLimit.ok) {
    writeAuditFailure({
      action: "wexpay.public.rate_limited",
      message: "QR hesap isteği hız sınırına takıldı.",
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

  const resolution = await resolvePublicTableByQr(qrCode);
  if (!resolution) {
    return Response.json({ error: "Masa bulunamadı." }, { status: 404 });
  }
  if (!resolution.allowed) {
    return Response.json(
      { error: "Bu işletme şu anda QR sipariş kabul etmiyor.", reason: "access_closed" },
      { status: 403 },
    );
  }

  try {
    const bill = await getPublicTableBill({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
    });

    return Response.json({
      restaurant: { name: resolution.restaurant.name },
      branch: { id: resolution.branch.id, name: resolution.branch.name },
      table: { id: resolution.table.id, label: resolution.table.label, status: resolution.table.status },
      bill,
    });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "GET /api/wexpay/public/bill",
    });
  }
}
