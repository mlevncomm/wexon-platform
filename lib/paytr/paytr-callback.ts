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
import {
  ActivationFeeError,
  markActivationFeePaid,
  releaseActivationFeeReservation,
} from "@/lib/wexon-activation-fee";

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

type Tx = Prisma.TransactionClient;

async function settleActivationFeeForPayment(
  tx: Tx,
  payment: {
    id: string;
    organizationId: string;
    activationFeeAmountMinor: number | null;
    plan: { productId: string };
  },
) {
  await markActivationFeePaid(tx, {
    organizationId: payment.organizationId,
    productId: payment.plan.productId,
    subscriptionPaymentId: payment.id,
    activationFeeAmountMinor: payment.activationFeeAmountMinor,
  });
}

/**
 * Idempotent subscription activation from a PAID SubscriptionPayment.
 * Safe to retry when payment.subscriptionId is still null after a partial failure.
 */
export async function activateSubscriptionFromPayment(paymentId: string) {
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
  const invoiceNo = `INV-PAYTR-${payment.merchantOid}`.slice(0, 64);

  return prisma.$transaction(async (tx) => {
    // Re-check inside tx to avoid races between concurrent callbacks.
    const fresh = await tx.subscriptionPayment.findUnique({ where: { id: payment.id } });
    if (!fresh || fresh.status !== "PAID") return null;
    if (fresh.subscriptionId) {
      return tx.subscription.findUnique({ where: { id: fresh.subscriptionId } });
    }

    const byProviderRef = await tx.subscription.findFirst({
      where: {
        organizationId: payment.organizationId,
        provider: "paytr",
        providerRef: payment.merchantOid,
      },
    });
    if (byProviderRef) {
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { subscriptionId: byProviderRef.id },
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
          licenseId: byProviderRef.licenseId,
          settingsJson: {
            onboardingStatus: "PENDING_SETUP",
            source: "paytr_subscription_checkout",
          },
        },
        create: {
          organizationId: payment.organizationId,
          productId: product.id,
          licenseId: byProviderRef.licenseId,
          status: "ACTIVE",
          settingsJson: {
            onboardingStatus: "PENDING_SETUP",
            source: "paytr_subscription_checkout",
          },
        },
      });
      return byProviderRef;
    }

    let license = await tx.license.findFirst({
      where: {
        organizationId: payment.organizationId,
        productId: product.id,
        status: "ACTIVE",
      },
    });

    if (license) {
      const existingSub = await tx.subscription.findUnique({ where: { licenseId: license.id } });
      if (existingSub) {
        await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: { subscriptionId: existingSub.id },
        });
        await tx.appInstallation.upsert({
          where: {
            organizationId_productId: {
              organizationId: payment.organizationId,
              productId: product.id,
            },
          },
          update: { status: "ACTIVE", licenseId: license.id },
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
        return existingSub;
      }
    } else {
      license = await tx.license.create({
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
    }

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

    const taxMinor = payment.taxAmountMinor ?? 0;
    const totalMajor = Number(payment.amount);
    const subtotalMajor =
      payment.netAmountMinor != null
        ? payment.netAmountMinor / 100
        : taxMinor > 0
          ? Math.round(totalMajor / (1 + (payment.taxRatePct || 20) / 100))
          : totalMajor;
    const taxMajor =
      payment.taxAmountMinor != null ? payment.taxAmountMinor / 100 : Math.max(0, totalMajor - subtotalMajor);

    const existingInvoice = await tx.invoice.findUnique({ where: { invoiceNo } });
    const invoice =
      existingInvoice ??
      (await tx.invoice.create({
        data: {
          organizationId: payment.organizationId,
          subscriptionId: subscription.id,
          invoiceNo,
          status: "PAID",
          subtotal: subtotalMajor,
          tax: taxMajor,
          total: totalMajor,
          currency: payment.currency,
          issuedAt: now,
          paidAt: now,
        },
      }));

    const existingBilling = await tx.billingPayment.findFirst({
      where: {
        organizationId: payment.organizationId,
        provider: "paytr",
        providerRef: payment.merchantOid,
      },
    });
    if (!existingBilling) {
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
    }

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
  | { ok: true; duplicate?: boolean; activated?: boolean; recovered?: boolean }
  | { ok: false; reason: string; status?: number };

async function auditActivationOwnershipMismatch(input: {
  organizationId: string;
  userId: string | null;
  paymentId: string;
  merchantOid: string;
  code: string;
  duplicatePaid?: boolean;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: "billing.paytr.activation_fee_ownership_mismatch",
      entityType: "SubscriptionPayment",
      entityId: input.paymentId,
      level: "ERROR",
      status: "FAILURE",
      metadataJson: {
        code: input.code,
        merchantOid: input.merchantOid,
        ...(input.duplicatePaid ? { duplicatePaid: true } : {}),
      },
    },
  });
}

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
    include: { plan: true },
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
    try {
      await prisma.$transaction(async (tx) => {
        await settleActivationFeeForPayment(tx, payment);
      });
    } catch (error) {
      if (error instanceof ActivationFeeError) {
        await auditActivationOwnershipMismatch({
          organizationId: payment.organizationId,
          userId: payment.userId,
          paymentId: payment.id,
          merchantOid: payment.merchantOid,
          code: error.code,
          duplicatePaid: true,
        });
        // Ownership mismatch must not open access; payment already PAID is a reconciliation case.
        return { ok: true, duplicate: true };
      }
      throw error;
    }

    if (payment.subscriptionId) {
      return { ok: true, duplicate: true };
    }

    // Self-heal: PAID without linked subscription (activation crashed after settle).
    try {
      const subscription = await activateSubscriptionFromPayment(payment.id);
      if (subscription) {
        await prisma.auditLog.create({
          data: {
            organizationId: payment.organizationId,
            userId: payment.userId,
            action: "billing.paytr.subscription_activation_recovered",
            entityType: "SubscriptionPayment",
            entityId: payment.id,
            metadataJson: {
              merchantOid: payment.merchantOid,
              subscriptionId: subscription.id,
              planId: payment.planId,
            },
          },
        });
        return { ok: true, activated: true, recovered: true };
      }
      return { ok: true, duplicate: true };
    } catch (error) {
      await prisma.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          userId: payment.userId,
          action: "billing.paytr.subscription_activation_recovery_failed",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
          level: "ERROR",
          status: "FAILURE",
          metadataJson: {
            merchantOid: payment.merchantOid,
            errorName: error instanceof Error ? error.name : "Error",
          },
        },
      });
      // Acknowledge to PayTR; leave payment PAID for a later retry.
      return { ok: true };
    }
  }

  const expectedMinor =
    payment.grossAmountMinor != null && payment.grossAmountMinor > 0
      ? payment.grossAmountMinor
      : payment.amountMinor;

  if (success) {
    const callbackMinor = Number(fields.totalAmount);
    if (!Number.isFinite(callbackMinor) || callbackMinor !== expectedMinor) {
      await prisma.$transaction(async (tx) => {
        await tx.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            callbackStatus: fields.status,
            callbackTotalAmount: fields.totalAmount,
            callbackPaymentAmount: fields.paymentAmount,
            callbackCurrency: fields.currency,
            failedReasonCode: "amount_mismatch",
            failedReasonMsg: "Callback tutarı beklenen gross/amountMinor ile eşleşmiyor.",
            rawCallbackJson: asJson(redacted),
          },
        });
        await releaseActivationFeeReservation(tx, {
          organizationId: payment.organizationId,
          productId: payment.plan.productId,
          subscriptionPaymentId: payment.id,
        });
        await tx.auditLog.create({
          data: {
            organizationId: payment.organizationId,
            userId: payment.userId,
            action: "billing.paytr.callback_amount_mismatch",
            entityType: "SubscriptionPayment",
            entityId: payment.id,
            level: "ERROR",
            status: "FAILURE",
            metadataJson: {
              expectedMinor,
              callbackMinor,
              merchantOid: payment.merchantOid,
            },
          },
        });
      });
      return { ok: true };
    }

    // Settle activation ledger + mark payment PAID in one transaction.
    // If activation later fails, a retry can self-heal from PAID + null subscriptionId.
    try {
      await prisma.$transaction(async (tx) => {
        await settleActivationFeeForPayment(tx, payment);
        await tx.subscriptionPayment.update({
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
      });
    } catch (error) {
      if (error instanceof ActivationFeeError) {
        await prisma.$transaction(async (tx) => {
          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: "FAILED",
              callbackStatus: fields.status,
              callbackTotalAmount: fields.totalAmount,
              callbackPaymentAmount: fields.paymentAmount,
              callbackCurrency: fields.currency,
              failedReasonCode: error.code.toLowerCase(),
              failedReasonMsg: error.message,
              rawCallbackJson: asJson(redacted),
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: payment.organizationId,
              userId: payment.userId,
              action: "billing.paytr.activation_fee_ownership_mismatch",
              entityType: "SubscriptionPayment",
              entityId: payment.id,
              level: "ERROR",
              status: "FAILURE",
              metadataJson: {
                code: error.code,
                merchantOid: payment.merchantOid,
              },
            },
          });
        });
        return { ok: true };
      }
      throw error;
    }

    try {
      await activateSubscriptionFromPayment(payment.id);
      return { ok: true, activated: true };
    } catch (error) {
      await prisma.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          userId: payment.userId,
          action: "billing.paytr.subscription_activation_pending_retry",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
          level: "ERROR",
          status: "FAILURE",
          metadataJson: {
            merchantOid: payment.merchantOid,
            errorName: error instanceof Error ? error.name : "Error",
          },
        },
      });
      // Payment remains PAID; PayTR retry / duplicate callback can self-heal.
      return { ok: true };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
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
    await releaseActivationFeeReservation(tx, {
      organizationId: payment.organizationId,
      productId: payment.plan.productId,
      subscriptionPaymentId: payment.id,
    });
    await tx.auditLog.create({
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
  });

  return { ok: true };
}
