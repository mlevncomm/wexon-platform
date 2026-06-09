export class SignupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupValidationError";
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string, label: string) {
  const value = readString(formData, key);
  if (!value) throw new SignupValidationError(`${label} zorunludur.`);
  return value;
}

export function normalizeSignupSlug(value: string) {
  return value
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
}

export function parseCustomerSignupPayload(formData: FormData) {
  const email = requiredString(formData, "email", "E-posta").toLowerCase();
  const password = requiredString(formData, "password", "Şifre");
  const passwordConfirm = requiredString(formData, "passwordConfirm", "Şifre tekrarı");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SignupValidationError("Geçerli bir e-posta adresi girin.");
  if (password.length < 8) throw new SignupValidationError("Şifre en az 8 karakter olmalıdır.");
  if (password !== passwordConfirm) throw new SignupValidationError("Şifre ve tekrarı eşleşmiyor.");

  return {
    name: requiredString(formData, "name", "Yetkili adı"),
    email,
    password,
    organizationName: requiredString(formData, "organizationName", "İşletme / organizasyon adı"),
    phone: readString(formData, "phone") || null,
    country: (readString(formData, "country") || "TR").toUpperCase(),
    productInterest: readString(formData, "productInterest") || "WexPay",
  };
}
