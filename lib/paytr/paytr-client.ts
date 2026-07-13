import {
  amountToMinorUnit,
  buildPaytrIframeTokenHash,
  generateMerchantOid,
  hashPaytrToken,
} from "@/lib/paytr/paytr-hash";
import type {
  PaytrIframeTokenRequest,
  PaytrIframeTokenResult,
  PaytrSubscriptionCredentials,
} from "@/lib/paytr/paytr-types";

const PAYTR_GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const PAYTR_IFRAME_BASE = "https://www.paytr.com/odeme/guvenli/";

export class PaytrSubscriptionError extends Error {
  constructor(
    message: string,
    readonly code: string = "paytr_error",
  ) {
    super(message);
    this.name = "PaytrSubscriptionError";
  }
}

export function isPaytrSubscriptionEnabled(): boolean {
  return (
    process.env.PAYTR_SUBSCRIPTION_ENABLE_API === "true" &&
    process.env.PAYTR_IFRAME_ENABLE_API === "true"
  );
}

export function isPaytrTestMode(): boolean {
  return process.env.PAYTR_TEST_MODE !== "false";
}

export function isPaytrDebugOn(): boolean {
  return process.env.PAYTR_DEBUG_ON === "true";
}

export function isPaytrRecurringEnabled(): boolean {
  return process.env.PAYTR_RECURRING_ENABLE_API === "true";
}

export function getPaytrPublicOrigin(): string {
  const origin =
    process.env.NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return origin.replace(/\/$/, "");
}

export function getPaytrCallbackUrl(): string {
  const origin = getPaytrPublicOrigin();
  if (!origin) {
    throw new PaytrSubscriptionError("NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN veya NEXT_PUBLIC_APP_URL gerekli.", "config");
  }
  return `${origin}/api/billing/paytr/callback`;
}

export function getPaytrReturnUrls() {
  const origin = getPaytrPublicOrigin();
  if (!origin) {
    throw new PaytrSubscriptionError("NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN veya NEXT_PUBLIC_APP_URL gerekli.", "config");
  }
  return {
    okUrl: `${origin}/billing/paytr/success`,
    failUrl: `${origin}/billing/paytr/fail`,
    callbackUrl: `${origin}/api/billing/paytr/callback`,
  };
}

export function loadPaytrSubscriptionCredentials(): PaytrSubscriptionCredentials {
  const merchantId = process.env.PAYTR_MERCHANT_ID?.trim() ?? "";
  const merchantKey = process.env.PAYTR_MERCHANT_KEY?.trim() ?? "";
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT?.trim() ?? "";
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new PaytrSubscriptionError("PayTR merchant kimlik bilgileri eksik.", "credentials");
  }
  return { merchantId, merchantKey, merchantSalt };
}

export function buildUserBasketForSubscription(input: {
  planName: string;
  total: number;
}): string {
  const basket = [[`${input.planName} abonelik`, String(input.total), 1]];
  return Buffer.from(JSON.stringify(basket)).toString("base64");
}

export function buildPaytrIframeTokenRequest(
  input: Omit<PaytrIframeTokenRequest, "merchantId" | "testMode" | "debugOn"> & {
    credentials: PaytrSubscriptionCredentials;
  },
): Record<string, string> {
  const testMode = isPaytrTestMode();
  const debugOn = isPaytrDebugOn();
  const noInstallment = input.noInstallment === false ? false : true;
  const request: PaytrIframeTokenRequest = {
    merchantId: input.credentials.merchantId,
    userIp: input.userIp,
    merchantOid: input.merchantOid,
    email: input.email,
    paymentAmountMinor: input.paymentAmountMinor,
    userBasketBase64: input.userBasketBase64,
    userName: input.userName,
    userAddress: input.userAddress,
    userPhone: input.userPhone,
    merchantOkUrl: input.merchantOkUrl,
    merchantFailUrl: input.merchantFailUrl,
    currency: input.currency.toUpperCase(),
    testMode,
    debugOn,
    noInstallment,
    maxInstallment: input.maxInstallment ?? 0,
    timeoutLimit: input.timeoutLimit ?? 30,
    lang: input.lang ?? "tr",
  };

  const paytrToken = buildPaytrIframeTokenHash({
    ...request,
    merchantKey: input.credentials.merchantKey,
    merchantSalt: input.credentials.merchantSalt,
  });

  return {
    merchant_id: request.merchantId,
    user_ip: request.userIp,
    merchant_oid: request.merchantOid,
    email: request.email,
    payment_amount: String(request.paymentAmountMinor),
    paytr_token: paytrToken,
    user_basket: request.userBasketBase64,
    debug_on: request.debugOn ? "1" : "0",
    test_mode: request.testMode ? "1" : "0",
    no_installment: noInstallment ? "1" : "0",
    max_installment: String(request.maxInstallment ?? 0),
    user_name: request.userName,
    user_address: request.userAddress,
    user_phone: request.userPhone,
    merchant_ok_url: request.merchantOkUrl,
    merchant_fail_url: request.merchantFailUrl,
    timeout_limit: String(request.timeoutLimit ?? 30),
    currency: request.currency,
    lang: request.lang ?? "tr",
  };
}

export async function createPaytrIframeToken(
  formBody: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<PaytrIframeTokenResult> {
  const response = await fetchImpl(PAYTR_GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(formBody),
  });

  let body: { status?: string; token?: string; reason?: string } = {};
  try {
    body = (await response.json()) as { status?: string; token?: string; reason?: string };
  } catch {
    throw new PaytrSubscriptionError("PayTR token yanıtı okunamadı.", "token_parse");
  }

  if (body.status !== "success" || !body.token) {
    throw new PaytrSubscriptionError(body.reason ?? "PayTR token isteği başarısız.", "token_failed");
  }

  return {
    iframeToken: body.token,
    iframeUrl: `${PAYTR_IFRAME_BASE}${body.token}`,
  };
}

export { amountToMinorUnit, generateMerchantOid, hashPaytrToken };
