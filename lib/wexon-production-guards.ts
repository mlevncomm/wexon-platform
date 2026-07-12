/**
 * Production / E2E environment guards.
 * Keep demo/dev bypass and rate-limit relaxation out of real hosted production.
 */

/** Hosted production (Vercel) or intentional production E2E target. */
export function isHostedProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function isRuntimeProduction() {
  return process.env.NODE_ENV === "production" || isHostedProduction();
}

export function getE2eTarget() {
  return (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
}

/**
 * Dev password bypass for users without passwordHash.
 * Allowed only when NODE_ENV is not production and the password env is set.
 * (Local Playwright uses `next start` with NODE_ENV=production — bypass stays off there.)
 */
export function isCustomerDevLoginAllowed() {
  if (isRuntimeProduction()) return false;
  if (!process.env.CUSTOMER_DEV_LOGIN_PASSWORD?.trim()) return false;
  return true;
}

/**
 * Rate-limit relaxation for Playwright.
 *
 * Local E2E runs `next start` with NODE_ENV=production, so we cannot key only
 * on NODE_ENV. Relax is allowed when the flag is set AND we are not on hosted
 * Vercel production AND E2E target is not production.
 */
export function isE2eRateLimitRelaxAllowed() {
  if (process.env.WEXON_E2E_RELAX_RATE_LIMIT !== "true") return false;
  if (isHostedProduction()) return false;
  if (getE2eTarget() === "production") return false;
  return true;
}

/** Env names that must be unset in production deployments. */
export const PRODUCTION_FORBIDDEN_ENVS = [
  "CUSTOMER_DEV_LOGIN_PASSWORD",
  "WEXON_E2E_RELAX_RATE_LIMIT",
] as const;

export function listForbiddenProductionEnvsSet() {
  return PRODUCTION_FORBIDDEN_ENVS.filter((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}
