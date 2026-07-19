import { writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  enforcePublicAssistTableCooldown,
  enforcePublicQrIpRateLimit,
} from "@/lib/wexpay-public-rate-limit";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";
import { createPublicTableAssistNotification } from "@/lib/wexpay-service";
import { validatePublicNote } from "@/lib/wexpay-validation";

const ALLOWED_REASONS = new Set(["order_help", "payment_help", "table_clean", "other"]);

/**
 * PUBLIC QR waiter call -> POST /api/wexpay/public/[qrCode]/call-waiter
 * Creates a TABLE_UPDATED notification with [GARSON ÇAĞRISI] prefix.
 * Separate IP rate limit + per-table cooldown from payment-request.
 * Does not acknowledge arrival or start any payment charge.
 */
export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "waiter", request, qrCode });
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

  const cooldown = enforcePublicAssistTableCooldown({
    kind: "waiter",
    tableId: resolution.table.id,
    qrCode,
    ipAddress,
  });
  if (!cooldown.ok) return cooldown.response;

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

    return Response.json(
      {
        ok: true,
        title: result.title,
        message: "Garson çağrınız restorana iletildi.",
      },
      { status: 201 },
    );
  } catch (error) {
    writeAuditFailure({
      action: "wexpay.public.waiter_call_failed",
      message: error instanceof Error ? error.message : "waiter_call_failed",
      level: "ERROR",
      organizationId: resolution.organizationId,
      source: "public_qr",
      ipAddress,
      metadata: { qrCode },
    });
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/call-waiter",
    });
  }
}
