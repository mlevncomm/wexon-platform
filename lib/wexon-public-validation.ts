export class PublicValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicValidationError";
  }
}

const demoProducts = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] as const;

const productQueryMap: Record<string, (typeof demoProducts)[number]> = {
  wexpay: "WexPay",
  wexhotel: "WexHotel",
  wexb2b: "WexB2B",
  "wexon-core": "Wexon Core",
  wexoncore: "Wexon Core",
};

export function resolveDemoProductFromQuery(param: string | null | undefined): (typeof demoProducts)[number] | null {
  if (!param?.trim()) return null;
  const key = param.trim().toLowerCase();
  return productQueryMap[key] ?? null;
}

export function normalizeDemoRequestSource(param: string | null | undefined): string {
  const value = param?.trim().toLowerCase();
  return value && value.length > 0 ? value : "direct";
}

export const demoRequestSourceLabels: Record<string, string> = {
  direct: "Direct",
  links: "WexPay Links",
  "wexpay-demo": "WexPay Demo",
  "on-basvuru": "Ön Başvuru",
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readAllowedProducts(formData: FormData): readonly string[] | undefined {
  const raw = readString(formData, "_allowedProducts");
  if (!raw) return undefined;

  const products = raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  return products.length > 0 ? products : undefined;
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) {
    throw new PublicValidationError(`${label} zorunludur.`);
  }
  return value;
}

export function parseDemoRequestPayload(formData: FormData) {
  const allowedProducts = readAllowedProducts(formData) ?? demoProducts;

  const fullName = requiredString(formData, "fullName", "Ad soyad");
  if (fullName.length < 2) {
    throw new PublicValidationError("Ad soyad en az 2 karakter olmalıdır.");
  }

  const company = requiredString(formData, "company", "Firma adı");
  const email = requiredString(formData, "email", "E-posta").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PublicValidationError("Geçerli bir e-posta adresi girin.");
  }

  const phone = requiredString(formData, "phone", "Telefon");
  if (phone.length < 7) {
    throw new PublicValidationError("Geçerli bir telefon numarası girin.");
  }

  const product = requiredString(formData, "product", "İlgilendiğiniz ürün");
  if (!allowedProducts.includes(product)) {
    throw new PublicValidationError("Geçerli bir ürün seçin.");
  }

  const message = requiredString(formData, "message", "Kullanım amacı / not");
  if (message.length < 10) {
    throw new PublicValidationError("Kullanım amacı en az 10 karakter olmalıdır.");
  }

  const source = normalizeDemoRequestSource(readString(formData, "source"));
  const preferredTier = readString(formData, "plan") || readString(formData, "preferredTier") || null;
  const intent = readString(formData, "intent") || null;
  const companyType = readString(formData, "companyType") || null;
  const sector = readString(formData, "sector") || null;
  const monthlyGmvBand = readString(formData, "monthlyGmvBand") || null;
  const locationCountRaw = readString(formData, "locationCount");
  const locationCount = locationCountRaw ? Number(locationCountRaw) : null;
  const avgTicketRaw = readString(formData, "avgTicket");
  const avgTicket = avgTicketRaw ? Number(avgTicketRaw) : null;
  const onlineOfflineSplit = readString(formData, "onlineOfflineSplit") || null;
  const needsSubscriptions = readString(formData, "needsSubscriptions") === "true" || readString(formData, "needsSubscriptions") === "on";
  const needsQr = readString(formData, "needsQr") === "true" || readString(formData, "needsQr") === "on";
  const needsIntegration = readString(formData, "needsIntegration") === "true" || readString(formData, "needsIntegration") === "on";
  const needsMarketplaceOrPayout =
    readString(formData, "needsMarketplaceOrPayout") === "true" ||
    readString(formData, "needsMarketplaceOrPayout") === "on";

  return {
    fullName,
    company,
    email,
    phone,
    product,
    message,
    source,
    preferredTier,
    intent,
    companyType,
    sector,
    monthlyGmvBand,
    locationCount: locationCount != null && Number.isFinite(locationCount) ? locationCount : null,
    avgTicket: avgTicket != null && Number.isFinite(avgTicket) ? avgTicket : null,
    onlineOfflineSplit,
    needsSubscriptions,
    needsQr,
    needsIntegration,
    needsMarketplaceOrPayout,
  };
}
