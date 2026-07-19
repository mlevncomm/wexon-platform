import { resolveWexPayTierKey } from "@/lib/wexpay-canonical-catalog";
import { getCanonicalTier, listCanonicalTiers } from "@/lib/wexpay-canonical-catalog";
import { buildCheckoutQuote } from "@/lib/wexon-billing-tax-policy";
import { majorFromMinor, parseMajorToMinor } from "@/lib/wexon-billing-money";
import type { CheckoutQuoteSnapshot } from "@/lib/wexon-billing-tax-policy";

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export type CheckoutPlanKey =
  | "essential"
  | "growth"
  | "scale"
  | "business_suite"
  | "basic"
  | "standard"
  | "pro";
export type CheckoutBillingInterval = "monthly" | "yearly";

export type PlanPriceSource = {
  priceMonthly?: unknown;
  priceYearly?: unknown;
  priceOneTime?: unknown;
  setupFee?: unknown;
  currency?: string | null;
  taxRatePct?: number | null;
  tierKey?: string | null;
  key?: string | null;
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) throw new CheckoutValidationError(`${label} zorunludur.`);
  return value;
}

function normalizeProduct(value: string): "wexpay" {
  const productKey = value.toLowerCase();
  if (productKey !== "wexpay") throw new CheckoutValidationError("Bu ürün için abonelik yakında aktif olacak.");
  return productKey;
}

function normalizePlan(value: string): CheckoutPlanKey {
  const resolved = resolveWexPayTierKey(value);
  if (resolved) return resolved;
  const planKey = value.toLowerCase();
  if (["basic", "standard", "pro"].includes(planKey)) return planKey as CheckoutPlanKey;
  throw new CheckoutValidationError("Geçersiz paket seçimi.");
}

function normalizeInterval(value: string): CheckoutBillingInterval {
  const interval = value.toLowerCase() || "monthly";
  if (!["monthly", "yearly"].includes(interval)) throw new CheckoutValidationError("Geçersiz faturalama tipi.");
  return interval as CheckoutBillingInterval;
}

function subscriptionMinorFromPlan(plan: PlanPriceSource, interval: CheckoutBillingInterval | "one_time"): number {
  const tierKey = resolveWexPayTierKey(plan.tierKey ?? plan.key ?? null);
  if (tierKey) {
    const tier = getCanonicalTier(tierKey);
    if (interval === "yearly") {
      if (tier.yearlyPriceMinor == null) {
        throw new CheckoutValidationError("Seçilen faturalama aralığı için fiyat tanımlı değil.");
      }
      return tier.yearlyPriceMinor;
    }
    if (interval === "one_time") {
      throw new CheckoutValidationError("Tek seferlik abonelik fiyatı desteklenmiyor; aktivasyon bedeli ayrıdır.");
    }
    return tier.monthlyPriceMinor;
  }

  let rawMinor: number | null = null;
  if (interval === "yearly") rawMinor = parseMajorToMinor(plan.priceYearly);
  else if (interval === "one_time") rawMinor = parseMajorToMinor(plan.priceOneTime);
  else rawMinor = parseMajorToMinor(plan.priceMonthly);

  if (rawMinor == null) {
    throw new CheckoutValidationError("Seçilen faturalama aralığı için fiyat tanımlı değil.");
  }
  return rawMinor;
}

/**
 * Server-authoritative subscription period price (major units) for legacy display.
 * Tax uses canonical billing tax policy (default: disabled).
 * Does NOT include activation fee — use computeCheckoutQuote.
 */
export function computePlanPrice(plan: PlanPriceSource, interval: CheckoutBillingInterval | "one_time") {
  const quote = computeCheckoutQuote({
    plan,
    interval,
    activationFeeAmountMinor: 0,
  });
  return {
    subtotal: majorFromMinor(quote.netAmountMinor),
    tax: majorFromMinor(quote.taxAmountMinor),
    total: majorFromMinor(quote.grossAmountMinor),
    currency: quote.currency,
    taxRatePct: Math.round(quote.taxRateBps / 100),
  };
}

export function computeCheckoutQuote(input: {
  plan: PlanPriceSource;
  interval: CheckoutBillingInterval | "one_time";
  activationFeeAmountMinor: number;
}): CheckoutQuoteSnapshot {
  const subscriptionAmountMinor = subscriptionMinorFromPlan(input.plan, input.interval);
  const currency = (input.plan.currency ?? "TRY").toUpperCase();
  return buildCheckoutQuote({
    subscriptionAmountMinor,
    activationFeeAmountMinor: input.activationFeeAmountMinor,
    currency,
  });
}

/** Narrow fallback used only when a DB plan price is unavailable — from canonical catalog. */
export function checkoutPrice(
  _productKey: "wexpay",
  planKey: CheckoutPlanKey,
  interval: CheckoutBillingInterval,
) {
  const resolved = resolveWexPayTierKey(planKey) ?? "essential";
  const tier = getCanonicalTier(resolved);
  if (resolved === "business_suite" && interval === "yearly") {
    throw new CheckoutValidationError("WexPay Enterprise yıllık fiyatı özel teklifle belirlenir.");
  }
  return computePlanPrice(
    {
      tierKey: tier.tierKey,
      key: tier.planKey,
      priceMonthly: majorFromMinor(tier.monthlyPriceMinor),
      priceYearly: tier.yearlyPriceMinor == null ? null : majorFromMinor(tier.yearlyPriceMinor),
      currency: "TRY",
    },
    interval,
  );
}

export function parseCheckoutPayload(formData: FormData, hasCustomerSession: boolean) {
  const productKey = normalizeProduct(requiredString(formData, "productKey", "Ürün"));
  const planKey = normalizePlan(requiredString(formData, "planKey", "Paket"));
  const billingInterval = normalizeInterval(requiredString(formData, "billingInterval", "Faturalama tipi"));
  const email = requiredString(formData, "email", "E-posta").toLowerCase();
  const password = readString(formData, "password");
  const passwordConfirm = readString(formData, "passwordConfirm");

  if (planKey === "business_suite") {
    throw new CheckoutValidationError("WexPay Enterprise self-serve checkout ile açılamaz. Lütfen teklif için iletişime geçin.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutValidationError("Geçerli bir e-posta adresi girin.");
  if (!hasCustomerSession) {
    if (!password) throw new CheckoutValidationError("Şifre zorunludur.");
    if (password.length < 8) throw new CheckoutValidationError("Şifre en az 8 karakter olmalıdır.");
    if (password !== passwordConfirm) throw new CheckoutValidationError("Şifre ve tekrarı eşleşmiyor.");
  }

  return {
    productKey,
    planKey,
    billingInterval,
    name: requiredString(formData, "name", "Yetkili adı"),
    email,
    password,
    organizationName: requiredString(formData, "organizationName", "İşletme / organizasyon adı"),
    phone: readString(formData, "phone") || null,
    country: (readString(formData, "country") || "TR").toUpperCase(),
  };
}

export function catalogCheckoutFallbackTable() {
  return listCanonicalTiers().map((t) => ({
    tierKey: t.tierKey,
    monthly: majorFromMinor(t.monthlyPriceMinor),
    yearly: t.yearlyPriceMinor == null ? null : majorFromMinor(t.yearlyPriceMinor),
    activation: majorFromMinor(t.activationFeeMinor),
  }));
}
