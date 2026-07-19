import { createHash } from "crypto";
import type { BillingInterval, Plan, Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeCheckoutQuote,
  CheckoutValidationError,
  type CheckoutBillingInterval,
} from "@/lib/wexon-checkout-validation";
import {
  ActivationFeeError,
  markActivationFeePaid,
  quoteToLegacyMajorDisplay,
  releaseActivationFeeReservation,
  reserveActivationFeeForCheckout,
  resolveActivationFeeDue,
} from "@/lib/wexon-activation-fee";
import { majorFromMinor } from "@/lib/wexon-billing-money";
import {
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
  if (plan.tierKey === "business_suite" || plan.key === "wexpay_business_suite") {
    throw new CheckoutValidationError("WexPay Enterprise self-serve checkout ile açılamaz.");
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

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { id: true, isDemo: true },
  });

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

  if (input.idempotencyKey) {
    const existing = await prisma.subscriptionPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && existing.organizationId === input.organizationId && existing.paytrTokenHash) {
      return {
        paymentId: existing.id,
        merchantOid: existing.merchantOid,
        amount: Number(existing.amount),
        currency: existing.currency,
        reused: true as const,
      };
    }
  }

  const due = await resolveActivationFeeDue(prisma, {
    organizationId: input.organizationId,
    productId: plan.productId,
    plan,
    isDemo: organization.isDemo,
  });

  let quote;
  try {
    quote = computeCheckoutQuote({
      plan,
      interval: input.billingInterval,
      activationFeeAmountMinor: due.due ? due.amountMinor : 0,
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) throw error;
    throw new CheckoutValidationError("Fiyat hesaplanamadı.");
  }

  const display = quoteToLegacyMajorDisplay(quote);
  const credentials = loadPaytrSubscriptionCredentials();
  const urls = getPaytrReturnUrls();
  const merchantOid = generateMerchantOid();
  const amountMinor = quote.grossAmountMinor;
  const userBasketBase64 = buildUserBasketForSubscription({
    planName: plan.name,
    total: display.total,
  });
  const userIp = resolveClientIp(input.userIp);

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.subscriptionPayment.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        userId: input.userId,
        provider: "PAYTR",
        providerMode: "iframe",
        merchantOid,
        amount: display.total,
        amountMinor,
        currency: quote.currency,
        taxRatePct: Math.round(quote.taxRateBps / 100),
        subscriptionAmountMinor: quote.subscriptionAmountMinor,
        activationFeeAmountMinor: quote.activationFeeAmountMinor,
        netAmountMinor: quote.netAmountMinor,
        taxRateBps: quote.taxRateBps,
        taxAmountMinor: quote.taxAmountMinor,
        grossAmountMinor: quote.grossAmountMinor,
        taxEnabledAtPurchase: quote.taxEnabledAtPurchase,
        taxModeAtPurchase: quote.taxModeAtPurchase,
        billingInterval: toBillingInterval(input.billingInterval),
        status: "INITIATED",
        idempotencyKey: input.idempotencyKey || null,
      },
    });

    if (due.due && due.amountMinor > 0) {
      try {
        await reserveActivationFeeForCheckout(tx, {
          organizationId: input.organizationId,
          productId: plan.productId,
          planId: plan.id,
          activationFeeMinor: due.amountMinor,
          quote,
          subscriptionPaymentId: created.id,
          isDemo: organization.isDemo,
        });
      } catch (error) {
        if (error instanceof ActivationFeeError && error.code === "ACTIVATION_FEE_RESERVED") {
          throw new CheckoutValidationError(error.message);
        }
        throw error;
      }
    }

    return created;
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
    currency: quote.currency,
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
          amount: display.total,
          currency: quote.currency,
          activationFeeAmountMinor: quote.activationFeeAmountMinor,
          grossAmountMinor: quote.grossAmountMinor,
          testMode: process.env.PAYTR_TEST_MODE !== "false",
        },
      },
    });

    return {
      paymentId: updated.id,
      merchantOid: updated.merchantOid,
      iframeToken: token.iframeToken,
      iframeUrl: token.iframeUrl,
      amount: display.total,
      currency: quote.currency,
      subtotal: display.subtotal,
      tax: display.tax,
      taxRatePct: display.taxRatePct,
      activationFee: majorFromMinor(quote.activationFeeAmountMinor),
      planName: plan.name,
      reused: false as const,
    };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failedReasonMsg: error instanceof Error ? error.message : "Token oluşturulamadı",
        },
      });
      await releaseActivationFeeReservation(tx, {
        organizationId: input.organizationId,
        productId: plan.productId,
        subscriptionPaymentId: payment.id,
      });
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
        setupFee: plan.setupFee?.toString(),
        taxRatePct: plan.taxRatePct,
        currency: plan.currency,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

/** Mark activation fee PAID after successful subscription payment (idempotent / ownership-safe). */
export async function settleActivationFeeAfterSubscriptionPaid(paymentId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { plan: true },
  });
  if (!payment) return;
  await prisma.$transaction(async (tx) => {
    await markActivationFeePaid(tx, {
      organizationId: payment.organizationId,
      productId: payment.plan.productId,
      subscriptionPaymentId: payment.id,
      activationFeeAmountMinor: payment.activationFeeAmountMinor,
    });
  });
}

export type { Prisma };
