export class PublicValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicValidationError";
  }
}

const demoProducts = ["WexPay", "WexHotel", "WexB2B", "Wexon Core"] as const;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) {
    throw new PublicValidationError(`${label} zorunludur.`);
  }
  return value;
}

export function parseDemoRequestPayload(formData: FormData) {
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
  if (!demoProducts.includes(product as (typeof demoProducts)[number])) {
    throw new PublicValidationError("Geçerli bir ürün seçin.");
  }

  const message = requiredString(formData, "message", "Kullanım amacı / not");
  if (message.length < 10) {
    throw new PublicValidationError("Kullanım amacı en az 10 karakter olmalıdır.");
  }

  return { fullName, company, email, phone, product, message };
}
