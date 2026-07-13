import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { PaytrCallbackFields, PaytrIframeTokenRequest } from "@/lib/paytr/paytr-types";

export function amountToMinorUnit(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Geçersiz tutar.");
  }
  return Math.round(amount * 100);
}

export function generateMerchantOid(prefix = "wxsub"): string {
  const stamp = Date.now().toString(36);
  const rand = createHash("sha256").update(`${stamp}:${Math.random()}`).digest("hex").slice(0, 10);
  // PayTR merchant_oid: alphanumeric, unique, typically <= 64 chars
  return `${prefix}${stamp}${rand}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
}

export function buildPaytrIframeTokenHash(
  request: Pick<
    PaytrIframeTokenRequest,
    | "merchantId"
    | "userIp"
    | "merchantOid"
    | "email"
    | "paymentAmountMinor"
    | "userBasketBase64"
    | "noInstallment"
    | "maxInstallment"
    | "currency"
    | "testMode"
  > & { merchantKey: string; merchantSalt: string },
): string {
  const noInstallment = request.noInstallment === false ? "0" : "1";
  const maxInstallment = String(request.maxInstallment ?? 0);
  const testMode = request.testMode ? "1" : "0";
  const hashStr = [
    request.merchantId,
    request.userIp,
    request.merchantOid,
    request.email,
    String(request.paymentAmountMinor),
    request.userBasketBase64,
    noInstallment,
    maxInstallment,
    request.currency.toUpperCase(),
    testMode,
  ].join("");

  return createHmac("sha256", request.merchantKey)
    .update(`${hashStr}${request.merchantSalt}`)
    .digest("base64");
}

export function buildPaytrCallbackHash(input: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}): string {
  const payload = `${input.merchantOid}${input.merchantSalt}${input.status}${input.totalAmount}`;
  return createHmac("sha256", input.merchantKey).update(payload).digest("base64");
}

export function verifyPaytrCallbackHash(
  fields: PaytrCallbackFields,
  credentials: { merchantKey: string; merchantSalt: string },
): boolean {
  const expected = buildPaytrCallbackHash({
    merchantOid: fields.merchantOid,
    merchantSalt: credentials.merchantSalt,
    status: fields.status,
    totalAmount: fields.totalAmount,
    merchantKey: credentials.merchantKey,
  });
  const left = Buffer.from(expected);
  const right = Buffer.from(fields.hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashPaytrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function redactPaytrPayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return { value: "[redacted]" };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("key") ||
      lower.includes("salt") ||
      lower.includes("token") ||
      lower.includes("hash") ||
      lower.includes("password") ||
      lower.includes("secret")
    ) {
      out[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactPaytrPayload(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}
