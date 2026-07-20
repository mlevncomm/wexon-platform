/**
 * In-memory sliding-window rate limiter.
 *
 * PRODUCTION NOTE: This store is per-process, resets on deploy, and does not
 * coordinate across multiple instances. On Vercel Fluid / multi-instance runtimes
 * an attacker can amplify limits by spreading requests across isolates.
 * Replace with Redis / Upstash (or platform edge rate limiting) before relying
 * on these limits alone for production abuse protection — see
 * docs/wexpay-public-api-rate-limits.md.
 */

import { isE2eRateLimitRelaxAllowed, isHostedProduction } from "@/lib/wexon-production-guards";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSeconds: number; resetAt: number };

/**
 * Public QR limits — rationale per endpoint:
 * - menu: read-heavy browsing, scrape/enumeration resistance
 * - order: write-cost control (stricter than prior 30/min)
 * - bill: guest status polling (~few seconds) with headroom
 * - waiter / payment-request: separate IP buckets + table cooldowns elsewhere
 * - checkout: expensive intent creation (PayTR path when enabled)
 */
export const RATE_LIMITS = {
  adminLoginIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  adminLoginEmail: { limit: 5, windowMs: 15 * 60 * 1000 },
  customerLoginIp: { limit: 15, windowMs: 15 * 60 * 1000 },
  customerLoginEmail: { limit: 8, windowMs: 15 * 60 * 1000 },
  publicQrMenu: { limit: 90, windowMs: 60 * 1000 },
  publicQrOrder: { limit: 20, windowMs: 60 * 1000 },
  publicQrCheckout: { limit: 15, windowMs: 60 * 1000 },
  publicQrBill: { limit: 90, windowMs: 60 * 1000 },
  /** @deprecated Prefer publicQrWaiterCall / publicQrPaymentRequest */
  publicQrAssist: { limit: 8, windowMs: 60 * 1000 },
  publicQrWaiterCall: { limit: 8, windowMs: 60 * 1000 },
  publicQrPaymentRequest: { limit: 8, windowMs: 60 * 1000 },
  /** Table-scoped cooldowns: 1 successful attempt per window */
  publicQrWaiterTableCooldown: { limit: 1, windowMs: 45 * 1000 },
  publicQrPaymentRequestTableCooldown: { limit: 1, windowMs: 60 * 1000 },
  paytrWebhook: { limit: 300, windowMs: 60 * 1000 },
  wexpayApi: { limit: 120, windowMs: 60 * 1000 },
  /** Public probes — generous but bounded scrape resistance */
  healthProbe: { limit: 120, windowMs: 60 * 1000 },
  staffInviteCreate: { limit: 20, windowMs: 15 * 60 * 1000 },
  staffInviteResend: { limit: 10, windowMs: 15 * 60 * 1000 },
  staffInviteAccept: { limit: 30, windowMs: 15 * 60 * 1000 },
  menuImportUpload: { limit: 20, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitConfig>;

export function buildRateLimitKey(scope: string, identifier: string) {
  return `${scope}:${identifier.trim().toLowerCase()}`;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.count >= config.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  store.set(key, entry);
  return { ok: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/** Test-only: wipe in-memory buckets. Never call from production request paths. */
export function resetRateLimitStoreForTests() {
  store.clear();
}

function shouldRelaxRateLimit() {
  if (process.env.WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT === "true") return false;
  return isE2eRateLimitRelaxAllowed();
}

/**
 * Optional low limits for isolated security E2E only (never on hosted production).
 * Env example: WEXON_PUBLIC_QR_MENU_LIMIT=5
 */
export function resolveRateLimitConfig(
  base: RateLimitConfig,
  overrideEnvKey?: string,
): RateLimitConfig {
  if (!overrideEnvKey || isHostedProduction()) return base;
  if (process.env.WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT !== "true") return base;
  const raw = Number(process.env[overrideEnvKey]);
  if (!Number.isFinite(raw) || raw < 1) return base;
  const windowRaw = Number(process.env.WEXON_PUBLIC_QR_WINDOW_MS);
  const windowMs = Number.isFinite(windowRaw) && windowRaw >= 1000 ? windowRaw : base.windowMs;
  return { limit: Math.floor(raw), windowMs };
}

export function enforceRateLimit(scope: string, identifier: string, config: RateLimitConfig): RateLimitResult {
  if (shouldRelaxRateLimit()) {
    return { ok: true, remaining: config.limit, resetAt: Date.now() + config.windowMs };
  }

  const normalizedIdentifier = identifier.trim() || "unknown";
  return checkRateLimit(buildRateLimitKey(scope, normalizedIdentifier), config);
}
