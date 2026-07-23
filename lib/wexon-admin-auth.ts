import { createHash, timingSafeEqual } from "crypto";
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
  ADMIN_SESSION_COOKIE_V2,
} from "@/lib/wexon-admin-session-cookie";
import {
  ADMIN_SESSION_TTL_MS,
  adminSessionCookieClearOptions,
  adminSessionCookieLegacyDomainClearOptions,
  adminSessionCookieOptions,
} from "@/lib/wexon-admin-auth-cookie-options";
import {
  ADMIN_ACCESS_GENERIC_DENIED,
  cloudflareAccessAuditSafeMeta,
  verifyCloudflareAccessJwtFromHeaders,
} from "@/lib/wexon-cloudflare-access-jwt";
import {
  buildAdminSessionV3Payload,
  encodeAdminSessionV3CookieValue,
  parseAdminSessionV3CookieValue,
} from "@/lib/wexon-admin-session-v3";
import { maskPlatformAdminEmail } from "@/lib/wexon-platform-admin";
import {
  assertActivePlatformAdminMatchesIdentity,
  resolvePlatformAdminForCloudflareAccess,
} from "@/lib/wexon-platform-admin-cloudflare-bind";
import { runWithTransactionRetry } from "@/lib/wexon-active-owner";

export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_LEGACY,
  ADMIN_SESSION_COOKIE_V2,
} from "@/lib/wexon-admin-session-cookie";
export {
  ADMIN_SESSION_TTL_MS,
  adminSessionCookieClearOptions,
  adminSessionCookieLegacyDomainClearOptions,
  adminSessionCookieOptions,
} from "@/lib/wexon-admin-auth-cookie-options";
export type { AdminSessionCookieOptions } from "@/lib/wexon-admin-auth-cookie-options";

/**
 * Admin session auth (PR2B).
 *
 * Production / all runtimes:
 * - Cloudflare Access JWT verified on every admin access check
 * - ACTIVE PlatformAdmin match (+ first-login subject bind)
 * - Host-only session cookie `wexon_admin_session_v3`
 *
 * Shared `ADMIN_LOGIN_PASSWORD` / `ADMIN_EMAILS` are NOT authorization sources.
 * Keep those env vars set for emergency rollback only (see docs).
 *
 * Cookie migration: only `ADMIN_SESSION_COOKIE` (v3) is accepted. v2 + legacy
 * are cleared on login/logout and never grant access.
 */

export const ADMIN_LOGIN_GENERIC_ERROR = ADMIN_ACCESS_GENERIC_DENIED;
export const ADMIN_PRODUCTION_LOGIN_URL = `https://admin.${PRODUCTION_ROOT_HOST}/login`;

export type AdminSession = {
  adminId: string;
  email: string;
  cloudflareSubject: string;
  issuedAt: number;
  expiresAt: number;
};

export function adminDebug(label: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[WEXON_ADMIN_DEBUG]", label, data ?? {});
  }
}

/**
 * @deprecated PR2B — not an authorization source. Retained for rollback tooling / tests only.
 */
function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @deprecated PR2B — do not use for authorization. Kept for rollback / unit coverage only.
 */
export function isAdminEmailAllowed(email: string) {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Timing-safe string compare helper (legacy shared-password tests / rollback tooling).
 * Not used by production admin authorization after PR2B.
 */
export function securePasswordEqual(provided: string, expected: string) {
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedDigest, expectedDigest);
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

function clearPriorAdminCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(ADMIN_SESSION_COOKIE_V2, "", adminSessionCookieClearOptions());
  if (isWexonProductionDeployment()) {
    cookieStore.set(ADMIN_SESSION_COOKIE_LEGACY, "", adminSessionCookieLegacyDomainClearOptions());
  } else {
    cookieStore.set(ADMIN_SESSION_COOKIE_LEGACY, "", adminSessionCookieClearOptions());
  }
}

/**
 * Parse v3 cookie only. v2/legacy values are ignored (never authorize).
 */
export function parseAdminSessionCookieValue(value: string | undefined): AdminSession | null {
  const parsed = parseAdminSessionV3CookieValue(value);
  if (!parsed) {
    adminDebug("session:parse", { hasCookie: Boolean(value), accepted: false });
    return null;
  }
  adminDebug("session:parse", {
    hasCookie: true,
    accepted: true,
    emailMasked: maskPlatformAdminEmail(parsed.email),
    expired: parsed.expiresAt < Date.now(),
  });
  return parsed;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  adminDebug("session:get", {
    hasCookie: Boolean(value),
    cookieLength: value?.length ?? 0,
    cookieName: ADMIN_SESSION_COOKIE,
  });
  return parseAdminSessionCookieValue(value);
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

/**
 * Full admin gate: host + Cloudflare JWT + v3 session consistency + active PlatformAdmin.
 */
export async function assertAdminAccess() {
  adminDebug("assert:start");
  const productionWexon = isWexonProductionDeployment();
  const host = await readRequestHost();

  if (!isAdminAccessHostAllowed(host, productionWexon)) {
    adminDebug("assert:redirect", { to: "login", reason: "wrong_host", host: normalizeHost(host) });
    redirect(await adminLoginRedirectPath());
  }

  const headerStore = await headers();
  let identity;
  try {
    identity = await verifyCloudflareAccessJwtFromHeaders(headerStore);
  } catch {
    adminDebug("assert:redirect", {
      to: "login",
      ...cloudflareAccessAuditSafeMeta({ reason: "jwt_invalid" }),
    });
    redirect(await adminLoginRedirectPath());
  }

  const session = await getAdminSession();
  if (
    !session ||
    session.email !== identity.emailNormalized ||
    session.cloudflareSubject !== identity.subject
  ) {
    adminDebug("assert:redirect", {
      to: "login",
      reason: "session_mismatch_or_missing",
      emailMasked: maskPlatformAdminEmail(identity.emailNormalized),
    });
    redirect(await adminLoginRedirectPath());
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await assertActivePlatformAdminMatchesIdentity(prisma, {
      adminId: session.adminId,
      emailNormalized: identity.emailNormalized,
      cloudflareSubject: identity.subject,
    });
  } catch {
    adminDebug("assert:redirect", {
      to: "login",
      reason: "platform_admin_denied",
      emailMasked: maskPlatformAdminEmail(identity.emailNormalized),
    });
    redirect(await adminLoginRedirectPath());
  }

  adminDebug("assert:ok", { emailMasked: maskPlatformAdminEmail(session.email) });
  return session;
}

export async function createAdminSessionCookie(input: {
  adminId: string;
  email: string;
  cloudflareSubject: string;
}) {
  const payload = buildAdminSessionV3Payload(input);
  const value = encodeAdminSessionV3CookieValue(payload);
  const cookieStore = await cookies();

  adminDebug("session:cookie_set", {
    emailMasked: maskPlatformAdminEmail(payload.email),
    path: "/",
    expiresAt: payload.expiresAt,
    maxAgeMs: ADMIN_SESSION_TTL_MS,
    hostOnly: true,
    cookieName: ADMIN_SESSION_COOKIE,
  });

  clearPriorAdminCookies(cookieStore);

  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    value,
    adminSessionCookieOptions(new Date(payload.expiresAt)),
  );
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  adminDebug("session:cookie_clear", {
    path: "/",
    hostOnly: true,
    cookieName: ADMIN_SESSION_COOKIE,
  });

  cookieStore.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieClearOptions());
  clearPriorAdminCookies(cookieStore);
}

/**
 * Verify Cloudflare JWT, bind/resolve PlatformAdmin, mint v3 session.
 * Used by the post-Access continue action (no shared password).
 */
export async function establishAdminSessionFromCloudflareAccess() {
  const headerStore = await headers();
  const identity = await verifyCloudflareAccessJwtFromHeaders(headerStore);
  const { prisma } = await import("@/lib/prisma");

  const admin = await runWithTransactionRetry(() =>
    prisma.$transaction((tx) =>
      resolvePlatformAdminForCloudflareAccess(tx, {
        emailNormalized: identity.emailNormalized,
        cloudflareSubject: identity.subject,
        touchLastLogin: true,
      }),
    ),
  );

  await createAdminSessionCookie({
    adminId: admin.id,
    email: admin.emailNormalized,
    cloudflareSubject: identity.subject,
  });

  return {
    admin,
    identity,
    sessionEmail: admin.emailNormalized,
  };
}
