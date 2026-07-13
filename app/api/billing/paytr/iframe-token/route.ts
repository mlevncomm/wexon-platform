import { NextResponse } from "next/server";
import { getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { CheckoutValidationError } from "@/lib/wexon-checkout-validation";
import { createPaytrSubscriptionIframeCheckout } from "@/lib/paytr/paytr-subscription-checkout";
import { isPaytrSubscriptionEnabled, PaytrSubscriptionError } from "@/lib/paytr/paytr-client";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/wexon-rate-limit";
import { getRequestIpAddress } from "@/lib/wexon-server-request";

export const runtime = "nodejs";

type TokenBody = {
  planId?: string;
  billingPeriod?: string;
  billingInterval?: string;
  organizationId?: string;
  amount?: number | string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  if (!isPaytrSubscriptionEnabled()) {
    return NextResponse.json(
      { error: "paytr_subscription_disabled", message: "PayTR abonelik ödemesi kapalı." },
      { status: 403 },
    );
  }

  const user = await getCurrentCustomerUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = getRequestIpAddress(request) ?? "unknown";
  const rate = enforceRateLimit("billing.paytr.iframe_token", `${user.id}:${ip}`, RATE_LIMITS.publicQrCheckout);
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: TokenBody = {};
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const billingIntervalRaw = (body.billingInterval || body.billingPeriod || "monthly").toLowerCase();
  const billingInterval = billingIntervalRaw === "yearly" ? "yearly" : "monthly";
  const membership = user.memberships[0];
  const organizationId =
    (typeof body.organizationId === "string" && body.organizationId.trim()) || membership?.organizationId || "";

  if (!planId || !organizationId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!user.memberships.some((m) => m.organizationId === organizationId && m.status === "ACTIVE")) {
    return NextResponse.json({ error: "forbidden_organization" }, { status: 403 });
  }

  // Client-provided amount is intentionally ignored (server computes from DB Plan).
  void body.amount;

  try {
    const result = await createPaytrSubscriptionIframeCheckout({
      organizationId,
      userId: user.id,
      planId,
      billingInterval,
      email: user.email,
      userName: user.name || user.email,
      userPhone: user.phone,
      userIp: ip,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
    });

    if ("reused" in result && result.reused) {
      return NextResponse.json(
        {
          error: "idempotency_reuse_without_token",
          message: "Önceki oturum bulundu; yeni token için yeni idempotencyKey kullanın.",
          paymentId: result.paymentId,
          merchantOid: result.merchantOid,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      iframeToken: result.iframeToken,
      iframeUrl: result.iframeUrl,
      merchantOid: result.merchantOid,
      paymentId: result.paymentId,
      amount: result.amount,
      currency: result.currency,
      subtotal: result.subtotal,
      tax: result.tax,
      taxRatePct: result.taxRatePct,
      planName: result.planName,
    });
  } catch (error) {
    if (error instanceof PaytrSubscriptionError) {
      const status = error.code === "disabled" ? 403 : error.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    if (error instanceof CheckoutValidationError) {
      return NextResponse.json({ error: "validation_error", message: error.message }, { status: 400 });
    }
    console.error("[billing.paytr.iframe-token]", error);
    return NextResponse.json({ error: "token_failed" }, { status: 502 });
  }
}
