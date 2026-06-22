import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { WexPayProviderCredentialMode } from ".prisma/client";
import { PaymentStatus } from ".prisma/client";
import {
  loadActiveProviderCredentialConfig,
  type WexPayProviderCredentialConfig,
} from "@/lib/wexpay-provider-credentials";
import {
  WexPayPaymentProviderError,
  WexPayProviderNotConfiguredError,
  type WexPayPaymentCheckoutContext,
  type WexPayPaymentIntentResult,
  type WexPayProviderCallbackPayload,
  type WexPayProviderCallbackResult,
} from "@/lib/wexpay-payment-provider";

const PAYTR_GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const PAYTR_IFRAME_BASE = "https://www.paytr.com/odeme/guvenli/";

export type PaytrCredentialBundle = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  mode: WexPayProviderCredentialMode;
};

export type PaytrCallbackFields = {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
};

export function mapPaytrCredentialConfig(
  config: WexPayProviderCredentialConfig,
): Omit<PaytrCredentialBundle, "mode"> | null {
  const merchantId = config.merchantId?.trim();
  const merchantKey = (config.apiKey || config.merchantKey || config.secretKey)?.trim();
  const merchantSalt = (config.merchantSalt || config.secret)?.trim();
  if (!merchantId || !merchantKey || !merchantSalt) return null;
  return { merchantId, merchantKey, merchantSalt };
}

export type PaytrCredentialReadiness = {
  ready: boolean;
  messages: string[];
};

/** Local-only PayTR credential validation (no get-token API call). */
export function assertPaytrCredentialReady(
  config: WexPayProviderCredentialConfig,
  mode: WexPayProviderCredentialMode,
): PaytrCredentialReadiness {
  const messages: string[] = [];
  const mapped = mapPaytrCredentialConfig(config);
  if (!mapped) {
    return { ready: false, messages: ["Merchant ID, secret key ve merchant salt eksik veya geçersiz."] };
  }
  if (mode === WexPayProviderCredentialMode.TEST) {
    messages.push("Test modu: PayTR test mağaza bilgileri kullanılmalıdır.");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    messages.push("NEXT_PUBLIC_APP_URL tanımlı değil; checkout yönlendirmeleri çalışmaz.");
  }
  if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
    messages.push(
      "WEXPAY_PAYTR_ENABLE_API=true olmadan canlı PayTR token üretilmez. Yerel yapılandırma doğrulandı.",
    );
  }
  return { ready: true, messages };
}

export async function loadPaytrCredentialBundle(
  organizationId: string,
  mode?: WexPayProviderCredentialMode,
): Promise<PaytrCredentialBundle | null> {
  const modes =
    mode !== undefined
      ? [mode]
      : [WexPayProviderCredentialMode.LIVE, WexPayProviderCredentialMode.TEST];

  for (const candidateMode of modes) {
    const loaded = await loadActiveProviderCredentialConfig(organizationId, "paytr", candidateMode);
    if (!loaded) continue;
    const mapped = mapPaytrCredentialConfig(loaded.config);
    if (!mapped) continue;
    return { ...mapped, mode: candidateMode };
  }
  return null;
}

export function generatePaytrMerchantOid(): string {
  return `WXP${Date.now()}${randomBytes(4).toString("hex")}`.slice(0, 64);
}

export function validatePaytrCheckoutAmount(amount: number, currency: string) {
  if (currency.trim().toUpperCase() !== "TRY") {
    throw new WexPayPaymentProviderError("PayTR yalnızca TRY operasyonel ödemelerini destekler.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WexPayPaymentProviderError("Geçerli ve sıfırdan büyük bir tutar girin.");
  }
  return Math.round(amount * 100);
}

export function buildPaytrCheckoutUrls() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl) {
    throw new WexPayPaymentProviderError("NEXT_PUBLIC_APP_URL tanımlı olmalıdır.");
  }
  return {
    callbackUrl: `${appUrl}/api/wexpay/webhooks/paytr`,
    successUrl: `${appUrl}/apps/wexpay/payments?paytr=success`,
    failUrl: `${appUrl}/apps/wexpay/payments?paytr=failed`,
  };
}

export function buildPaytrGetTokenPayload(input: {
  credentials: PaytrCredentialBundle;
  context: WexPayPaymentCheckoutContext;
  merchantOid: string;
  paymentAmountKurus: number;
  userIp: string;
  urls: ReturnType<typeof buildPaytrCheckoutUrls>;
}) {
  const testMode = input.credentials.mode === WexPayProviderCredentialMode.TEST ? "1" : "0";
  const email = "wexpay@tenant.local";
  const userBasket = Buffer.from(JSON.stringify([["WexPay operasyon odemesi", input.context.amount, 1]])).toString(
    "base64",
  );
  const hashStr = [
    input.credentials.merchantId,
    input.userIp,
    input.merchantOid,
    email,
    String(input.paymentAmountKurus),
    userBasket,
    "0",
    "0",
    input.context.currency.toUpperCase(),
    testMode,
  ].join("");
  const paytrToken = createHmac("sha256", input.credentials.merchantKey)
    .update(`${hashStr}${input.credentials.merchantSalt}`)
    .digest("base64");

  return {
    merchant_id: input.credentials.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email,
    payment_amount: String(input.paymentAmountKurus),
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: testMode,
    test_mode: testMode,
    no_installment: "0",
    max_installment: "0",
    user_name: "WexPay",
    user_address: "TR",
    user_phone: "05000000000",
    merchant_ok_url: input.urls.successUrl,
    merchant_fail_url: input.urls.failUrl,
    timeout_limit: "30",
    currency: input.context.currency.toUpperCase(),
    lang: "tr",
  };
}

export function verifyPaytrCallbackHash(input: PaytrCallbackFields & { merchantKey: string; merchantSalt: string }) {
  const payload = `${input.merchantOid}${input.merchantSalt}${input.status}${input.totalAmount}`;
  const expected = createHmac("sha256", input.merchantKey).update(payload).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(input.hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parsePaytrCallbackFields(rawBody: string): PaytrCallbackFields | null {
  const params = new URLSearchParams(rawBody);
  const merchantOid = params.get("merchant_oid")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const totalAmount = params.get("total_amount")?.trim() ?? "";
  const hash = params.get("hash")?.trim() ?? "";
  if (!merchantOid || !status || !totalAmount || !hash) return null;
  return { merchantOid, status, totalAmount, hash };
}

export function paytrWebhookEventId(fields: PaytrCallbackFields) {
  return `${fields.merchantOid}:${fields.status}:${fields.totalAmount}`;
}

export function mapPaytrCallbackStatus(status: string): PaymentStatus {
  return status.trim().toLowerCase() === "success" ? PaymentStatus.PAID : PaymentStatus.FAILED;
}

export function resolvePaytrClientIp(rawIp?: string | null): string {
  const candidate = rawIp?.trim();
  if (candidate) {
    const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-f:]+$/i;
    if (ipv4.test(candidate) || ipv6.test(candidate)) {
      return candidate;
    }
  }
  return "1.1.1.1";
}

export function paytrPaymentAmountKurus(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function verifyPaytrCallbackAmount(paymentAmount: number, totalAmountKurusRaw: string): boolean {
  const callbackKurus = Number(totalAmountKurusRaw);
  if (!Number.isFinite(callbackKurus)) return false;
  return paytrPaymentAmountKurus(paymentAmount) === callbackKurus;
}

async function requestPaytrCheckoutToken(input: {
  credentials: PaytrCredentialBundle;
  context: WexPayPaymentCheckoutContext;
  merchantOid: string;
  paymentAmountKurus: number;
  userIp: string;
  urls: ReturnType<typeof buildPaytrCheckoutUrls>;
}) {
  const tokenPayload = buildPaytrGetTokenPayload({
    credentials: input.credentials,
    context: input.context,
    merchantOid: input.merchantOid,
    paymentAmountKurus: input.paymentAmountKurus,
    userIp: input.userIp,
    urls: input.urls,
  });
  const response = await fetch(PAYTR_GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenPayload),
  });
  const body = (await response.json()) as { status?: string; token?: string; reason?: string };
  if (body.status !== "success" || !body.token) {
    throw new WexPayPaymentProviderError(body.reason ?? "PayTR token isteği başarısız.");
  }
  return { externalCheckoutUrl: `${PAYTR_IFRAME_BASE}${body.token}`, iframeToken: body.token };
}

async function createPaytrPaymentIntent(context: WexPayPaymentCheckoutContext): Promise<WexPayPaymentIntentResult> {
  const credentials = await loadPaytrCredentialBundle(context.organizationId);
  if (!credentials) {
    throw new WexPayProviderNotConfiguredError("paytr");
  }

  const paymentAmountKurus = validatePaytrCheckoutAmount(context.amount, context.currency);
  const merchantOid = context.existingProviderRef?.trim() || generatePaytrMerchantOid();
  const baseUrls = buildPaytrCheckoutUrls();
  const urls = context.checkoutRedirect
    ? { ...baseUrls, successUrl: context.checkoutRedirect.successUrl, failUrl: context.checkoutRedirect.failUrl }
    : baseUrls;
  const enableApi = process.env.WEXPAY_PAYTR_ENABLE_API === "true";
  if (!enableApi) {
    throw new WexPayPaymentProviderError(
      "PayTR sanal POS API henüz etkin değil. Operasyonel tahsilat başlatılamaz.",
    );
  }

  const userIp = resolvePaytrClientIp(context.clientIp);
  const { externalCheckoutUrl, iframeToken } = await requestPaytrCheckoutToken({
    credentials,
    context,
    merchantOid,
    paymentAmountKurus,
    userIp,
    urls,
  });

  if (!externalCheckoutUrl) {
    throw new WexPayPaymentProviderError("PayTR ödeme oturumu oluşturulamadı. Lütfen tekrar deneyin.");
  }

  return {
    provider: "paytr",
    providerRef: merchantOid,
    externalCheckoutUrl,
    requiresExternalCheckout: true,
    metadata: {
      mode: credentials.mode,
      paymentAmountKurus,
      callbackUrl: urls.callbackUrl,
      successUrl: urls.successUrl,
      failUrl: urls.failUrl,
      iframeTokenPresent: Boolean(iframeToken),
    },
  };
}

async function verifyPaytrCallback(payload: WexPayProviderCallbackPayload): Promise<WexPayProviderCallbackResult> {
  if (typeof payload.rawPayload !== "string") {
    throw new WexPayPaymentProviderError("PayTR callback raw body gerekli.");
  }
  const fields = parsePaytrCallbackFields(payload.rawPayload);
  if (!fields) {
    throw new WexPayPaymentProviderError("PayTR callback alanları eksik.");
  }

  return {
    providerRef: fields.merchantOid,
    status: mapPaytrCallbackStatus(fields.status),
    amount: Number(fields.totalAmount) / 100,
    verified: false,
  };
}

export const paytrAdapter = {
  key: "paytr" as const,
  createPaymentIntent: createPaytrPaymentIntent,
  createCheckoutSession: createPaytrPaymentIntent,
  verifyCallback: verifyPaytrCallback,
  mapProviderStatus(rawStatus: string): PaymentStatus {
    const normalized = rawStatus.trim().toLowerCase();
    if (normalized === "success") return PaymentStatus.PAID;
    if (normalized === "failed") return PaymentStatus.FAILED;
    throw new WexPayPaymentProviderError(`Bilinmeyen PayTR durumu: ${rawStatus}`);
  },
};
