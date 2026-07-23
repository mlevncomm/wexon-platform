import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  isAdminHost,
  isWexonProductionDeployment,
  normalizeHost,
  PRODUCTION_ROOT_HOST,
  resolveHostSurface,
} from "@/lib/wexon-canonical-host";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_LEGACY,
} from "@/lib/wexon-admin-session-cookie";

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_LEGACY } from "@/lib/wexon-admin-session-cookie";

/**
 * Admin session auth (MVP).
 *
 * PRODUCTION NOTE: A shared `ADMIN_LOGIN_PASSWORD` plus an email allowlist is
 * not sufficient for production admin access. Target architecture (PR2):
 * - Per-admin user records with unique password hashes (argon2/bcrypt)
 * - MFA (TOTP/WebAuthn) for privileged operations
 * - Session rotation, device binding, and Cloudflare Access identity binding
 *
 * PR1 hardening: host-only v2 admin cookies, production admin-host gate, 2h TTL,
 * timing-safe shared-password compare. Shared password remains until PR2.
 *
 * Cookie migration: only `ADMIN_SESSION_COOKIE` (v2) is accepted. Legacy
 * `ADMIN_SESSION_COOKIE_LEGACY` is cleared on login/logout and never grants access.
 * Operators should expect a one-time re-login on `admin.wexon.dev` after deploy.
 */

/** Absolute admin session lifetime (no idle refresh in PR1). */
export const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION_COOKIE_PATH = "/";

export const ADMIN_LOGIN_GENERIC_ERROR = "E-posta veya şifre hatalı.";
export const ADMIN_PRODUCTION_LOGIN_URL = `https://admin.${PRODUCTION_ROOT_HOST}/login`;

export type AdminSession = {
  email: string;
  expiresAt: number;
};

export type AdminSessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
  domain?: string;
};

export function adminDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Admin oturum yapılandırması eksik.");
  }
  return secret;
}

export function isAdminEmailAllowed(email: string) {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Timing-safe shared-password compare (temporary until PR2 per-admin hashes).
 * Hashes both sides with SHA-256 so digest lengths always match.
 */
export function securePasswordEqual(provided: string, expected: string) {
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/** Host-only admin cookie options — never sets Domain (not shared across *.wexon.dev). */
export function adminSessionCookieOptions(expires: Date): AdminSessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: SESSION_COOKIE_PATH,
    expires,
  };
}

export function adminSessionCookieClearOptions(): AdminSessionCookieOptions {
  return adminSessionCookieOptions(new Date(0));
}

/** Legacy Domain=.wexon.dev clear options (legacy cookie name only). */
export function adminSessionCookieLegacyDomainClearOptions(): AdminSessionCookieOptions {
  return {
    ...adminSessionCookieClearOptions(),
    domain: `.${PRODUCTION_ROOT_HOST}`,
  };
}

/**
 * Production admin access is bound to the admin host/surface.
 * Local / preview (non-production Wexon deployment) keeps `/admin` on the same origin.
 */
export function isAdminAccessHostAllowed(host: string | null | undefined, productionWexon: boolean) {
  if (!productionWexon) return true;
  const normalized = normalizeHost(host);
  return resolveHostSurface(normalized) === "admin" || isAdminHost(normalized);
}

export async function readRequestHost() {
  const headerStore = await headers();
  return headerStore.get("host") ?? headerStore.get("x-forwarded-host");
}

function signSession(email: string, expiresAt: number) {
  return createHmac("sha256", getSessionSecret()).update(`${email}.${expiresAt}`).digest("hex");
}

function encodeCookieEmail(email: string) {
  return Buffer.from(email, "utf8").toString("base64url");
}

function decodeCookieEmail(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function verifySignature(email: string, expiresAt: number, signature: string) {
  const expected = signSession(email, expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function parseSessionCookie(value: string | undefined): AdminSession | null {
  if (!value) {
    adminDebug("session:parse", { hasCookie: false });
    return null;
  }

  const [encodedEmail, expiresAtValue, signature] = value.split(".");
  const email = encodedEmail ? decodeCookieEmail(encodedEmail) : null;
  const expiresAt = Number(expiresAtValue);

  if (!email || !expiresAt || !signature) {
    adminDebug("session:parse", { hasCookie: true, cookieLength: value.length, hasParts: false });
    return null;
  }

  const expired = expiresAt < Date.now();
  const allowed = isAdminEmailAllowed(email);
  const signatureValid = verifySignature(email, expiresAt, signature);

  adminDebug("session:parse", {
    hasCookie: true,
    cookieLength: value.length,
    email,
    expired,
    allowed,
    signatureValid,
  });

  if (expired || !allowed || !signatureValid) return null;

  return { email, expiresAt };
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  adminDebug("session:get", {
    hasCookie: Boolean(value),
    cookieLength: value?.length ?? 0,
    cookieName: ADMIN_SESSION_COOKIE,
  });
  return parseSessionCookie(value);
}

async function adminLoginRedirectPath() {
  if (!isWexonProductionDeployment()) {
    return "/admin/login";
  }

  const host = normalizeHost(await readRequestHost());
  if (resolveHostSurface(host) === "admin") {
    return "/login";
  }

  return "/admin/login";
}

export async function assertAdminAccess() {
  adminDebug("assert:start");
  const productionWexon = isWexonProductionDeployment();
  const host = await readRequestHost();

  if (!isAdminAccessHostAllowed(host, productionWexon)) {
    adminDebug("assert:redirect", { to: "login", reason: "wrong_host", host: normalizeHost(host) });
    redirect(await adminLoginRedirectPath());
  }

  const session = await getAdminSession();
  if (!session) {
    const loginPath = await adminLoginRedirectPath();
    adminDebug("assert:redirect", { to: loginPath, hasSession: false });
    redirect(loginPath);
  }
  adminDebug("assert:ok", { email: session.email });
  return session;
}

function clearLegacyDomainCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  // Separate cookie name from v2 — never double-set the same name with two scopes.
  cookieStore.set(ADMIN_SESSION_COOKIE_LEGACY, "", adminSessionCookieLegacyDomainClearOptions());
}

export async function createAdminSessionCookie(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const signature = signSession(normalizedEmail, expiresAt);
  const encodedEmail = encodeCookieEmail(normalizedEmail);
  const cookieStore = await cookies();

  adminDebug("session:cookie_set", {
    email: normalizedEmail,
    path: SESSION_COOKIE_PATH,
    expiresAt,
    maxAgeMs: ADMIN_SESSION_TTL_MS,
    hostOnly: true,
    cookieName: ADMIN_SESSION_COOKIE,
  });

  if (isWexonProductionDeployment()) {
    clearLegacyDomainCookie(cookieStore);
  }

  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    `${encodedEmail}.${expiresAt}.${signature}`,
    adminSessionCookieOptions(new Date(expiresAt)),
  );
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  adminDebug("session:cookie_clear", {
    path: SESSION_COOKIE_PATH,
    hostOnly: true,
    cookieName: ADMIN_SESSION_COOKIE,
  });

  // Clear active v2 host-only cookie.
  cookieStore.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieClearOptions());

  // Clear legacy cookie under a different name (no same-name dual-scope sets).
  if (isWexonProductionDeployment()) {
    clearLegacyDomainCookie(cookieStore);
  } else {
    // Local/preview only ever used host-only cookies; expire legacy name host-only.
    cookieStore.set(ADMIN_SESSION_COOKIE_LEGACY, "", adminSessionCookieClearOptions());
  }
}
