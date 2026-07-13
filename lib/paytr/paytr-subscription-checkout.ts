import { createHash } from "crypto";
import type { BillingInterval, Plan, Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { computePlanPrice, CheckoutValidationError, type CheckoutBillingInterval } from "@/lib/wexon-checkout-validation";
import {
  amountToMinorUnit,
  buildPaytrIframeTokenRequest,
  buildUserBasketForSubscription,
  createPaytrIframeToken,
  generateMerchantOid,
  getPaytrReturnUrls,
  hashPaytrToken,
  isPaytrRecurringEnabled,
  isPaytrSubscriptionEnabled,
  loadPaytrSubscriptionCredentials,
  PaytrSubscriptionError,
} from "@/lib/paytr/paytr-client";

export type CreateSubscriptionIframeCheckoutInput = {
  organizationId: string;
  userId: string;
  planId: string;
  billingInterval: CheckoutBillingInterval;
  email: string;
  userName: string;
  userPhone?: string | null;
  userIp: string;
  idempotencyKey?: string | null;
  fetchImpl?: typeof fetch;
};

function toBillingInterval(interval: CheckoutBillingInterval): BillingInterval {
  return interval === "yearly" ? "YEARLY" : "MONTHLY";
}

function resolveClientIp(rawIp?: string | null): string {
  const candidate = rawIp?.trim();
  if (candidate) {
    const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-f:]+$/i;
    if (ipv4.test(candidate) || ipv6.test(candidate)) return candidate;
  }
  return "1.1.1.1";
}

export async function createPaytrSubscriptionIframeCheckout(input: CreateSubscriptionIframeCheckoutInput) {
  if (!isPaytrSubscriptionEnabled()) {
    throw new PaytrSubscriptionError("PayTR abonelik ödemesi şu an kapalı.", "disabled");
  }
  if (isPaytrRecurringEnabled()) {
    throw new PaytrSubscriptionError("Recurring henüz production için hazır değil.", "recurring_blocked");
  }

  const plan = await prisma.plan.findFirst({
    where: { id: input.planId, isActive: true, isPublic: true },
    include: { product: true },
  });
  if (!plan || !plan.product.isActive || plan.product.status !== "ACTIVE") {
    throw new CheckoutValidationError("Seçilen paket bulunamadı veya aktif değil.");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      status: "ACTIVE",
    },
  });
  if (!membership) {
    throw new PaytrSubscriptionError("Organizasyon erişimi doğrulanamadı.", "forbidden");
  }

  const existingActiveLicense = await prisma.license.findFirst({
    where: {
      organizationId: input.organizationId,
      productId: plan.productId,
      status: "ACTIVE",
    },
  });
  if (existingActiveLicense) {
    throw new CheckoutValidationError("Bu organizasyon için aktif abonelik zaten bulunuyor.");
  }

  let price;
  try {
    price = computePlanPrice(plan, input.billingInterval);
  } catch (error) {
    if (error instanceof CheckoutValidationError) throw error;
    throw new CheckoutValidationError("Fiyat hesaplanamadı.");
  }

  if (input.idempotencyKey) {
    const existing = await prisma.subscriptionPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && existing.organizationId === input.organizationId && existing.paytrTokenHash) {
      // Token itself is not stored; client must create a fresh session if needed.
      return {
        paymentId: existing.id,
        merchantOid: existing.merchantOid,
        amount: Number(existing.amount),
        currency: existing.currency,
        reused: true as const,
      };
    }
  }

  const credentials = loadPaytrSubscriptionCredentials();
  const urls = getPaytrReturnUrls();
  const merchantOid = generateMerchantOid();
  const amountMinor = amountToMinorUnit(price.total);
  const userBasketBase64 = buildUserBasketForSubscription({ planName: plan.name, total: price.total });
  const userIp = resolveClientIp(input.userIp);

  const payment = await prisma.subscriptionPayment.create({
    data: {
      organizationId: input.organizationId,
      planId: plan.id,
      userId: input.userId,
      provider: "PAYTR",
      providerMode: "iframe",
      merchantOid,
      amount: price.total,
      amountMinor,
      currency: price.currency,
      taxRatePct: price.taxRatePct,
      billingInterval: toBillingInterval(input.billingInterval),
      status: "INITIATED",
      idempotencyKey: input.idempotencyKey || null,
    },
  });

  const formBody = buildPaytrIframeTokenRequest({
    credentials,
    userIp,
    merchantOid,
    email: input.email,
    paymentAmountMinor: amountMinor,
    userBasketBase64,
    userName: input.userName || "Wexon Musteri",
    userAddress: "TR",
    userPhone: input.userPhone?.trim() || "05000000000",
    merchantOkUrl: `${urls.okUrl}?paymentId=${encodeURIComponent(payment.id)}`,
    merchantFailUrl: `${urls.failUrl}?paymentId=${encodeURIComponent(payment.id)}`,
    currency: price.currency,
  });

  try {
    const token = await createPaytrIframeToken(formBody, input.fetchImpl);
    const updated = await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING_CALLBACK",
        paytrTokenHash: hashPaytrToken(token.iframeToken),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "billing.paytr.iframe_token_created",
        entityType: "SubscriptionPayment",
        entityId: updated.id,
        metadataJson: {
          merchantOid,
          planId: plan.id,
          amount: price.total,
          currency: price.currency,
          testMode: process.env.PAYTR_TEST_MODE !== "false",
        },
      },
    });

    return {
      paymentId: updated.id,
      merchantOid: updated.merchantOid,
      iframeToken: token.iframeToken,
      iframeUrl: token.iframeUrl,
      amount: price.total,
      currency: price.currency,
      subtotal: price.subtotal,
      tax: price.tax,
      taxRatePct: price.taxRatePct,
      planName: plan.name,
      reused: false as const,
    };
  } catch (error) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failedReasonMsg: error instanceof Error ? error.message : "Token oluşturulamadı",
      },
    });
    throw error;
  }
}

export function assertNoClientPriceTrust(clientAmount: unknown, serverTotal: number) {
  if (clientAmount == null || clientAmount === "") return;
  const n = typeof clientAmount === "number" ? clientAmount : Number(String(clientAmount));
  if (Number.isFinite(n) && Math.round(n) !== Math.round(serverTotal)) {
    throw new CheckoutValidationError("İstemci tutarı yok sayıldı; fiyat sunucudan hesaplanır.");
  }
}

export function fingerprintPlan(plan: Plan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: plan.id,
        priceMonthly: plan.priceMonthly?.toString(),
        priceYearly: plan.priceYearly?.toString(),
        taxRatePct: plan.taxRatePct,
        currency: plan.currency,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

export type { Prisma };
