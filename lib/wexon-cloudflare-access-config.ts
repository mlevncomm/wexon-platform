/**
 * Cloudflare Access runtime config (team domain + audience).
 * Never hardcode production team/AUD values — read from env only.
 */

import { isHostedProduction } from "@/lib/wexon-production-guards";

export const CF_ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
/** Spoof-prone identity header — never authorize from this alone. */
export const CF_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

export const ADMIN_ACCESS_GENERIC_DENIED = "Yönetim paneline erişim reddedildi.";
export const ADMIN_ACCESS_GENERIC_CONFIG = "Yönetim paneli yapılandırması eksik.";

export type CloudflareAccessConfig = {
  teamDomain: string;
  audience: string;
  issuer: string;
  jwksUrl: URL;
};

function trimEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

/**
 * Test-only CF Access overrides.
 * Allowed when NODE_ENV=test OR WEXON_CF_ACCESS_TEST_MODE=1,
 * and NEVER when Vercel hosted production.
 */
export function isCloudflareAccessTestMode(): boolean {
  if (isHostedProduction()) return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "test") return true;
  return process.env.WEXON_CF_ACCESS_TEST_MODE === "1";
}

/** True when CF Access JWT verification is mandatory (production Wexon or non-test runtimes). */
export function isCloudflareAccessRequired(): boolean {
  // Test mode still verifies JWTs — against the local JWKS provider.
  // Shared-password bypass is never available.
  return true;
}

export function resolveCloudflareAccessConfig():
  | { ok: true; config: CloudflareAccessConfig }
  | { ok: false; reason: "missing_config" | "invalid_team_domain" } {
  const teamDomain = trimEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const audience = trimEnv("CLOUDFLARE_ACCESS_AUD");

  if (!teamDomain || !audience) {
    return { ok: false, reason: "missing_config" };
  }

  // Canonical team hostname only (no user-controlled path / scheme injection).
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(teamDomain) || teamDomain.includes("..")) {
    return { ok: false, reason: "invalid_team_domain" };
  }

  const issuer = `https://${teamDomain}`;
  return {
    ok: true,
    config: {
      teamDomain,
      audience,
      issuer,
      jwksUrl: new URL(`${issuer}/cdn-cgi/access/certs`),
    },
  };
}
