export class WexPayPublicTableUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WexPayPublicTableUrlError";
  }
}

function assertSafeQrCode(qrCode: string): string {
  const trimmed = qrCode.trim();
  if (!trimmed) {
    throw new WexPayPublicTableUrlError("QR kodu boş olamaz.");
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new WexPayPublicTableUrlError("QR kodu geçersiz karakter içeriyor.");
  }
  return trimmed;
}

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function shouldRequireProductionOrigin(parsed: URL, env: NodeJS.ProcessEnv): boolean {
  if (env.VERCEL_ENV === "production") return true;
  if (env.WEXON_E2E_CONFIRM_PRODUCTION === "true") return true;
  const host = parsed.hostname.toLowerCase();
  return host === "wexon.dev" || host.endsWith(".wexon.dev");
}

/**
 * Canonical public QR origin. Prefer the dedicated public origin and fall back
 * to the app origin. Accept an origin only: no credentials, path, query, hash.
 */
export function resolveWexPayPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw =
    env.NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) {
    throw new WexPayPublicTableUrlError("Uygulama URL yapılandırması eksik.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new WexPayPublicTableUrlError("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WexPayPublicTableUrlError("Genel erişim adresi http veya https olmalıdır.");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new WexPayPublicTableUrlError(
      "Genel erişim adresi yalnızca origin içermelidir.",
    );
  }

  if (shouldRequireProductionOrigin(parsed, env)) {
    if (parsed.protocol !== "https:") {
      throw new WexPayPublicTableUrlError(
        "Genel erişim adresi üretimde https kullanmalıdır.",
      );
    }
    if (isLocalHostname(parsed.hostname)) {
      throw new WexPayPublicTableUrlError(
        "Genel erişim adresi üretimde localhost olamaz.",
      );
    }
  }

  return parsed.origin;
}

/** Relative guest path — never embeds tenant/internal IDs. */
export function buildPublicTableQrPath(qrCode: string): string {
  const safe = assertSafeQrCode(qrCode);
  return `/wexpay/t/${encodeURIComponent(safe)}`;
}

/** Canonical opaque token path — /q/{token}. */
export function buildOpaquePublicQrPath(token: string): string {
  const safe = assertSafeQrCode(token);
  return `/q/${encodeURIComponent(safe)}`;
}

/** Absolute canonical guest URL from NEXT_PUBLIC_APP_URL (server-side). */
export function buildPublicTableQrUrl(qrCode: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = resolveWexPayPublicOrigin(env);
  return `${base}${buildPublicTableQrPath(qrCode)}`;
}

export function buildOpaquePublicQrUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = resolveWexPayPublicOrigin(env);
  return `${base}${buildOpaquePublicQrPath(token)}`;
}

/** Filename-safe slug for downloads: wexpay-<slug>-qr.{png,svg} */
export function toQrFilenameSlug(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "masa";
}

export function buildTableQrDownloadBasename(label: string): string {
  return `wexpay-${toQrFilenameSlug(label)}-qr`;
}
