/**
 * Local/CI-only admin continue login: mint CF Access test JWT + bind PlatformAdmin.
 * Hard-denied unless isCloudflareAccessTestMode().
 */

import { cookies } from "next/headers";
import { importJWK, SignJWT, type JWK } from "jose";
import {
  CF_ACCESS_TEST_JWT_COOKIE,
  cfAccessTestJwtCookieClearOptions,
  cfAccessTestJwtCookieOptions,
} from "@/lib/wexon-cloudflare-access-test-cookie";
import {
  CF_ACCESS_JWT_HEADER,
  isCloudflareAccessTestMode,
  resolveCloudflareAccessConfig,
} from "@/lib/wexon-cloudflare-access-config";
import {
  CloudflareAccessJwtError,
  verifyCloudflareAccessJwtFromHeaders,
} from "@/lib/wexon-cloudflare-access-jwt";
import { createAdminSessionCookie } from "@/lib/wexon-admin-auth";
import { runWithTransactionRetry } from "@/lib/wexon-active-owner";
import { resolvePlatformAdminForCloudflareAccess } from "@/lib/wexon-platform-admin-cloudflare-bind";
import { normalizePlatformAdminEmail } from "@/lib/wexon-platform-admin";

const TEST_JWT_TTL_SECONDS = 60 * 60 * 8;

function e2eCloudflareSubject(emailNormalized: string) {
  return `local-cf-subject:${emailNormalized}`;
}

export function defaultLocalAdminTestEmail() {
  return (
    process.env.E2E_ADMIN_EMAIL?.trim() ||
    (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ||
    ""
  );
}

export async function mintCloudflareAccessTestJwt(email: string) {
  if (!isCloudflareAccessTestMode()) {
    throw new CloudflareAccessJwtError("missing_config");
  }
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    throw new CloudflareAccessJwtError("missing_config");
  }

  const resolved = resolveCloudflareAccessConfig();
  if (!resolved.ok) {
    throw new CloudflareAccessJwtError("missing_config");
  }

  const privateRaw = (process.env.WEXON_CF_ACCESS_TEST_PRIVATE_JWK ?? "").trim();
  if (!privateRaw) {
    throw new CloudflareAccessJwtError("missing_config");
  }

  const emailNormalized = normalizePlatformAdminEmail(email);
  if (!emailNormalized || !emailNormalized.includes("@")) {
    throw new CloudflareAccessJwtError("missing_claims");
  }

  const privateJwk = JSON.parse(privateRaw) as JWK;
  const key = await importJWK(privateJwk, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ email: email.trim() })
    .setProtectedHeader({
      alg: "RS256",
      kid: typeof privateJwk.kid === "string" ? privateJwk.kid : undefined,
      typ: "JWT",
    })
    .setIssuer(resolved.config.issuer)
    .setAudience(resolved.config.audience)
    .setSubject(e2eCloudflareSubject(emailNormalized))
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + TEST_JWT_TTL_SECONDS)
    .sign(key);
}

export async function setCloudflareAccessTestJwtCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    CF_ACCESS_TEST_JWT_COOKIE,
    token,
    cfAccessTestJwtCookieOptions(new Date(Date.now() + TEST_JWT_TTL_SECONDS * 1000)),
  );
}

export async function clearCloudflareAccessTestJwtCookie() {
  const cookieStore = await cookies();
  cookieStore.set(CF_ACCESS_TEST_JWT_COOKIE, "", cfAccessTestJwtCookieClearOptions());
}

/**
 * Mint test JWT → verify via the same JWKS path → bind PlatformAdmin → session + cookie.
 */
export async function establishAdminSessionFromCloudflareAccessTestLogin(email: string) {
  if (!isCloudflareAccessTestMode()) {
    throw new CloudflareAccessJwtError("missing_config");
  }

  const token = await mintCloudflareAccessTestJwt(email);
  const headerStore = new Headers({ [CF_ACCESS_JWT_HEADER]: token });
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
  await setCloudflareAccessTestJwtCookie(token);

  return {
    admin,
    identity,
    sessionEmail: admin.emailNormalized,
  };
}
