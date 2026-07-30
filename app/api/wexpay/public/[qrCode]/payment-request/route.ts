import { writeAuditFailure } from "@/lib/wexon-audit";
import { readJsonBody, wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import {
  enforcePublicAssistTableCooldown,
  enforcePublicQrIpRateLimit,
} from "@/lib/wexpay-public-rate-limit";
import { buildPublicQrAuditReference } from "@/lib/wexpay-public-qr-audit";
import { isPaymentRequestV2Enabled } from "@/lib/wexpay-payment-request-flags";
import { resolvePublicTableByPublicKey } from "@/lib/wexpay-read";
import {
  assertPublicPaymentRequestPreconditions,
  createPublicTableAssistNotification,
} from "@/lib/wexpay-service";
import { WexPayValidationError, validatePublicNote } from "@/lib/wexpay-validation";
import { prisma } from "@/lib/prisma";

const ALLOWED_PAYMENT_MODES = new Set(["full_bill", "selected_items", "split", "other"]);
const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "PHYSICAL_POS"]);

const PAYMENT_REQUEST_CONFLICT_MESSAGES = new Set([
  "Bu masa için ödenecek açık bir hesap bulunmuyor.",
  "Bu masa şu anda ödeme talebi için uygun değil.",
  "Bu masa için yakın zamanda sipariş bulunmuyor.",
]);

/**
 * PUBLIC QR payment request -> POST /api/wexpay/public/[qrCode]/payment-request
 *
 * Staff notification only — does NOT start a live PayTR/WexPay charge.
 * Separate IP bucket + table cooldown from waiter-call.
 * When payment-request v2 is enabled (global + org), returns requestId / alreadyOpen.
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
    const body = (parsed.body ?? {}) as {
      note?: unknown;
      mode?: unknown;
      paymentMethod?: unknown;
    };
    const note = validatePublicNote(body.note);
    const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "full_bill";
    const mode = ALLOWED_PAYMENT_MODES.has(modeRaw) ? modeRaw : "full_bill";

    const org = await prisma.organization.findUnique({
      where: { id: resolution.organizationId },
      select: { paymentRequestV2Enabled: true },
    });
    const v2Enabled = isPaymentRequestV2Enabled({
      organizationPaymentRequestV2Enabled: org?.paymentRequestV2Enabled === true,
    });

    if (v2Enabled) {
      const methodRaw = typeof body.paymentMethod === "string" ? body.paymentMethod.trim().toUpperCase() : "";
      if (!ALLOWED_PAYMENT_METHODS.has(methodRaw)) {
        throw new WexPayValidationError("Ödeme yöntemi CASH veya PHYSICAL_POS olmalıdır.");
      }

      await assertPublicPaymentRequestPreconditions({
        organizationId: resolution.organizationId,
        branchId: resolution.branch.id,
        tableId: resolution.table.id,
      });

      const result = await createPublicTableAssistNotification({
        organizationId: resolution.organizationId,
        branchId: resolution.branch.id,
        tableId: resolution.table.id,
        kind: "payment_request",
        reason: mode,
        mode,
        note,
        paymentMethod: methodRaw as "CASH" | "PHYSICAL_POS",
        structured: true,
        ipAddress,
      });

      return Response.json(
        {
          ok: true,
          title: result.title,
          charged: false,
          message: "Ödeme talebi işletmeye iletildi. Canlı tahsilat başlatılmadı.",
          requestId: result.requestId,
          alreadyOpen: result.alreadyOpen,
          ...(result.alreadyOpen && result.existing
            ? { existing: result.existing }
            : {}),
        },
        { status: result.alreadyOpen ? 200 : 201 },
      );
    }

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
    if (
      error instanceof WexPayValidationError &&
      PAYMENT_REQUEST_CONFLICT_MESSAGES.has(error.message)
    ) {
      return Response.json({ error: error.message, reason: "conflict" }, { status: 409 });
    }

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
