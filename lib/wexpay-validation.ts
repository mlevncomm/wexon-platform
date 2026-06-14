import { OrderStatus, PaymentStatus, WexPayProviderCredentialMode } from ".prisma/client";
import {
  parseWexPayPaymentProviderKey,
  WexPayPaymentProviderError,
  type WexPayPaymentProviderKey,
} from "@/lib/wexpay-payment-provider";
import { WEXPAY_PSP_PROVIDER_KEYS, type WexPayPspProviderKey } from "@/lib/wexpay-provider-credentials";

/**
 * Input validation for the real WexPay operator app. Mirrors the existing
 * customer/admin validation style: pure functions that read a FormData and
 * throw `WexPayValidationError` on invalid input.
 */
export class WexPayValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WexPayValidationError";
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) {
    throw new WexPayValidationError(`${label} zorunludur.`);
  }
  return value;
}

function nullableString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value || null;
}

function readBoolean(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value === "true" || value === "on" || value === "1";
}

function optionalBoolean(formData: FormData, key: string): boolean | undefined {
  if (!formData.has(key)) return undefined;
  return readBoolean(formData, key);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parsePositivePrice(formData: FormData, key: string, label: string) {
  const raw = readString(formData, key).replace(",", ".");
  const value = Number(raw);
  if (!raw || Number.isNaN(value) || value <= 0) {
    throw new WexPayValidationError(`${label} geçerli ve sıfırdan büyük olmalıdır.`);
  }
  return Math.round(value * 100) / 100;
}

export function parseRestaurantCreate(formData: FormData) {
  const name = requiredString(formData, "name", "Restoran adı");
  if (name.length < 2) {
    throw new WexPayValidationError("Restoran adı en az 2 karakter olmalıdır.");
  }
  const slugInput = readString(formData, "slug");
  const slug = slugify(slugInput || name);
  if (!slug) {
    throw new WexPayValidationError("Geçerli bir restoran slug değeri üretilemedi.");
  }
  return { name, slug };
}

export function parseRestaurantUpdate(formData: FormData) {
  const name = requiredString(formData, "name", "Restoran adı");
  if (name.length < 2) {
    throw new WexPayValidationError("Restoran adı en az 2 karakter olmalıdır.");
  }
  return {
    restaurantId: requiredString(formData, "restaurantId", "Restoran"),
    name,
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseBranchCreate(formData: FormData) {
  const name = requiredString(formData, "name", "Şube adı");
  if (name.length < 2) {
    throw new WexPayValidationError("Şube adı en az 2 karakter olmalıdır.");
  }
  const slug = slugify(readString(formData, "slug") || name);
  if (!slug) {
    throw new WexPayValidationError("Geçerli bir şube slug değeri üretilemedi.");
  }
  return {
    restaurantId: requiredString(formData, "restaurantId", "Restoran"),
    name,
    slug,
    address: nullableString(formData, "address"),
  };
}

export function parseBranchUpdate(formData: FormData) {
  const name = requiredString(formData, "name", "Şube adı");
  if (name.length < 2) {
    throw new WexPayValidationError("Şube adı en az 2 karakter olmalıdır.");
  }
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    name,
    address: nullableString(formData, "address"),
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseTableCreate(formData: FormData) {
  const label = requiredString(formData, "label", "Masa adı");
  const seatsRaw = readString(formData, "seats");
  const seats = seatsRaw ? Number(seatsRaw) : 4;
  if (Number.isNaN(seats) || !Number.isInteger(seats) || seats <= 0 || seats > 100) {
    throw new WexPayValidationError("Koltuk sayısı 1-100 arasında bir tam sayı olmalıdır.");
  }
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    label,
    seats,
  };
}

export function parseTableUpdate(formData: FormData) {
  const label = requiredString(formData, "label", "Masa adı");
  const seatsRaw = readString(formData, "seats");
  const seats = seatsRaw ? Number(seatsRaw) : undefined;
  if (seats !== undefined && (Number.isNaN(seats) || !Number.isInteger(seats) || seats <= 0 || seats > 100)) {
    throw new WexPayValidationError("Koltuk sayısı 1-100 arasında bir tam sayı olmalıdır.");
  }
  return {
    tableId: requiredString(formData, "tableId", "Masa"),
    label,
    seats,
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseTableClose(formData: FormData) {
  return {
    tableId: requiredString(formData, "tableId", "Masa"),
  };
}

export function parseTableReceiptPrinted(formData: FormData) {
  return {
    tableId: requiredString(formData, "tableId", "Masa"),
  };
}

export function parseCategoryCreate(formData: FormData) {
  const name = requiredString(formData, "name", "Kategori adı");
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    name,
  };
}

export function parseCategoryUpdate(formData: FormData) {
  const name = requiredString(formData, "name", "Kategori adı");
  const sortRaw = readString(formData, "sortOrder");
  const sortOrder = sortRaw ? Number(sortRaw) : undefined;
  if (sortOrder !== undefined && (Number.isNaN(sortOrder) || !Number.isInteger(sortOrder))) {
    throw new WexPayValidationError("Sıralama değeri tam sayı olmalıdır.");
  }
  return {
    categoryId: requiredString(formData, "categoryId", "Kategori"),
    name,
    sortOrder,
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseProductCreate(formData: FormData) {
  const name = requiredString(formData, "name", "Ürün adı");
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    categoryId: requiredString(formData, "categoryId", "Kategori"),
    name,
    description: nullableString(formData, "description"),
    price: parsePositivePrice(formData, "price", "Fiyat"),
    imageUrl: nullableString(formData, "imageUrl"),
    isPopular: readBoolean(formData, "isPopular"),
  };
}

export function parseProductUpdate(formData: FormData) {
  const name = requiredString(formData, "name", "Ürün adı");
  const priceRaw = readString(formData, "price");
  const price = priceRaw ? parsePositivePrice(formData, "price", "Fiyat") : undefined;
  return {
    productId: requiredString(formData, "productId", "Ürün"),
    categoryId: nullableString(formData, "categoryId"),
    name,
    description: nullableString(formData, "description"),
    price,
    imageUrl: nullableString(formData, "imageUrl"),
    isActive: optionalBoolean(formData, "isActive"),
    inStock: optionalBoolean(formData, "inStock"),
    isPopular: optionalBoolean(formData, "isPopular"),
  };
}

// ---------------------------------------------------------------------------
// Orders & payments (Phase 2). Shared core validators are reused by both the
// FormData server-action parsers and the JSON API payload parsers.
// ---------------------------------------------------------------------------

export type OrderItemInput = { productId: string; quantity: number };

const ORDER_STATUS_VALUES = Object.values(OrderStatus) as string[];
const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus) as string[];

function toQuantity(value: unknown): number {
  const quantity = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
    throw new WexPayValidationError("Ürün adedi 1-999 arasında bir tam sayı olmalıdır.");
  }
  return quantity;
}

/** Accepts an array or a JSON string of `{ productId, quantity }` items. */
export function validateOrderItems(raw: unknown): OrderItemInput[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new WexPayValidationError("Sipariş kalemleri okunamadı.");
    }
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new WexPayValidationError("Siparişe en az bir ürün eklenmelidir.");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new WexPayValidationError("Geçersiz sipariş kalemi.");
    }
    const candidate = item as { productId?: unknown; quantity?: unknown };
    if (typeof candidate.productId !== "string" || !candidate.productId.trim()) {
      throw new WexPayValidationError("Ürün seçimi geçersiz.");
    }
    return { productId: candidate.productId.trim(), quantity: toQuantity(candidate.quantity) };
  });
}

function validateOrderStatus(raw: unknown): OrderStatus {
  if (typeof raw === "string" && ORDER_STATUS_VALUES.includes(raw)) {
    return raw as OrderStatus;
  }
  throw new WexPayValidationError("Geçerli bir sipariş durumu seçilmelidir.");
}

function validateAmount(raw: unknown): number {
  const amount = typeof raw === "string" ? Number(raw.replace(",", ".")) : typeof raw === "number" ? raw : Number.NaN;
  if (Number.isNaN(amount) || amount <= 0) {
    throw new WexPayValidationError("Geçerli ve sıfırdan büyük bir tutar girin.");
  }
  return Math.round(amount * 100) / 100;
}

function validatePaymentStatus(raw: unknown): PaymentStatus {
  if (typeof raw === "string" && PAYMENT_STATUS_VALUES.includes(raw)) {
    return raw as PaymentStatus;
  }
  throw new WexPayValidationError("Geçerli bir ödeme durumu seçilmelidir.");
}

function parsePaymentProvider(raw: string | null): WexPayPaymentProviderKey {
  try {
    return parseWexPayPaymentProviderKey(raw);
  } catch (error) {
    if (error instanceof WexPayPaymentProviderError) {
      throw new WexPayValidationError(error.message);
    }
    throw error;
  }
}

export function parseOrderCreate(formData: FormData) {
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    tableId: requiredString(formData, "tableId", "Masa"),
    note: nullableString(formData, "note"),
    items: validateOrderItems(formData.get("items")),
  };
}

export function parseOrderCreatePayload(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  const branchId = typeof data.branchId === "string" ? data.branchId.trim() : "";
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (!branchId) throw new WexPayValidationError("Şube zorunludur.");
  if (!tableId) throw new WexPayValidationError("Masa zorunludur.");
  return {
    branchId,
    tableId,
    note: typeof data.note === "string" && data.note.trim() ? data.note.trim() : null,
    items: validateOrderItems(data.items),
  };
}

export function parseOrderStatusUpdate(formData: FormData) {
  return {
    orderId: requiredString(formData, "orderId", "Sipariş"),
    status: validateOrderStatus(formData.get("status")),
  };
}

export function parseOrderStatusUpdatePayload(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  const orderId = typeof data.orderId === "string" ? data.orderId.trim() : "";
  if (!orderId) throw new WexPayValidationError("Sipariş zorunludur.");
  return { orderId, status: validateOrderStatus(data.status) };
}

export function parsePaymentCreate(formData: FormData) {
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    tableId: requiredString(formData, "tableId", "Masa"),
    orderId: nullableString(formData, "orderId"),
    amount: validateAmount(formData.get("amount")),
    status: validatePaymentStatus(readString(formData, "status") || "PAID"),
    provider: parsePaymentProvider(nullableString(formData, "provider")),
    receiptRequested: readBoolean(formData, "receiptRequested"),
  };
}

export function parsePaymentCreatePayload(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  const branchId = typeof data.branchId === "string" ? data.branchId.trim() : "";
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (!branchId) throw new WexPayValidationError("Şube zorunludur.");
  if (!tableId) throw new WexPayValidationError("Masa zorunludur.");
  return {
    branchId,
    tableId,
    orderId: typeof data.orderId === "string" && data.orderId.trim() ? data.orderId.trim() : null,
    amount: validateAmount(data.amount),
    status: data.status === undefined || data.status === null || data.status === "" ? PaymentStatus.PAID : validatePaymentStatus(data.status),
    provider: parsePaymentProvider(
      typeof data.provider === "string" && data.provider.trim() ? data.provider.trim() : null,
    ),
    receiptRequested: data.receiptRequested === true,
  };
}

export function parsePaymentUpdate(formData: FormData) {
  return {
    paymentId: requiredString(formData, "paymentId", "Ödeme"),
    status: validatePaymentStatus(readString(formData, "status")),
  };
}

export function parsePaymentUpdatePayload(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  const paymentId = typeof data.paymentId === "string" ? data.paymentId.trim() : "";
  if (!paymentId) throw new WexPayValidationError("Ödeme zorunludur.");
  return { paymentId, status: validatePaymentStatus(data.status) };
}

// ---------------------------------------------------------------------------
// Provider credentials (Phase 6.2). Secrets never returned from parsers.
// ---------------------------------------------------------------------------

const PROVIDER_CREDENTIAL_DISPLAY_NAME_MAX = 80;
const PROVIDER_CREDENTIAL_FIELD_MAX = 256;

function parseProviderCredentialProvider(raw: string): WexPayPspProviderKey {
  const normalized = raw.trim().toLowerCase();
  if (!(WEXPAY_PSP_PROVIDER_KEYS as readonly string[]).includes(normalized)) {
    throw new WexPayValidationError("Geçerli bir ödeme sağlayıcısı seçilmelidir.");
  }
  return normalized as WexPayPspProviderKey;
}

function parseProviderCredentialMode(raw: string): WexPayProviderCredentialMode {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "TEST") return WexPayProviderCredentialMode.TEST;
  if (normalized === "LIVE") return WexPayProviderCredentialMode.LIVE;
  throw new WexPayValidationError("Geçerli bir credential modu seçilmelidir.");
}

function parseBoundedCredentialField(formData: FormData, key: string, label: string, required = false) {
  const value = readString(formData, key);
  if (!value) {
    if (required) throw new WexPayValidationError(`${label} zorunludur.`);
    return "";
  }
  if (value.length > PROVIDER_CREDENTIAL_FIELD_MAX) {
    throw new WexPayValidationError(`${label} en fazla ${PROVIDER_CREDENTIAL_FIELD_MAX} karakter olabilir.`);
  }
  return value;
}

export function parseProviderCredentialUpsert(formData: FormData) {
  const provider = parseProviderCredentialProvider(requiredString(formData, "provider", "Sağlayıcı"));
  const mode = parseProviderCredentialMode(requiredString(formData, "mode", "Mod"));
  const displayName = requiredString(formData, "displayName", "Görünen ad");
  if (displayName.length > PROVIDER_CREDENTIAL_DISPLAY_NAME_MAX) {
    throw new WexPayValidationError(`Görünen ad en fazla ${PROVIDER_CREDENTIAL_DISPLAY_NAME_MAX} karakter olabilir.`);
  }

  const merchantId = parseBoundedCredentialField(formData, "merchantId", "Merchant ID", true);
  const apiKey = parseBoundedCredentialField(formData, "apiKey", "API key");
  const secretKey = parseBoundedCredentialField(formData, "secretKey", "Secret key");
  const merchantSalt = parseBoundedCredentialField(formData, "merchantSalt", "Merchant salt");

  const config: Record<string, string> = { merchantId };
  if (apiKey) config.apiKey = apiKey;
  if (secretKey) config.secretKey = secretKey;
  if (merchantSalt) config.merchantSalt = merchantSalt;

  return {
    provider,
    mode,
    displayName,
    config,
    primarySecret: secretKey || null,
  };
}

export function parseProviderCredentialDeactivate(formData: FormData) {
  return {
    credentialId: requiredString(formData, "credentialId", "Credential"),
  };
}
