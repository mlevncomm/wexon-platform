import { createHash } from "crypto";
import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { redactPaytrPayload, verifyPaytrCallbackHash } from "@/lib/paytr/paytr-hash";
import {
  getPaytrCallbackUrl,
  loadPaytrSubscriptionCredentials,
  PaytrSubscriptionError,
} from "@/lib/paytr/paytr-client";
import type { PaytrCallbackFields } from "@/lib/paytr/paytr-types";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function addPeriod(date: Date, interval: "MONTHLY" | "YEARLY" | "ONE_TIME") {
  const next = new Date(date);
  if (interval === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export function normalizePaytrCallback(rawBody: string | URLSearchParams | Record<string, string>): PaytrCallbackFields | null {
  let params: URLSearchParams;
  if (typeof rawBody === "string") {
    params = new URLSearchParams(rawBody);
  } else if (rawBody instanceof URLSearchParams) {
    params = rawBody;
  } else {
    params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawBody)) {
      if (typeof value === "string") params.set(key, value);
    }
  }

  const merchantOid = params.get("merchant_oid")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const totalAmount = params.get("total_amount")?.trim() ?? "";
  const hash = params.get("hash")?.trim() ?? "";
  if (!merchantOid || !status || !totalAmount || !hash) return null;

  return {
    merchantOid,
    status,
    totalAmount,
    paymentAmount: params.get("payment_amount")?.trim() || undefined,
    currency: params.get("currency")?.trim() || undefined,
    failedReasonCode: params.get("failed_reason_code")?.trim() || undefined,
    failedReasonMsg: params.get("failed_reason_msg")?.trim() || undefined,
    hash,
  };
}

export function verifyOptionalCallbackSecret(request: Request): boolean {
  const expected = process.env.PAYTR_CALLBACK_SECRET?.trim();
  if (!expected) return true;
  const provided =
    request.headers.get("x-wexon-paytr-callback-secret")?.trim() ||
    request.headers.get("x-paytr-callback-secret")?.trim() ||
    "";
  if (!provided || provided.length !== expected.length) return false;
  // Simple constant-ish compare for optional extra guard (hash remains primary).
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

function callbackEventId(fields: PaytrCallbackFields) {
  return createHash("sha256")
    .update(`${fields.merchantOid}:${fields.status}:${fields.totalAmount}:${fields.hash}`)
    .digest("hex")
    .slice(0, 32);
}

async function activateSubscriptionFromPayment(paymentId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { plan: { include: { product: true } }, organization: true },
  });
  if (!payment) throw new PaytrSubscriptionError("Ödeme kaydı bulunamadı.", "not_found");
  if (payment.status !== "PAID") return null;
  if (payment.subscriptionId) {
    return prisma.subscription.findUnique({ where: { id: payment.subscriptionId } });
  }

  const now = new Date();
  const periodEnd = addPeriod(now, payment.billingInterval);
  const product = payment.plan.product;

  return prisma.$transaction(async (tx) => {
    const existingActive = await tx.license.findFirst({
      where: {
        organizationId: payment.organizationId,
        productId: product.id,
        status: "ACTIVE",
      },
    });
    if (existingActive) {
      const existingSub = await tx.subscription.findUnique({ where: { licenseId: existingActive.id } });
      if (existingSub) {
        await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: { subscriptionId: existingSub.id },
        });
        return existingSub;
      }
    }

    const license = await tx.license.create({
      data: {
        organizationId: payment.organizationId,
        productId: product.id,
        planId: payment.planId,
        status: "ACTIVE",
        licenseType: payment.billingInterval === "YEARLY" ? "YEARLY" : "MONTHLY",
        startsAt: now,
        endsAt: periodEnd,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        organizationId: payment.organizationId,
        licenseId: license.id,
        planId: payment.planId,
        status: "ACTIVE",
        interval: payment.billingInterval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        provider: "paytr",
        providerRef: payment.merchantOid,
      },
    });

    const total = Number(payment.amount);
    const taxRate = payment.taxRatePct || 20;
    const subtotal = Math.round(total / (1 + taxRate / 100));
    const tax = total - subtotal;

    const invoice = await tx.invoice.create({
      data: {
        organizationId: payment.organizationId,
        subscriptionId: subscription.id,
        invoiceNo: `INV-PAYTR-${payment.merchantOid}`.slice(0, 64),
        status: "PAID",
        subtotal,
        tax,
        total,
        currency: payment.currency,
        issuedAt: now,
        paidAt: now,
      },
    });

    await tx.billingPayment.create({
      data: {
        organizationId: payment.organizationId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        amount: payment.amount,
        currency: payment.currency,
        status: "PAID",
        provider: "paytr",
        providerRef: payment.merchantOid,
        paidAt: now,
      },
    });

    await tx.appInstallation.upsert({
      where: {
        organizationId_productId: {
          organizationId: payment.organizationId,
          productId: product.id,
        },
      },
      update: {
        status: "ACTIVE",
        licenseId: license.id,
        settingsJson: {
          onboardingStatus: "PENDING_SETUP",
          source: "paytr_subscription_checkout",
        },
      },
      create: {
        organizationId: payment.organizationId,
        productId: product.id,
        licenseId: license.id,
        status: "ACTIVE",
        settingsJson: {
          onboardingStatus: "PENDING_SETUP",
          source: "paytr_subscription_checkout",
        },
      },
    });

    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    });

    await tx.auditLog.create({
      data: {
        organizationId: payment.organizationId,
        userId: payment.userId,
        action: "billing.paytr.subscription_activated",
        entityType: "Subscription",
        entityId: subscription.id,
        metadataJson: {
          merchantOid: payment.merchantOid,
          paymentId: payment.id,
          planId: payment.planId,
          periodEnd: periodEnd.toISOString(),
        },
      },
    });

    return subscription;
  });
}

export type PaytrCallbackHandleResult =
  | { ok: true; duplicate?: boolean; activated?: boolean }
  | { ok: false; reason: string; status?: number };

export async function handlePaytrSubscriptionCallback(input: {
  rawBody: string;
  request?: Request;
}): Promise<PaytrCallbackHandleResult> {
  if (input.request && !verifyOptionalCallbackSecret(input.request)) {
    return { ok: false, reason: "callback_secret_invalid", status: 401 };
  }

  const fields = normalizePaytrCallback(input.rawBody);
  if (!fields) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  let credentials;
  try {
    credentials = loadPaytrSubscriptionCredentials();
  } catch {
    return { ok: false, reason: "credentials_missing", status: 503 };
  }

  if (!verifyPaytrCallbackHash(fields, credentials)) {
    await prisma.auditLog.create({
      data: {
        action: "billing.paytr.callback_hash_invalid",
        entityType: "SubscriptionPayment",
        entityId: fields.merchantOid,
        level: "ERROR",
        status: "FAILURE",
        metadataJson: asJson(
          redactPaytrPayload({
          merchantOid: fields.merchantOid,
          status: fields.status,
          totalAmount: fields.totalAmount,
          callbackUrl: getPaytrCallbackUrl(),
          }),
        ),
      },
    });
    return { ok: false, reason: "hash_invalid", status: 400 };
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { merchantOid: fields.merchantOid },
  });
  if (!payment) {
    return { ok: false, reason: "unknown_merchant_oid", status: 404 };
  }

  const eventId = callbackEventId(fields);
  const success = fields.status.trim().toLowerCase() === "success";
  const redacted = redactPaytrPayload({
    merchant_oid: fields.merchantOid,
    status: fields.status,
    total_amount: fields.totalAmount,
    payment_amount: fields.paymentAmount,
    currency: fields.currency,
    failed_reason_code: fields.failedReasonCode,
    failed_reason_msg: fields.failedReasonMsg,
    eventId,
  });

  if (payment.status === "PAID") {
    return { ok: true, duplicate: true };
  }

  if (success) {
    const callbackMinor = Number(fields.totalAmount);
    if (!Number.isFinite(callbackMinor) || callbackMinor !== payment.amountMinor) {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          callbackStatus: fields.status,
          callbackTotalAmount: fields.totalAmount,
          callbackPaymentAmount: fields.paymentAmount,
          callbackCurrency: fields.currency,
          failedReasonCode: "amount_mismatch",
          failedReasonMsg: "Callback tutarı beklenen amountMinor ile eşleşmiyor.",
          rawCallbackJson: asJson(redacted),
        },
      });
      await prisma.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          userId: payment.userId,
          action: "billing.paytr.callback_amount_mismatch",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
          level: "ERROR",
          status: "FAILURE",
          metadataJson: {
            expectedMinor: payment.amountMinor,
            callbackMinor,
            merchantOid: payment.merchantOid,
          },
        },
      });
      // Still acknowledge to PayTR after recording failure — avoids endless retries for bad amount.
      return { ok: true };
    }

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        callbackStatus: fields.status,
        callbackTotalAmount: fields.totalAmount,
        callbackPaymentAmount: fields.paymentAmount,
        callbackCurrency: fields.currency,
        rawCallbackJson: asJson(redacted),
        paidAt: new Date(),
        failedReasonCode: null,
        failedReasonMsg: null,
      },
    });

    await activateSubscriptionFromPayment(payment.id);
    return { ok: true, activated: true };
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      callbackStatus: fields.status,
      callbackTotalAmount: fields.totalAmount,
      callbackPaymentAmount: fields.paymentAmount,
      callbackCurrency: fields.currency,
      failedReasonCode: fields.failedReasonCode ?? "paytr_failed",
      failedReasonMsg: fields.failedReasonMsg ?? "PayTR ödeme başarısız.",
      rawCallbackJson: asJson(redacted),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: payment.organizationId,
      userId: payment.userId,
      action: "billing.paytr.callback_failed",
      entityType: "SubscriptionPayment",
      entityId: payment.id,
      metadataJson: {
        merchantOid: payment.merchantOid,
        status: fields.status,
        failedReasonCode: fields.failedReasonCode,
      },
    },
  });

  return { ok: true };
}
