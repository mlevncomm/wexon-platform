export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export const checkoutPriceMap = {
  wexpay: {
    basic: { monthly: 1490, yearly: 14900 },
    standard: { monthly: 2990, yearly: 29900 },
    pro: { monthly: 5990, yearly: 59900 },
  },
} as const;

export type CheckoutPlanKey = "basic" | "standard" | "pro";
export type CheckoutBillingInterval = "monthly" | "yearly";

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

export function checkoutPrice(productKey: "wexpay", planKey: CheckoutPlanKey, interval: CheckoutBillingInterval) {
  const subtotal = checkoutPriceMap[productKey][planKey][interval];
  const tax = Math.round(subtotal * 0.2);
  const total = subtotal + tax;
  return { subtotal, tax, total, currency: "TRY" };
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
