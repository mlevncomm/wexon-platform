import { enforcePublicQrIpRateLimit } from "@/lib/wexpay-public-rate-limit";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";
import { getAssistRequestById } from "@/lib/wexpay-service";
import { wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";

/**
 * PUBLIC QR assist status poll -> GET /api/wexpay/public/[qrCode]/assist-requests/[requestId]
 * Guest-safe: terminal statuses included; no staff/internal fields.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ qrCode: string; requestId: string }> },
) {
  const { qrCode, requestId } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "bill", request, qrCode });
  if (!limited.ok) return limited.response;
  const ipAddress = limited.ipAddress;

  const resolution = await resolvePublicTableByPublicKey(qrCode);
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
    const assist = await getAssistRequestById(requestId, { tableId: resolution.table.id });
    if (!assist) {
      return Response.json({ error: "Talep bulunamadı." }, { status: 404 });
    }

    return Response.json({
      id: assist.id,
      status: assist.status,
      paymentMethod: assist.paymentMethod,
      createdAt: assist.createdAt,
      acknowledgedAt: assist.acknowledgedAt,
      resolvedAt: assist.resolvedAt,
    });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "GET /api/wexpay/public/assist-requests/[requestId]",
    });
  }
}
