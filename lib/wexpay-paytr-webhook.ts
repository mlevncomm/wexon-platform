import { PaymentStatus, WexPayProviderCredentialMode } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestIpAddress, writeAuditLog } from "@/lib/wexon-audit";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import {
  attachOrganizationToWexPayWebhookEvent,
  markWexPayWebhookEventFailed,
  markWexPayWebhookEventIgnored,
  markWexPayWebhookEventProcessed,
  markWexPayWebhookEventVerified,
  receiveWexPayWebhookEvent,
  runWexPayWebhookTransaction,
} from "@/lib/wexpay-webhook-events";
import {
  loadPaytrCredentialBundle,
  mapPaytrCallbackStatus,
  parsePaytrCallbackFields,
  paytrWebhookEventId,
  verifyPaytrCallbackAmount,
  verifyPaytrCallbackHash,
} from "@/lib/wexpay-paytr-adapter";
import { resolvePaytrWebhookPaymentCandidates } from "@/lib/wexpay-paytr-webhook-lookup";
import { settlePaymentFromProviderWebhook } from "@/lib/wexpay-service";

export type PaytrWebhookProcessResult =
  | { ok: true; body: "OK"; duplicate: boolean; skipped: boolean }
  | { ok: false; status: number; body: string };

async function verifyPaytrSignatureForOrganization(
  organizationId: string,
  fields: NonNullable<ReturnType<typeof parsePaytrCallbackFields>>,
) {
  for (const mode of [WexPayProviderCredentialMode.LIVE, WexPayProviderCredentialMode.TEST]) {
    const bundle = await loadPaytrCredentialBundle(organizationId, mode);
    if (!bundle) continue;
    if (
      verifyPaytrCallbackHash({
        ...fields,
        merchantKey: bundle.merchantKey,
        merchantSalt: bundle.merchantSalt,
      })
    ) {
      return true;
    }
  }
  return false;
}

export async function processPaytrWebhookRequest(request: Request): Promise<PaytrWebhookProcessResult> {
  const ipAddress = getRequestIpAddress(request) ?? "unknown";
  const rateLimit = enforceRateLimit("wexpay.webhook.paytr", ipAddress, RATE_LIMITS.paytrWebhook);
  if (!rateLimit.ok) {
    return { ok: false, status: 429, body: "rate_limited" };
  }

  const rawBody = await request.text();
  const fields = parsePaytrCallbackFields(rawBody);
  if (!fields) {
    return { ok: false, status: 400, body: "invalid_payload" };
  }

  const providerEventId = paytrWebhookEventId(fields);
  const received = await receiveWexPayWebhookEvent(
    {
      provider: "paytr",
      providerEventId,
      eventType: fields.status,
      rawBody,
      payload: Object.fromEntries(new URLSearchParams(rawBody)),
    },
    { ipAddress },
  );

  if (received.duplicate && received.event.status === "PROCESSED") {
    return { ok: true, body: "OK", duplicate: true, skipped: true };
  }

  const candidates = await prisma.payment.findMany({
    where: { provider: "paytr", providerRef: fields.merchantOid },
    include: { branch: { include: { restaurant: true } } },
  });

  const resolved = resolvePaytrWebhookPaymentCandidates(candidates);
  if (!resolved.ok) {
    const failureReason = resolved.reason;
    await markWexPayWebhookEventFailed(received.event.id, failureReason, { ipAddress });
    if (failureReason === "ambiguous_payment_ref") {
      return { ok: false, status: 409, body: failureReason };
    }
    return { ok: false, status: 404, body: "payment_not_found" };
  }

  const payment = resolved.payment;
  const organizationId = payment.branch.restaurant!.organizationId!;
  await attachOrganizationToWexPayWebhookEvent(received.event.id, organizationId, { ipAddress });

  const signatureValid = await verifyPaytrSignatureForOrganization(organizationId, fields);
  if (!signatureValid) {
    await markWexPayWebhookEventFailed(received.event.id, "invalid_signature", { ipAddress, organizationId });
    return { ok: false, status: 401, body: "invalid_signature" };
  }

  await markWexPayWebhookEventVerified(received.event.id, { ipAddress, organizationId });

  if (!verifyPaytrCallbackAmount(Number(payment.amount), fields.totalAmount)) {
    await markWexPayWebhookEventFailed(received.event.id, "amount_mismatch", { ipAddress, organizationId });
    await writeAuditLog({
      action: "wexpay.webhook.paytr.amount_mismatch",
      organizationId,
      entityType: "Payment",
      entityId: payment.id,
      ipAddress,
      source: "wexpay_webhook",
      metadata: {
        providerEventId,
        providerRef: fields.merchantOid,
        expectedKurus: Math.round(Number(payment.amount) * 100),
        receivedTotalAmount: fields.totalAmount,
      },
    });
    return { ok: false, status: 400, body: "amount_mismatch" };
  }

  const targetStatus = mapPaytrCallbackStatus(fields.status);
  const terminalStatuses: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.REFUNDED];
  if (terminalStatuses.includes(payment.status)) {
    await markWexPayWebhookEventIgnored(received.event.id, "payment_already_terminal", {
      ipAddress,
      organizationId,
    });
    return { ok: true, body: "OK", duplicate: received.duplicate, skipped: true };
  }

  try {
    const result = await runWexPayWebhookTransaction(async (tx) => {
      return settlePaymentFromProviderWebhook(
        {
          paymentId: payment.id,
          organizationId,
          status: targetStatus,
          provider: "paytr",
          providerRef: fields.merchantOid,
          ipAddress,
          webhookEventId: received.event.id,
        },
        tx,
      );
    });

    await markWexPayWebhookEventProcessed(received.event.id, { ipAddress, organizationId });
    await writeAuditLog({
      action: "wexpay.webhook.paytr.processed",
      organizationId,
      entityType: "Payment",
      entityId: payment.id,
      ipAddress,
      source: "wexpay_webhook",
      metadata: {
        providerEventId,
        providerRef: fields.merchantOid,
        status: targetStatus,
        skipped: result.skipped,
        duplicate: received.duplicate,
      },
    });

    return { ok: true, body: "OK", duplicate: received.duplicate, skipped: result.skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "processing_failed";
    await markWexPayWebhookEventFailed(received.event.id, message, { ipAddress, organizationId });
    return { ok: false, status: 500, body: "processing_failed" };
  }
}
