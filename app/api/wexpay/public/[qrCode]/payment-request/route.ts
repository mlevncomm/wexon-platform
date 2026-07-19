import { writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  enforcePublicAssistTableCooldown,
  enforcePublicQrIpRateLimit,
} from "@/lib/wexpay-public-rate-limit";
import { buildPublicQrAuditReference } from "@/lib/wexpay-public-qr-audit";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";
import { createPublicTableAssistNotification } from "@/lib/wexpay-service";
import { validatePublicNote } from "@/lib/wexpay-validation";

const ALLOWED_PAYMENT_MODES = new Set(["full_bill", "selected_items", "split", "other"]);

/**
 * PUBLIC QR payment request -> POST /api/wexpay/public/[qrCode]/payment-request
 *
 * Staff notification only — does NOT start a live PayTR/WexPay charge.
 * Separate IP bucket + table cooldown from waiter-call.
 */
export async function POST(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "payment_request", request, qrCode });
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
    kind: "payment_request",
    tableId: resolution.table.id,
    qrCode,
    ipAddress,
  });
  if (!cooldown.ok) return cooldown.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const body = (parsed.body ?? {}) as { note?: unknown; mode?: unknown };
    const note = validatePublicNote(body.note);
    const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "full_bill";
    const mode = ALLOWED_PAYMENT_MODES.has(modeRaw) ? modeRaw : "full_bill";

    const result = await createPublicTableAssistNotification({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
      kind: "payment_request",
      reason: mode,
      note,
      ipAddress,
    });

    return Response.json(
      {
        ok: true,
        title: result.title,
        charged: false,
        message: "Ödeme talebi işletmeye iletildi. Canlı tahsilat başlatılmadı.",
      },
      { status: 201 },
    );
  } catch (error) {
    writeAuditFailure({
      action: "wexpay.public.payment_request_failed",
      message: error instanceof Error ? error.message : "payment_request_failed",
      level: "ERROR",
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
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "POST /api/wexpay/public/payment-request",
    });
  }
}
