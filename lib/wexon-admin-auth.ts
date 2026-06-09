import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Admin session auth (MVP).
 *
 * PRODUCTION NOTE: A shared `ADMIN_LOGIN_PASSWORD` plus an email allowlist is
 * not sufficient for production admin access. Target architecture:
 * - Per-admin user records with unique password hashes (argon2/bcrypt)
 * - MFA (TOTP/WebAuthn) for privileged operations
 * - Session rotation, device binding, and audit on every admin mutation
 */

export const ADMIN_SESSION_COOKIE = "wexon_admin_session";
const SESSION_TTL_MS = 10 * 60 * 60 * 1000;
const SESSION_COOKIE_PATH = "/";

export type AdminSession = {
  email: string;
  expiresAt: number;
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
    throw new Error("ADMIN_SESSION_SECRET tanımlı olmalıdır.");
  }
  return secret;
}

export function isAdminEmailAllowed(email: string) {
  return getAdminEmails().includes(email.trim().toLowerCase());
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
  adminDebug("session:get", { hasCookie: Boolean(value), cookieLength: value?.length ?? 0 });
  return parseSessionCookie(value);
}

export async function assertAdminAccess() {
  adminDebug("assert:start");
  const session = await getAdminSession();
  if (!session) {
    adminDebug("assert:redirect", { to: "/admin/login", hasSession: false });
    redirect("/admin/login");
  }
  adminDebug("assert:ok", { email: session.email });
  return session;
}

export async function createAdminSessionCookie(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = signSession(normalizedEmail, expiresAt);
  const encodedEmail = encodeCookieEmail(normalizedEmail);
  const cookieStore = await cookies();

  adminDebug("session:cookie_set", {
    email: normalizedEmail,
    path: SESSION_COOKIE_PATH,
    expiresAt,
    maxAgeMs: SESSION_TTL_MS,
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, `${encodedEmail}.${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: SESSION_COOKIE_PATH,
    expires: new Date(expiresAt),
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  adminDebug("session:cookie_clear", { path: SESSION_COOKIE_PATH });
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: SESSION_COOKIE_PATH,
    expires: new Date(0),
  });
}
