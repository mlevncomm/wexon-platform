import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * API key hashing.
 *
 * New keys are stored with HMAC-SHA256 using `API_KEY_HASH_SECRET` (pepper).
 * Legacy keys created before this change used plain SHA-256 of the raw key;
 * verification accepts both until keys are rotated/recreated.
 *
 * MIGRATION: Revoke and recreate API keys over time so all stored hashes use
 * HMAC-SHA256. No schema migration is required.
 */

function getApiKeyHashSecret() {
  const secret = process.env.API_KEY_HASH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("API_KEY_HASH_SECRET tanımlı olmalıdır.");
  }

  return process.env.ADMIN_SESSION_SECRET ?? "dev-api-key-hash-secret";
}

function timingSafeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/** @deprecated Legacy storage format — kept for backward-compatible verification. */
export function hashApiKeyLegacy(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function hashApiKey(rawKey: string) {
  return createHmac("sha256", getApiKeyHashSecret()).update(rawKey).digest("hex");
}

export function apiKeyHashCandidates(rawKey: string) {
  return {
    hmac: hashApiKey(rawKey),
    legacy: hashApiKeyLegacy(rawKey),
  };
}

export function verifyApiKeyHash(rawKey: string, storedHash: string) {
  const { hmac, legacy } = apiKeyHashCandidates(rawKey);
  return timingSafeEqualHex(hmac, storedHash) || timingSafeEqualHex(legacy, storedHash);
}
