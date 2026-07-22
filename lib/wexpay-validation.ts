import { OrderStatus, PaymentStatus, WexPayProviderCredentialMode } from ".prisma/client";
import {
  parseWexPayPaymentProviderKey,
  WexPayPaymentProviderError,
  type WexPayPaymentProviderKey,
} from "@/lib/wexpay-payment-provider";
import { WEXPAY_PSP_PROVIDER_KEYS, type WexPayPspProviderKey } from "@/lib/wexpay-provider-credentials";
import { WexPayValidationError } from "@/lib/wexpay-validation-error";

export { WexPayValidationError };

/**
 * Input validation for the real WexPay operator app. Mirrors the existing
 * customer/admin validation style: pure functions that read a FormData and
 * throw `WexPayValidationError` on invalid input.
 */

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

export function parseTableBulkCreate(formData: FormData) {
  const prefix = requiredString(formData, "prefix", "Masa öneki");
  if (prefix.length > 40) {
    throw new WexPayValidationError("Masa öneki en fazla 40 karakter olabilir.");
  }
  const countRaw = readString(formData, "count");
  const count = Number(countRaw);
  if (!countRaw || Number.isNaN(count) || !Number.isInteger(count) || count < 1 || count > 50) {
    throw new WexPayValidationError("Toplu masa adedi 1-50 arasında olmalıdır.");
  }
  const seatsRaw = readString(formData, "seats");
  const seats = seatsRaw ? Number(seatsRaw) : 4;
  if (Number.isNaN(seats) || !Number.isInteger(seats) || seats <= 0 || seats > 100) {
    throw new WexPayValidationError("Koltuk sayısı 1-100 arasında bir tam sayı olmalıdır.");
  }
  const startRaw = readString(formData, "startNumber");
  const startNumber = startRaw ? Number(startRaw) : 1;
  if (Number.isNaN(startNumber) || !Number.isInteger(startNumber) || startNumber < 1 || startNumber > 9999) {
    throw new WexPayValidationError("Başlangıç numarası 1-9999 arasında olmalıdır.");
  }
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    prefix,
    count,
    seats,
    startNumber,
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

function parseNonNegativeMoney(formData: FormData, key: string, label: string) {
  const raw = readString(formData, key).replace(",", ".");
  const value = Number(raw || "0");
  if (Number.isNaN(value) || value < 0) {
    throw new WexPayValidationError(`${label} sıfır veya pozitif olmalıdır.`);
  }
  return Math.round(value * 100) / 100;
}

function parseSelectionBounds(formData: FormData, selectionType: "SINGLE" | "MULTI") {
  const minRaw = readString(formData, "minSelect");
  const maxRaw = readString(formData, "maxSelect");
  const minSelect = minRaw ? Number(minRaw) : 0;
  let maxSelect = maxRaw ? Number(maxRaw) : selectionType === "SINGLE" ? 1 : 1;
  if (Number.isNaN(minSelect) || !Number.isInteger(minSelect) || minSelect < 0 || minSelect > 20) {
    throw new WexPayValidationError("Minimum seçim 0-20 arasında olmalıdır.");
  }
  if (Number.isNaN(maxSelect) || !Number.isInteger(maxSelect) || maxSelect < 1 || maxSelect > 20) {
    throw new WexPayValidationError("Maksimum seçim 1-20 arasında olmalıdır.");
  }
  if (selectionType === "SINGLE") {
    maxSelect = 1;
  }
  if (minSelect > maxSelect) {
    throw new WexPayValidationError("Minimum seçim maksimumdan büyük olamaz.");
  }
  return { minSelect, maxSelect };
}

export function parseModifierGroupCreate(formData: FormData) {
  const name = requiredString(formData, "name", "Grup adı");
  const selectionRaw = readString(formData, "selectionType").toUpperCase();
  const selectionType = selectionRaw === "MULTI" ? ("MULTI" as const) : ("SINGLE" as const);
  const bounds = parseSelectionBounds(formData, selectionType);
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    name,
    selectionType,
    ...bounds,
  };
}

export function parseModifierGroupUpdate(formData: FormData) {
  const name = requiredString(formData, "name", "Grup adı");
  const selectionRaw = readString(formData, "selectionType").toUpperCase();
  const selectionType = selectionRaw === "MULTI" ? ("MULTI" as const) : ("SINGLE" as const);
  const bounds = parseSelectionBounds(formData, selectionType);
  const sortRaw = readString(formData, "sortOrder");
  const sortOrder = sortRaw ? Number(sortRaw) : undefined;
  if (sortOrder !== undefined && (Number.isNaN(sortOrder) || !Number.isInteger(sortOrder))) {
    throw new WexPayValidationError("Sıralama değeri tam sayı olmalıdır.");
  }
  return {
    groupId: requiredString(formData, "groupId", "Modifier grubu"),
    name,
    selectionType,
    ...bounds,
    sortOrder,
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseModifierOptionCreate(formData: FormData) {
  return {
    groupId: requiredString(formData, "groupId", "Modifier grubu"),
    name: requiredString(formData, "name", "Seçenek adı"),
    priceDelta: parseNonNegativeMoney(formData, "priceDelta", "Fiyat farkı"),
  };
}

export function parseModifierOptionUpdate(formData: FormData) {
  const sortRaw = readString(formData, "sortOrder");
  const sortOrder = sortRaw ? Number(sortRaw) : undefined;
  if (sortOrder !== undefined && (Number.isNaN(sortOrder) || !Number.isInteger(sortOrder))) {
    throw new WexPayValidationError("Sıralama değeri tam sayı olmalıdır.");
  }
  return {
    optionId: requiredString(formData, "optionId", "Seçenek"),
    name: requiredString(formData, "name", "Seçenek adı"),
    priceDelta: parseNonNegativeMoney(formData, "priceDelta", "Fiyat farkı"),
    sortOrder,
    isActive: optionalBoolean(formData, "isActive"),
  };
}

export function parseProductModifierLinks(formData: FormData) {
  const productId = requiredString(formData, "productId", "Ürün");
  const groupIds = formData
    .getAll("groupIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return { productId, groupIds: [...new Set(groupIds)] };
}

// ---------------------------------------------------------------------------
// Orders & payments (Phase 2). Shared core validators are reused by both the
// FormData server-action parsers and the JSON API payload parsers.
// ---------------------------------------------------------------------------

export type OrderItemInput = {
  productId: string;
  quantity: number;
  /** Server-validated modifier option IDs only — no names/prices from client. */
  modifierOptionIds?: string[];
};

export const PUBLIC_NOTE_MAX_LENGTH = 500;
export const PUBLIC_ORDER_ITEMS_MAX = 50;

const ORDER_STATUS_VALUES = Object.values(OrderStatus) as string[];
const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus) as string[];

function toQuantity(value: unknown): number {
  const quantity = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
    throw new WexPayValidationError("Ürün adedi 1-999 arasında bir tam sayı olmalıdır.");
  }
  return quantity;
}

/** Normalize and bound optional public notes (order / assist). */
export function validatePublicNote(raw: unknown, label = "Not"): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new WexPayValidationError(`${label} geçersiz.`);
  }
  const note = raw.trim();
  if (!note) return null;
  if (note.length > PUBLIC_NOTE_MAX_LENGTH) {
    throw new WexPayValidationError(`${label} en fazla ${PUBLIC_NOTE_MAX_LENGTH} karakter olabilir.`);
  }
  return note;
}

/** Accepts an array or a JSON string of `{ productId, quantity, modifierOptionIds? }` items. */
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
  if (value.length > PUBLIC_ORDER_ITEMS_MAX) {
    throw new WexPayValidationError(`Siparişte en fazla ${PUBLIC_ORDER_ITEMS_MAX} kalem olabilir.`);
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new WexPayValidationError("Geçersiz sipariş kalemi.");
    }
    const candidate = item as Record<string, unknown>;
    // Reject client-supplied money / snapshot fields — totals & names are always server-computed.
    const forbidden = [
      "unitPrice",
      "price",
      "total",
      "lineTotal",
      "subtotal",
      "priceDelta",
      "groupName",
      "optionName",
      "modifiers",
      "branchId",
      "organizationId",
    ];
    for (const key of forbidden) {
      if (key in candidate) {
        throw new WexPayValidationError("Fiyat veya seçenek alanı gönderilemez; tutar sunucuda hesaplanır.");
      }
    }
    if (typeof candidate.productId !== "string" || !candidate.productId.trim()) {
      throw new WexPayValidationError("Ürün seçimi geçersiz.");
    }

    let modifierOptionIds: string[] | undefined;
    if ("modifierOptionIds" in candidate) {
      if (candidate.modifierOptionIds === undefined || candidate.modifierOptionIds === null) {
        modifierOptionIds = undefined;
      } else if (!Array.isArray(candidate.modifierOptionIds)) {
        throw new WexPayValidationError("Modifier seçimleri geçersiz.");
      } else {
        const seen = new Set<string>();
        modifierOptionIds = [];
        for (const value of candidate.modifierOptionIds) {
          if (typeof value !== "string" || !value.trim()) {
            throw new WexPayValidationError("Modifier seçimi geçersiz.");
          }
          const id = value.trim();
          if (seen.has(id)) {
            throw new WexPayValidationError("Aynı seçenek birden fazla gönderilemez.");
          }
          seen.add(id);
          modifierOptionIds.push(id);
        }
      }
    }

    return {
      productId: candidate.productId.trim(),
      quantity: toQuantity(candidate.quantity),
      ...(modifierOptionIds && modifierOptionIds.length > 0 ? { modifierOptionIds } : {}),
    };
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

/** Manual create allowlist — UI status must not invent FAILED/REFUNDED/PENDING. */
const MANUAL_PAYMENT_CREATE_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PAID,
  PaymentStatus.PARTIAL,
]);

export function validateManualPaymentCreateStatus(raw: unknown): PaymentStatus {
  const status = validatePaymentStatus(raw);
  if (!MANUAL_PAYMENT_CREATE_STATUSES.has(status)) {
    throw new WexPayValidationError(
      "Manuel ödeme yalnızca Ödendi veya Kısmi olarak oluşturulabilir.",
    );
  }
  return status;
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
    note: validatePublicNote(formData.get("note")),
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
    note: validatePublicNote(data.note),
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
  const provider = parsePaymentProvider(nullableString(formData, "provider"));
  const status =
    provider === "paytr"
      ? PaymentStatus.PENDING
      : validateManualPaymentCreateStatus(readString(formData, "status") || "PAID");
  return {
    branchId: requiredString(formData, "branchId", "Şube"),
    tableId: requiredString(formData, "tableId", "Masa"),
    orderId: nullableString(formData, "orderId"),
    amount: validateAmount(formData.get("amount")),
    status,
    provider,
    receiptRequested: readBoolean(formData, "receiptRequested"),
  };
}

export function parsePaymentCreatePayload(body: unknown) {
  const data = (body ?? {}) as Record<string, unknown>;
  const branchId = typeof data.branchId === "string" ? data.branchId.trim() : "";
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  if (!branchId) throw new WexPayValidationError("Şube zorunludur.");
  if (!tableId) throw new WexPayValidationError("Masa zorunludur.");
  const provider = parsePaymentProvider(
    typeof data.provider === "string" && data.provider.trim() ? data.provider.trim() : null,
  );
  const status =
    provider === "paytr"
      ? PaymentStatus.PENDING
      : data.status === undefined || data.status === null || data.status === ""
        ? PaymentStatus.PAID
        : validateManualPaymentCreateStatus(data.status);
  return {
    branchId,
    tableId,
    orderId: typeof data.orderId === "string" && data.orderId.trim() ? data.orderId.trim() : null,
    amount: validateAmount(data.amount),
    status,
    provider,
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

export function parseProviderCredentialTest(formData: FormData) {
  return {
    credentialId: requiredString(formData, "credentialId", "Credential"),
  };
}
