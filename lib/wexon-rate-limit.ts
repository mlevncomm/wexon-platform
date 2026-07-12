/**
 * In-memory sliding-window rate limiter.
 *
 * PRODUCTION NOTE: This store is per-process, resets on deploy, and does not
 * coordinate across multiple instances. Replace with Redis / Upstash (or edge
 * rate limiting) before running multi-instance production traffic.
 */

import { isE2eRateLimitRelaxAllowed } from "@/lib/wexon-production-guards";

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

export const RATE_LIMITS = {
  adminLoginIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  adminLoginEmail: { limit: 5, windowMs: 15 * 60 * 1000 },
  customerLoginIp: { limit: 15, windowMs: 15 * 60 * 1000 },
  customerLoginEmail: { limit: 8, windowMs: 15 * 60 * 1000 },
  publicQrOrder: { limit: 30, windowMs: 60 * 1000 },
  publicQrCheckout: { limit: 20, windowMs: 60 * 1000 },
  publicQrBill: { limit: 60, windowMs: 60 * 1000 },
  publicQrAssist: { limit: 20, windowMs: 60 * 1000 },
  paytrWebhook: { limit: 300, windowMs: 60 * 1000 },
  wexpayApi: { limit: 120, windowMs: 60 * 1000 },
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

export function enforceRateLimit(scope: string, identifier: string, config: RateLimitConfig): RateLimitResult {
  // Local/test E2E only — ignored when NODE_ENV/VERCEL_ENV is production.
  if (isE2eRateLimitRelaxAllowed()) {
    return { ok: true, remaining: config.limit, resetAt: Date.now() + config.windowMs };
  }

  const normalizedIdentifier = identifier.trim() || "unknown";
  return checkRateLimit(buildRateLimitKey(scope, normalizedIdentifier), config);
}
