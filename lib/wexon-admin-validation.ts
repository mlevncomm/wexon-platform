export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminValidationError";
  }
}

const licenseStatuses = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"] as const;
const invoiceStatuses = ["DRAFT", "ISSUED", "PAID", "VOID", "OVERDUE"] as const;
const productStatuses = ["ACTIVE", "UPCOMING", "INTERNAL", "DISABLED"] as const;
const subscriptionStatuses = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED", "EXPIRED"] as const;
const licenseTypes = ["MONTHLY", "YEARLY", "ONE_TIME"] as const;
const appInstallationStatuses = ["ACTIVE", "DISABLED"] as const;
const membershipRoles = ["OWNER", "ADMIN", "MANAGER", "STAFF", "BILLING", "VIEWER"] as const;
const membershipStatuses = ["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"] as const;
const billingIntervals = ["MONTHLY", "YEARLY", "ONE_TIME"] as const;
const billingPaymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
const entitlementValueTypes = ["BOOLEAN", "INTEGER", "STRING"] as const;
const supportTicketStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

type LicenseStatusInput = (typeof licenseStatuses)[number];
type LicenseTypeInput = (typeof licenseTypes)[number];
type AppInstallationStatusInput = (typeof appInstallationStatuses)[number];
type MembershipRoleInput = (typeof membershipRoles)[number];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) {
    throw new AdminValidationError(`${label} zorunludur.`);
  }
  return value;
}

function nullableString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value || null;
}

export function normalizeAdminSlug(value: string) {
  const slug = value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new AdminValidationError("Slug zorunludur.");
  }

  return slug;
}

export function readReturnTo(formData: FormData, fallback: string) {
  const value = readString(formData, "returnTo");
  return value.startsWith("/") ? value : fallback;
}

function parseBoolean(formData: FormData, key: string) {
  return readString(formData, key) === "true";
}

function parseCountry(formData: FormData) {
  return (readString(formData, "country") || "TR").toUpperCase();
}

function parseEmail(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminValidationError("Geçerli bir e-posta adresi girin.");
  }
  return email;
}

function parseDate(formData: FormData, key: string, label: string, required: boolean) {
  const value = readString(formData, key);
  if (!value) {
    if (required) {
      throw new AdminValidationError(`${label} zorunludur.`);
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminValidationError(`${label} geçerli bir tarih olmalıdır.`);
  }
  return date;
}

function oneOf<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
  if (!allowed.includes(value)) {
    throw new AdminValidationError(`${label} geçersiz.`);
  }
  return value as T[number];
}

export function parseOrganizationPayload(formData: FormData) {
  return {
    name: requiredString(formData, "name", "Organizasyon adı"),
    slug: normalizeAdminSlug(requiredString(formData, "slug", "Slug")),
    legalName: nullableString(formData, "legalName"),
    taxNo: nullableString(formData, "taxNo"),
    email: parseEmail(formData),
    phone: nullableString(formData, "phone"),
    country: parseCountry(formData),
    isDemo: parseBoolean(formData, "isDemo"),
    isActive: parseBoolean(formData, "isActive"),
  };
}

function parseDecimal(formData: FormData, key: string, label: string, required = true) {
  const value = readString(formData, key).replace(",", ".");
  if (!value) {
    if (required) throw new AdminValidationError(`${label} zorunludur.`);
    return 0;
  }
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    throw new AdminValidationError(`${label} geçerli bir tutar olmalıdır.`);
  }
  return num;
}

export function parseProductKey(formData: FormData) {
  const productKey = requiredString(formData, "productKey", "Ürün");
  if (productKey !== "wexpay") {
    throw new AdminValidationError("Bu fazda yalnızca WexPay ürün erişimi yönetilebilir.");
  }
  return productKey;
}

export function parseAppInstallationStatus(status: string): AppInstallationStatusInput {
  return oneOf(status, appInstallationStatuses, "Ürün erişim durumu");
}

export function parseLicensePayload(formData: FormData) {
  return {
    productKey: parseProductKey(formData),
    planId: requiredString(formData, "planId", "Paket"),
    licenseType: oneOf(requiredString(formData, "licenseType", "Lisans tipi"), licenseTypes, "Lisans tipi") as LicenseTypeInput,
    startsAt: parseDate(formData, "startsAt", "Başlangıç tarihi", true) as Date,
    endsAt: parseDate(formData, "endsAt", "Bitiş / yenileme tarihi", false),
    status: oneOf(requiredString(formData, "status", "Lisans durumu"), licenseStatuses, "Lisans durumu") as LicenseStatusInput,
  };
}

export function parseLicensePlanPayload(formData: FormData) {
  return {
    planId: requiredString(formData, "planId", "Paket"),
  };
}

export function parseLicenseStatusPayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Lisans durumu"), licenseStatuses, "Lisans durumu") as LicenseStatusInput,
  };
}

export function parseRestaurantPayload(formData: FormData) {
  return {
    name: requiredString(formData, "name", "İşletme adı"),
    slug: normalizeAdminSlug(requiredString(formData, "slug", "Slug")),
    isActive: parseBoolean(formData, "isActive"),
  };
}

export function parseInvoiceStatusPayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Fatura durumu"), invoiceStatuses, "Fatura durumu"),
  };
}

export function parseProductStatusPayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Ürün durumu"), productStatuses, "Ürün durumu"),
  };
}

export function parsePlanActivePayload(formData: FormData) {
  return {
    isActive: parseBoolean(formData, "isActive"),
  };
}

export function parseSubscriptionStatusPayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Abonelik durumu"), subscriptionStatuses, "Abonelik durumu"),
  };
}

export function parseWebhookActivePayload(formData: FormData) {
  return {
    isActive: parseBoolean(formData, "isActive"),
  };
}

export function parseMembershipPayload(formData: FormData) {
  const temporaryPassword = nullableString(formData, "temporaryPassword");
  if (temporaryPassword && temporaryPassword.length < 8) {
    throw new AdminValidationError("Geçici şifre en az 8 karakter olmalıdır.");
  }

  return {
    email: requiredString(formData, "email", "E-posta").toLowerCase(),
    name: nullableString(formData, "name"),
    role: oneOf(requiredString(formData, "role", "Rol"), membershipRoles, "Rol") as MembershipRoleInput,
    temporaryPassword,
    mustChangePassword: parseBoolean(formData, "mustChangePassword"),
  };
}

export function parseMembershipRolePayload(formData: FormData) {
  return {
    role: oneOf(requiredString(formData, "role", "Rol"), membershipRoles, "Rol") as MembershipRoleInput,
  };
}

export function parseMembershipStatusPayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Üyelik durumu"), membershipStatuses, "Üyelik durumu"),
  };
}

export function parseUserPasswordResetPayload(formData: FormData) {
  const temporaryPassword = requiredString(formData, "temporaryPassword", "Geçici şifre");
  if (temporaryPassword.length < 8) {
    throw new AdminValidationError("Geçici şifre en az 8 karakter olmalıdır.");
  }
  return {
    temporaryPassword,
    mustChangePassword: parseBoolean(formData, "mustChangePassword"),
  };
}

export function parseInvoiceCreatePayload(formData: FormData) {
  const subtotal = parseDecimal(formData, "subtotal", "Ara toplam");
  const tax = parseDecimal(formData, "tax", "Vergi", false);
  const totalRaw = readString(formData, "total").replace(",", ".");
  const total = totalRaw ? Number(totalRaw) : subtotal + tax;
  if (Number.isNaN(total) || total < 0) {
    throw new AdminValidationError("Toplam tutar geçersiz.");
  }
  return {
    organizationId: requiredString(formData, "organizationId", "Müşteri"),
    subscriptionId: nullableString(formData, "subscriptionId"),
    invoiceNo: readString(formData, "invoiceNo") || `INV-${Date.now()}`,
    status: oneOf(readString(formData, "status") || "ISSUED", invoiceStatuses, "Fatura durumu"),
    subtotal,
    tax,
    total,
    currency: readString(formData, "currency") || "TRY",
    dueAt: parseDate(formData, "dueAt", "Vade tarihi", false),
  };
}

export function parseBillingPaymentCreatePayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Müşteri"),
    invoiceId: nullableString(formData, "invoiceId"),
    subscriptionId: nullableString(formData, "subscriptionId"),
    amount: parseDecimal(formData, "amount", "Tutar"),
    currency: readString(formData, "currency") || "TRY",
    status: oneOf(readString(formData, "status") || "PAID", billingPaymentStatuses, "Ödeme durumu"),
    provider: nullableString(formData, "provider") ?? "admin_manual",
    providerRef: nullableString(formData, "providerRef"),
  };
}

export function parseProductCreatePayload(formData: FormData) {
  return {
    key: normalizeAdminSlug(requiredString(formData, "key", "Ürün key")),
    name: requiredString(formData, "name", "Ürün adı"),
    description: nullableString(formData, "description"),
    status: oneOf(readString(formData, "status") || "UPCOMING", productStatuses, "Ürün durumu"),
  };
}

export function parseProductUpdatePayload(formData: FormData) {
  return {
    name: requiredString(formData, "name", "Ürün adı"),
    description: nullableString(formData, "description"),
    status: oneOf(requiredString(formData, "status", "Ürün durumu"), productStatuses, "Ürün durumu"),
    isActive: parseBoolean(formData, "isActive"),
  };
}

export function parsePlanCreatePayload(formData: FormData) {
  const sortOrderRaw = readString(formData, "sortOrder");
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  return {
    productId: requiredString(formData, "productId", "Ürün"),
    key: normalizeAdminSlug(requiredString(formData, "key", "Paket key")),
    name: requiredString(formData, "name", "Paket adı"),
    description: nullableString(formData, "description"),
    billingInterval: oneOf(requiredString(formData, "billingInterval", "Faturalama aralığı"), billingIntervals, "Faturalama aralığı"),
    isPublic: parseBoolean(formData, "isPublic"),
    isActive: parseBoolean(formData, "isActive"),
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
  };
}

export function parsePlanUpdatePayload(formData: FormData) {
  const sortOrderRaw = readString(formData, "sortOrder");
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  return {
    name: requiredString(formData, "name", "Paket adı"),
    description: nullableString(formData, "description"),
    billingInterval: oneOf(requiredString(formData, "billingInterval", "Faturalama aralığı"), billingIntervals, "Faturalama aralığı"),
    isPublic: parseBoolean(formData, "isPublic"),
    isActive: parseBoolean(formData, "isActive"),
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
  };
}

export function parseEntitlementPayload(formData: FormData) {
  const valueType = oneOf(requiredString(formData, "valueType", "Değer tipi"), entitlementValueTypes, "Değer tipi");
  const key = requiredString(formData, "key", "Limit anahtarı");
  if (valueType === "BOOLEAN") {
    return { key, valueType, valueBool: parseBoolean(formData, "valueBool"), valueInt: null, valueString: null };
  }
  if (valueType === "INTEGER") {
    const raw = readString(formData, "valueInt");
    const valueInt = raw ? Number(raw) : null;
    if (valueInt === null || Number.isNaN(valueInt)) {
      throw new AdminValidationError("Sayısal limit değeri zorunludur.");
    }
    return { key, valueType, valueBool: null, valueInt, valueString: null };
  }
  return {
    key,
    valueType,
    valueBool: null,
    valueInt: null,
    valueString: requiredString(formData, "valueString", "Metin değeri"),
  };
}

export function parseSubscriptionCreatePayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Müşteri"),
    planId: requiredString(formData, "planId", "Paket"),
    status: oneOf(readString(formData, "status") || "ACTIVE", subscriptionStatuses, "Abonelik durumu"),
    interval: oneOf(requiredString(formData, "interval", "Dönem"), billingIntervals, "Dönem"),
    currentPeriodStart: parseDate(formData, "currentPeriodStart", "Dönem başlangıcı", true) as Date,
    currentPeriodEnd: parseDate(formData, "currentPeriodEnd", "Dönem bitişi", false),
    provider: nullableString(formData, "provider") ?? "admin_manual",
    providerRef: nullableString(formData, "providerRef"),
  };
}

export function parseLicenseDetailsPayload(formData: FormData) {
  return {
    licenseType: oneOf(requiredString(formData, "licenseType", "Lisans tipi"), licenseTypes, "Lisans tipi") as LicenseTypeInput,
    startsAt: parseDate(formData, "startsAt", "Başlangıç tarihi", true) as Date,
    endsAt: parseDate(formData, "endsAt", "Bitiş tarihi", false),
    status: oneOf(requiredString(formData, "status", "Lisans durumu"), licenseStatuses, "Lisans durumu") as LicenseStatusInput,
  };
}

export function parseApiKeyCreatePayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Müşteri"),
    productId: nullableString(formData, "productId"),
    name: requiredString(formData, "name", "Anahtar adı"),
  };
}

export function parseWebhookCreatePayload(formData: FormData) {
  const url = requiredString(formData, "url", "Webhook URL");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid");
    }
  } catch {
    throw new AdminValidationError("Geçerli bir webhook URL girin.");
  }
  const events = formData
    .getAll("events")
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return {
    organizationId: requiredString(formData, "organizationId", "Müşteri"),
    productId: nullableString(formData, "productId"),
    url,
    events: events.length > 0 ? events : ["payment.updated"],
  };
}

export function parseSupportTicketUpdatePayload(formData: FormData) {
  return {
    status: oneOf(requiredString(formData, "status", "Talep durumu"), supportTicketStatuses, "Talep durumu"),
    adminReply: nullableString(formData, "adminReply"),
  };
}

export function parseAppInstallationSettingsPayload(formData: FormData) {
  const onboardingStatus = readString(formData, "onboardingStatus") || "PENDING_SETUP";
  const message = nullableString(formData, "message");
  const estimatedRaw = readString(formData, "estimatedBusinessDays");
  const estimatedBusinessDays = estimatedRaw ? Number(estimatedRaw) : null;
  return {
    onboardingStatus,
    message,
    estimatedBusinessDays: estimatedBusinessDays !== null && !Number.isNaN(estimatedBusinessDays) ? estimatedBusinessDays : null,
    source: "admin_manual",
  };
}
