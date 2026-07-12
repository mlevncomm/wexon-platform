import { getRequestIpAddress, writeAuditFailure } from "@/lib/wexon-audit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import { resolvePublicTableByQr } from "@/lib/wexpay-read";
import { createPublicTableAssistNotification } from "@/lib/wexpay-service";
import { validatePublicNote } from "@/lib/wexpay-validation";

const ALLOWED_REASONS = new Set(["order_help", "payment_help", "table_clean", "other"]);

/**
 * PUBLIC QR waiter call -> POST /api/wexpay/public/[qrCode]/call-waiter
 * Creates a TABLE_UPDATED notification with [GARSON ÇAĞRISI] prefix (no migration).
 * Does not start any payment charge.
 */
export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;
  const ipAddress = getRequestIpAddress(request) ?? "unknown";
  const rateLimit = enforceRateLimit("wexpay.public.qr_assist", ipAddress, RATE_LIMITS.publicQrAssist);
  if (!rateLimit.ok) {
    writeAuditFailure({
      action: "wexpay.public.rate_limited",
      message: "QR garson çağrısı hız sınırına takıldı.",
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

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const body = (parsed.body ?? {}) as { reason?: unknown; note?: unknown };
    const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "other";
    const reason = ALLOWED_REASONS.has(reasonRaw) ? reasonRaw : "other";
    const note = validatePublicNote(body.note);

    const result = await createPublicTableAssistNotification({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
      kind: "waiter_call",
      reason,
      note,
      ipAddress,
    });

    return Response.json({ ok: true, id: result.id, title: result.title }, { status: 201 });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/call-waiter",
    });
  }
}
