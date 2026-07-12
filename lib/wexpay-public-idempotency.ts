/**
 * Short-lived in-memory idempotency for public QR mutations.
 * Best-effort across a single process; reduces double-submit duplicates.
 */

type IdempotencyEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const store = new Map<string, IdempotencyEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_KEY_LENGTH = 128;

export function normalizeIdempotencyKey(raw: string | null | undefined) {
  if (!raw) return null;
  const key = raw.trim();
  if (!key || key.length > MAX_KEY_LENGTH) return null;
  return key;
}

export function readIdempotencyKeyFromRequest(request: Request) {
  return normalizeIdempotencyKey(request.headers.get("idempotency-key") ?? request.headers.get("Idempotency-Key"));
}

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function getIdempotentResponse(scope: string, key: string | null) {
  if (!key) return null;
  pruneExpired();
  const entry = store.get(`${scope}:${key}`);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(`${scope}:${key}`);
    return null;
  }
  return entry;
}

export function storeIdempotentResponse(
  scope: string,
  key: string | null,
  status: number,
  body: unknown,
  ttlMs = DEFAULT_TTL_MS,
) {
  if (!key) return;
  pruneExpired();
  store.set(`${scope}:${key}`, {
    status,
    body,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Test helper */
export function clearIdempotencyStoreForTests() {
  store.clear();
}
