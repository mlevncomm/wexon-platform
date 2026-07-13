export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export type CheckoutPlanKey = "basic" | "standard" | "pro";
export type CheckoutBillingInterval = "monthly" | "yearly";

export type PlanPriceSource = {
  priceMonthly?: unknown;
  priceYearly?: unknown;
  priceOneTime?: unknown;
  currency?: string | null;
  taxRatePct?: number | null;
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
  const planKey = value.toLowerCase();
  if (!["basic", "standard", "pro"].includes(planKey)) throw new CheckoutValidationError("Geçersiz paket seçimi.");
  return planKey as CheckoutPlanKey;
}

function normalizeInterval(value: string): CheckoutBillingInterval {
  const interval = value.toLowerCase() || "monthly";
  if (!["monthly", "yearly"].includes(interval)) throw new CheckoutValidationError("Geçersiz faturalama tipi.");
  return interval as CheckoutBillingInterval;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Compute subscription checkout totals from a DB Plan row.
 * Tax uses plan.taxRatePct (default 20).
 */
export function computePlanPrice(plan: PlanPriceSource, interval: CheckoutBillingInterval | "one_time") {
  const taxRatePct = typeof plan.taxRatePct === "number" && Number.isFinite(plan.taxRatePct) ? plan.taxRatePct : 20;
  const currency = (plan.currency ?? "TRY").toUpperCase();

  let raw: number | null = null;
  if (interval === "yearly") raw = toNumber(plan.priceYearly);
  else if (interval === "one_time") raw = toNumber(plan.priceOneTime);
  else raw = toNumber(plan.priceMonthly);

  if (raw == null) {
    throw new CheckoutValidationError("Seçilen faturalama aralığı için fiyat tanımlı değil.");
  }

  const subtotal = Math.round(raw);
  const tax = Math.round(subtotal * (taxRatePct / 100));
  const total = subtotal + tax;
  return { subtotal, tax, total, currency, taxRatePct };
}

/** Narrow fallback used only when a DB plan price is unavailable. */
export function checkoutPrice(
  _productKey: "wexpay",
  planKey: CheckoutPlanKey,
  interval: CheckoutBillingInterval,
) {
  const fallback: Record<CheckoutPlanKey, { monthly: number; yearly: number }> = {
    basic: { monthly: 1490, yearly: 14900 },
    standard: { monthly: 2990, yearly: 29900 },
    pro: { monthly: 5990, yearly: 59900 },
  };
  return computePlanPrice(
    {
      priceMonthly: fallback[planKey].monthly,
      priceYearly: fallback[planKey].yearly,
      currency: "TRY",
      taxRatePct: 20,
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
