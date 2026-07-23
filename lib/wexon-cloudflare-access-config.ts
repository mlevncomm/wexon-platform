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

/** Canonical Cloudflare Access team host suffix (non-test runtimes). */
export const CF_ACCESS_TEAM_DOMAIN_SUFFIX = ".cloudflareaccess.com";
/** Local/CI test-only team domain suffix (never on Vercel production/preview). */
export const CF_ACCESS_TEST_TEAM_DOMAIN_SUFFIX = ".example.invalid";

export type CloudflareAccessConfig = {
  teamDomain: string;
  audience: string;
  issuer: string;
  jwksUrl: URL;
};

function trimEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function vercelDeployEnv() {
  return (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
}

/**
 * Test-only CF Access overrides (local JWKS / minted JWTs).
 *
 * Allowed only for real local/CI:
 * - `NODE_ENV=test` (CI unit/E2E), or
 * - explicit `WEXON_CF_ACCESS_TEST_MODE=1`
 *
 * Never on hosted Vercel production or preview — even if the opt-in flag is set.
 */
export function isCloudflareAccessTestMode(): boolean {
  const vercelEnv = vercelDeployEnv();
  if (vercelEnv === "production" || vercelEnv === "preview") return false;
  if (isHostedProduction()) return false;

  if (process.env.NODE_ENV === "test") return true;
  return process.env.WEXON_CF_ACCESS_TEST_MODE === "1";
}

/** True when CF Access JWT verification is mandatory (production Wexon or non-test runtimes). */
export function isCloudflareAccessRequired(): boolean {
  // Test mode still verifies JWTs — against the local JWKS provider.
  // Shared-password bypass is never available.
  return true;
}

export function isCanonicalCloudflareAccessTeamDomain(teamDomain: string): boolean {
  const host = teamDomain.trim().toLowerCase();
  return (
    host.endsWith(CF_ACCESS_TEAM_DOMAIN_SUFFIX) &&
    host.length > CF_ACCESS_TEAM_DOMAIN_SUFFIX.length &&
    !host.includes("..")
  );
}

export function isLocalTestCloudflareAccessTeamDomain(teamDomain: string): boolean {
  const host = teamDomain.trim().toLowerCase();
  return (
    host.endsWith(CF_ACCESS_TEST_TEAM_DOMAIN_SUFFIX) &&
    host.length > CF_ACCESS_TEST_TEAM_DOMAIN_SUFFIX.length &&
    !host.includes("..")
  );
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

  const testMode = isCloudflareAccessTestMode();
  if (testMode) {
    // Local test provider `.example.invalid` OR real Cloudflare Access host.
    if (
      !isLocalTestCloudflareAccessTeamDomain(teamDomain) &&
      !isCanonicalCloudflareAccessTeamDomain(teamDomain)
    ) {
      return { ok: false, reason: "invalid_team_domain" };
    }
  } else if (!isCanonicalCloudflareAccessTeamDomain(teamDomain)) {
    // Non-test runtime: only *.cloudflareaccess.com.
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
