import { createHash } from "node:crypto";

export type PublicQrKeyKind = "legacy" | "opaque" | "unknown";

export type PublicQrAuditReference = {
  keyKind: PublicQrKeyKind;
  publicKeyHash: string;
  tableId?: string;
  branchId?: string;
  tokenId?: string;
  tokenPrefix?: string;
  kind?: string;
  retryAfterSeconds?: number;
  orderId?: string | null;
  amount?: number;
  providerRef?: string;
  reason?: string;
};

const ALLOWED_AUDIT_KEYS = new Set<keyof PublicQrAuditReference>([
  "keyKind",
  "publicKeyHash",
  "tableId",
  "branchId",
  "tokenId",
  "tokenPrefix",
  "kind",
  "retryAfterSeconds",
  "orderId",
  "amount",
  "providerRef",
  "reason",
]);

/** SHA-256 hex of a public key. Never store or log the plaintext input elsewhere. */
export function hashPublicQrKey(publicKey: string): string {
  return createHash("sha256").update(String(publicKey ?? "").trim(), "utf8").digest("hex");
}

/**
 * Allowlist-only audit metadata for public QR flows.
 * Plaintext qrCode / opaque token / publicKey must never appear.
 */
export function buildPublicQrAuditReference(input: {
  publicKey?: string | null;
  keyKind?: PublicQrKeyKind;
  tableId?: string | null;
  branchId?: string | null;
  tokenId?: string | null;
  tokenPrefix?: string | null;
  kind?: string;
  retryAfterSeconds?: number;
  orderId?: string | null;
  amount?: number;
  providerRef?: string;
  reason?: string;
}): PublicQrAuditReference {
  const keyKind = input.keyKind ?? "unknown";
  const publicKeyHash = hashPublicQrKey(input.publicKey ?? "");
  const raw: PublicQrAuditReference = {
    keyKind,
    publicKeyHash,
    ...(input.tableId ? { tableId: input.tableId } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.tokenId ? { tokenId: input.tokenId } : {}),
    ...(input.tokenPrefix ? { tokenPrefix: input.tokenPrefix } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(typeof input.retryAfterSeconds === "number"
      ? { retryAfterSeconds: input.retryAfterSeconds }
      : {}),
    ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
    ...(typeof input.amount === "number" ? { amount: input.amount } : {}),
    ...(input.providerRef ? { providerRef: input.providerRef } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  };

  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => ALLOWED_AUDIT_KEYS.has(key as keyof PublicQrAuditReference)),
  ) as PublicQrAuditReference;
}

/** Infer key kind without treating unknown shapes as opaque by default. */
export function inferPublicQrKeyKind(publicKey: string): PublicQrKeyKind {
  const trimmed = publicKey.trim();
  if (!trimmed) return "unknown";
  // Legacy seed/fixture codes and WXP-* uuids.
  if (/^WXP-/i.test(trimmed) || /^WEXPAY-/i.test(trimmed)) return "legacy";
  // Canonical opaque tokens are base64url of >=32 bytes (~43+ chars, no padding).
  if (/^[A-Za-z0-9_-]{40,}$/.test(trimmed)) return "opaque";
  return "unknown";
}
