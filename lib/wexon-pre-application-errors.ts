import { PublicValidationError } from "@/lib/wexon-public-validation";

const DATABASE_ERROR_CODES = new Set([
  "P1000",
  "P1001",
  "P1017",
  "P2024",
  "ECONNREFUSED",
  "ENOTFOUND",
  "57P01",
  "53300",
]);

export function extractErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code && DATABASE_ERROR_CODES.has(code)) {
    return true;
  }

  if (error instanceof Error) {
    return /connect|ECONNREFUSED|Connection terminated|Can't reach database/i.test(error.message);
  }

  return false;
}

export function resolveAuthDatabaseErrorMessage(): string {
  return "Giriş şu anda tamamlanamıyor. Veritabanı bağlantısı kurulamadı. Lütfen tekrar deneyin.";
}

export function resolvePreApplicationSubmissionError(error: unknown, source?: string): string {
  if (error instanceof PublicValidationError) {
    return error.message;
  }

  const code = extractErrorCode(error);
  if (code && DATABASE_ERROR_CODES.has(code)) {
    return source === "on-basvuru"
      ? "Başvurunuz şu anda alınamadı. Veritabanı bağlantısı kurulamadı. Lütfen tekrar deneyiniz."
      : "Talep şu anda kaydedilemiyor. Veritabanı bağlantısı kurulamadı. Lütfen kısa süre sonra tekrar deneyin.";
  }

  console.error("[pre-application] submission error", error);

  return source === "on-basvuru"
    ? "Başvurunuz şu anda alınamadı. Lütfen tekrar deneyiniz."
    : "Talep kaydedilemedi. Lütfen biraz sonra tekrar deneyin.";
}
