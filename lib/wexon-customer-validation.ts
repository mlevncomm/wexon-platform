export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerValidationError";
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) {
    throw new CustomerValidationError(`${label} zorunludur.`);
  }
  return value;
}

function nullableString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value || null;
}

function parseEmail(formData: FormData) {
  const value = readString(formData, "email").toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new CustomerValidationError("Geçerli bir e-posta adresi girin.");
  }
  return value;
}

function parseCountry(formData: FormData) {
  const value = (readString(formData, "country") || "TR").toUpperCase();
  if (value.length < 2 || value.length > 3) {
    throw new CustomerValidationError("Ülke kodu 2-3 karakter olmalıdır.");
  }
  return value;
}

export function parseCustomerOrganizationPayload(formData: FormData) {
  const name = requiredString(formData, "name", "Organizasyon adı");
  if (name.length < 2) {
    throw new CustomerValidationError("Organizasyon adı en az 2 karakter olmalıdır.");
  }

  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    name,
    legalName: nullableString(formData, "legalName"),
    taxNo: nullableString(formData, "taxNo"),
    email: parseEmail(formData),
    phone: nullableString(formData, "phone"),
    country: parseCountry(formData),
  };
}

const membershipRoles = ["OWNER", "ADMIN", "MANAGER", "STAFF", "BILLING", "VIEWER"] as const;
const supportCategories = ["GENERAL", "WEXPAY", "BILLING", "INTEGRATION", "TECHNICAL"] as const;
const supportPriorities = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

function oneOf<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
  if (!allowed.includes(value)) {
    throw new CustomerValidationError(`${label} geçersiz.`);
  }
  return value as T[number];
}

export function parseCustomerAddMembershipPayload(formData: FormData) {
  const temporaryPassword = requiredString(formData, "temporaryPassword", "Geçici şifre");
  if (temporaryPassword.length < 8) {
    throw new CustomerValidationError("Geçici şifre en az 8 karakter olmalıdır.");
  }

  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    email: requiredString(formData, "email", "E-posta").toLowerCase(),
    name: nullableString(formData, "name"),
    role: oneOf(requiredString(formData, "role", "Rol"), membershipRoles, "Rol"),
    temporaryPassword,
    mustChangePassword: readString(formData, "mustChangePassword") === "true",
  };
}

export function parseCustomerMembershipRolePayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    membershipId: requiredString(formData, "membershipId", "Üyelik"),
    role: oneOf(requiredString(formData, "role", "Rol"), membershipRoles, "Rol"),
  };
}

export function parseCustomerMembershipStatusPayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    membershipId: requiredString(formData, "membershipId", "Üyelik"),
  };
}

export function parseCustomerSupportTicketPayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    subject: requiredString(formData, "subject", "Konu"),
    category: oneOf(requiredString(formData, "category", "Kategori"), supportCategories, "Kategori"),
    priority: oneOf(requiredString(formData, "priority", "Öncelik"), supportPriorities, "Öncelik"),
    message: requiredString(formData, "message", "Açıklama"),
  };
}

export function parseCustomerApiKeyPayload(formData: FormData) {
  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    name: requiredString(formData, "name", "Anahtar adı"),
  };
}

export function parseCustomerWebhookPayload(formData: FormData) {
  const url = requiredString(formData, "url", "Webhook URL");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error("invalid");
    }
  } catch {
    throw new CustomerValidationError("Geçerli bir HTTPS webhook URL girin.");
  }

  const events = formData
    .getAll("events")
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    url,
    events: events.length > 0 ? events : ["payment.updated"],
  };
}

export function parseCustomerRecordPayload(formData: FormData, label: string) {
  return {
    organizationId: requiredString(formData, "organizationId", "Organizasyon"),
    recordId: requiredString(formData, "recordId", label),
  };
}
