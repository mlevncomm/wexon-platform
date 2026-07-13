/**
 * Postgres-backed idempotency for public QR mutations.
 * Survives serverless multi-instance runtimes (unlike in-memory maps).
 */

import { prisma } from "@/lib/prisma";

type IdempotencyEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

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

function scopeKey(scope: string, key: string) {
  return `${scope}:${key}`;
}

export async function getIdempotentResponse(scope: string, key: string | null): Promise<IdempotencyEntry | null> {
  if (!key) return null;
  const record = await prisma.publicIdempotencyRecord.findUnique({
    where: { scopeKey: scopeKey(scope, key) },
  });
  if (!record) return null;
  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.publicIdempotencyRecord.delete({ where: { id: record.id } }).catch(() => undefined);
    return null;
  }
  return {
    status: record.status,
    body: record.bodyJson,
    expiresAt: record.expiresAt.getTime(),
  };
}

export async function storeIdempotentResponse(
  scope: string,
  key: string | null,
  status: number,
  body: unknown,
  ttlMs = DEFAULT_TTL_MS,
) {
  if (!key) return;
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.publicIdempotencyRecord.upsert({
    where: { scopeKey: scopeKey(scope, key) },
    update: {
      status,
      bodyJson: body as object,
      expiresAt,
    },
    create: {
      scopeKey: scopeKey(scope, key),
      status,
      bodyJson: body as object,
      expiresAt,
    },
  });
}

/** Test helper — clears all idempotency rows (dev/test only). */
export async function clearIdempotencyStoreForTests() {
  await prisma.publicIdempotencyRecord.deleteMany({});
}
