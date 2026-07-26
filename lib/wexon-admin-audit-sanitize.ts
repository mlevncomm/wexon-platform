/**
 * Recursive sanitization for admin mutation audit metadata.
 * Masks emails and provider refs; strips secrets entirely.
 */

const SECRET_KEY =
  /^(password|passwordhash|passwd|secret|token|apikey|api_key|authorization|cookie|jwt|raw|callback|merchantkey|merchant_key|credential|privatekey|private_key)$/i;
const EMAIL_KEY = /(email|actorEmail|userEmail|toEmail|fromEmail)$/i;
const REF_KEY = /(merchantOid|providerRef|provider_ref|paymentToken|payment_token)$/i;

export function maskEmailForAudit(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function maskProviderRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "***";
  return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

export function sanitizeAdminAuditValue(value: unknown, keyHint = ""): unknown {
  if (value == null) return value;
  if (SECRET_KEY.test(keyHint)) return undefined;
  if (typeof value === "string") {
    if (EMAIL_KEY.test(keyHint) || (value.includes("@") && EMAIL_KEY.test(keyHint))) {
      return maskEmailForAudit(value);
    }
    if (REF_KEY.test(keyHint)) return maskProviderRef(value);
    if (/^[A-Za-z0-9+/]{40,}={0,2}$/.test(value) && /token|secret|jwt|hash/i.test(keyHint)) {
      return undefined;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item, index) => sanitizeAdminAuditValue(item, `${keyHint}[${index}]`))
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) continue;
      const sanitized = sanitizeAdminAuditValue(child, key);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }
  return value;
}

export function sanitizeAdminAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const sanitized = sanitizeAdminAuditValue(metadata, "metadata");
  return isPlainObject(sanitized) ? sanitized : {};
}
