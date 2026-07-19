import { isWexonProductionDeployment } from "@/lib/wexon-canonical-host";
import { validatePublicAppUrl } from "@/lib/wexon-deploy-env";

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

function shouldRequireProductionUrl(rawAppUrl: string, env: NodeJS.ProcessEnv): boolean {
  if (env.VERCEL_ENV === "production") return true;
  if (env.WEXON_E2E_CONFIRM_PRODUCTION === "true") return true;
  try {
    const host = new URL(rawAppUrl).hostname.toLowerCase();
    if (host === "wexon.dev" || host.endsWith(".wexon.dev")) return true;
  } catch {
    return false;
  }
  // Fall back to deployment helper when env matches the live process defaults.
  if (env === process.env && isWexonProductionDeployment()) return true;
  return false;
}

function resolveAppBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!raw) {
    throw new WexPayPublicTableUrlError("Uygulama URL yapılandırması eksik.");
  }

  // Local `next start` uses NODE_ENV=production with localhost — that is not a live deploy.
  const requireProductionUrl = shouldRequireProductionUrl(raw, env);
  const issue = validatePublicAppUrl(raw, { requireProductionUrl });
  if (issue) {
    throw new WexPayPublicTableUrlError(issue.message);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new WexPayPublicTableUrlError("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }

  if (requireProductionUrl) {
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      throw new WexPayPublicTableUrlError("NEXT_PUBLIC_APP_URL must not point at localhost in production.");
    }
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
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
  const base = resolveAppBaseUrl(env);
  return `${base}${buildPublicTableQrPath(qrCode)}`;
}

export function buildOpaquePublicQrUrl(token: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = resolveAppBaseUrl(env);
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
