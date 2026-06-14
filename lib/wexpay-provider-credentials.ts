import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { WexPayProviderCredentialMode } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";

export const WEXPAY_PSP_PROVIDER_KEYS = ["paytr", "iyzico", "param"] as const;

export type WexPayPspProviderKey = (typeof WEXPAY_PSP_PROVIDER_KEYS)[number];

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export type WexPayProviderCredentialSummary = {
  id: string;
  provider: WexPayPspProviderKey;
  displayName: string;
  mode: WexPayProviderCredentialMode;
  isActive: boolean;
  keyFingerprint: string;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
};

export type WexPayProviderCredentialConfig = Record<string, string>;

export class WexPayProviderCredentialStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WexPayProviderCredentialStorageError";
  }
}

type CredentialAuditContext = {
  organizationId: string;
  userId?: string | null;
  ipAddress?: string | null;
};

function isPspProviderKey(provider: string): provider is WexPayPspProviderKey {
  return (WEXPAY_PSP_PROVIDER_KEYS as readonly string[]).includes(provider);
}

function getCredentialEncryptionKey(): Buffer {
  const raw = process.env.WEXPAY_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new WexPayProviderCredentialStorageError(
      "PSP credential kaydı için WEXPAY_CREDENTIAL_ENCRYPTION_KEY tanımlı olmalıdır.",
    );
  }

  const key = Buffer.from(raw, raw.length === 64 && /^[0-9a-f]+$/i.test(raw) ? "hex" : "base64");
  if (key.length !== 32) {
    throw new WexPayProviderCredentialStorageError("WEXPAY_CREDENTIAL_ENCRYPTION_KEY 32 byte olmalıdır.");
  }
  return key;
}

export function isProviderCredentialEncryptionAvailable(): boolean {
  try {
    getCredentialEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function resolveDefaultCredentialMode(): WexPayProviderCredentialMode {
  const configured = process.env.WEXPAY_PROVIDER_MODE?.trim().toUpperCase();
  if (configured === "LIVE") return WexPayProviderCredentialMode.LIVE;
  if (configured === "TEST") return WexPayProviderCredentialMode.TEST;
  return process.env.NODE_ENV === "production"
    ? WexPayProviderCredentialMode.LIVE
    : WexPayProviderCredentialMode.TEST;
}

export function computeKeyFingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 16);
}

export function maskProviderSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "****";
  return `****${trimmed.slice(-4)}`;
}

export function encryptProviderConfig(config: WexPayProviderCredentialConfig): string {
  const key = getCredentialEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = JSON.stringify(config);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** Internal-only decrypt for future adapter wiring. Never expose via API responses. */
export function decryptProviderConfig(ciphertext: string): WexPayProviderCredentialConfig {
  const key = getCredentialEncryptionKey();
  const [ivB64, authTagB64, payloadB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !payloadB64) {
    throw new Error("Invalid provider credential ciphertext format.");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(decrypted) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid provider credential payload.");
  }

  const config: WexPayProviderCredentialConfig = {};
  for (const [entryKey, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      config[entryKey] = value;
    }
  }
  return config;
}

function sanitizeProviderConfig(config: WexPayProviderCredentialConfig): WexPayProviderCredentialConfig {
  const result: WexPayProviderCredentialConfig = {};
  for (const [key, value] of Object.entries(config)) {
    const trimmed = value.trim();
    if (trimmed) result[key] = trimmed;
  }
  return result;
}

function resolvePrimarySecret(
  incomingSecret: string | null | undefined,
  config: WexPayProviderCredentialConfig,
): string {
  return (
    incomingSecret?.trim() ||
    config.secretKey?.trim() ||
    config.apiKey?.trim() ||
    config.merchantSalt?.trim() ||
    ""
  );
}

export async function prepareProviderCredentialUpsert(
  organizationId: string,
  input: {
    provider: WexPayPspProviderKey;
    mode: WexPayProviderCredentialMode;
    displayName: string;
    config: WexPayProviderCredentialConfig;
    primarySecret?: string | null;
  },
) {
  if (!isProviderCredentialEncryptionAvailable()) {
    throw new WexPayProviderCredentialStorageError(
      "PSP credential kaydı için WEXPAY_CREDENTIAL_ENCRYPTION_KEY tanımlı olmalıdır.",
    );
  }

  const existing = await prisma.wexPayProviderCredential.findUnique({
    where: {
      organizationId_provider_mode: {
        organizationId,
        provider: input.provider,
        mode: input.mode,
      },
    },
  });

  if (!existing) {
    const config = sanitizeProviderConfig(input.config);
    if (!config.merchantId) {
      throw new WexPayProviderCredentialStorageError("Merchant ID zorunludur.");
    }
    const primarySecret = resolvePrimarySecret(input.primarySecret, config);
    if (!primarySecret) {
      throw new WexPayProviderCredentialStorageError("Yeni credential için secret key zorunludur.");
    }
    return { config, primarySecret };
  }

  const existingConfig = decryptProviderConfig(existing.configCiphertext);
  const merged: WexPayProviderCredentialConfig = { ...existingConfig };
  for (const [key, value] of Object.entries(input.config)) {
    const trimmed = value.trim();
    if (trimmed) merged[key] = trimmed;
  }

  const primarySecret = resolvePrimarySecret(input.primarySecret, merged);
  if (!primarySecret) {
    throw new WexPayProviderCredentialStorageError("Credential güncellemesi için secret bulunamadı.");
  }

  return { config: merged, primarySecret };
}

function toSummary(record: {
  id: string;
  provider: string;
  displayName: string;
  mode: WexPayProviderCredentialMode;
  isActive: boolean;
  keyFingerprint: string;
  maskedKey: string;
  createdAt: Date;
  updatedAt: Date;
}): WexPayProviderCredentialSummary {
  if (!isPspProviderKey(record.provider)) {
    throw new Error(`Unsupported provider credential record: ${record.provider}`);
  }
  return {
    id: record.id,
    provider: record.provider,
    displayName: record.displayName,
    mode: record.mode,
    isActive: record.isActive,
    keyFingerprint: record.keyFingerprint,
    maskedKey: record.maskedKey,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listOrganizationProviderCredentials(
  organizationId: string,
): Promise<WexPayProviderCredentialSummary[]> {
  const records = await prisma.wexPayProviderCredential.findMany({
    where: { organizationId },
    orderBy: [{ provider: "asc" }, { mode: "asc" }],
  });
  return records.map(toSummary);
}

export async function getActiveProviderCredentialSummary(
  organizationId: string,
  provider: WexPayPspProviderKey,
  mode: WexPayProviderCredentialMode = resolveDefaultCredentialMode(),
): Promise<WexPayProviderCredentialSummary | null> {
  const record = await prisma.wexPayProviderCredential.findFirst({
    where: { organizationId, provider, mode, isActive: true },
  });
  return record ? toSummary(record) : null;
}

/** Loads and decrypts active credential for adapter use. Never log or return outside service layer. */
export async function loadActiveProviderCredentialConfig(
  organizationId: string,
  provider: WexPayPspProviderKey,
  mode: WexPayProviderCredentialMode = resolveDefaultCredentialMode(),
): Promise<{ summary: WexPayProviderCredentialSummary; config: WexPayProviderCredentialConfig } | null> {
  if (!isProviderCredentialEncryptionAvailable()) return null;

  const record = await prisma.wexPayProviderCredential.findFirst({
    where: { organizationId, provider, mode, isActive: true },
  });
  if (!record) return null;

  return {
    summary: toSummary(record),
    config: decryptProviderConfig(record.configCiphertext),
  };
}

export async function isProviderCredentialConfigured(
  organizationId: string,
  provider: WexPayPspProviderKey,
  mode: WexPayProviderCredentialMode = resolveDefaultCredentialMode(),
): Promise<boolean> {
  if (!isProviderCredentialEncryptionAvailable()) return false;

  const record = await prisma.wexPayProviderCredential.findFirst({
    where: { organizationId, provider, mode, isActive: true },
    select: { id: true },
  });
  return Boolean(record);
}

export async function assertProviderCredentialConfigured(
  organizationId: string,
  provider: WexPayPspProviderKey,
  mode: WexPayProviderCredentialMode = resolveDefaultCredentialMode(),
): Promise<void> {
  const configured = await isProviderCredentialConfigured(organizationId, provider, mode);
  if (!configured) {
    throw new Error("Provider credential is not configured.");
  }
}

export async function upsertWexPayProviderCredential(
  context: CredentialAuditContext,
  input: {
    provider: WexPayPspProviderKey;
    displayName: string;
    mode: WexPayProviderCredentialMode;
    config: WexPayProviderCredentialConfig;
    primarySecret: string;
    isActive?: boolean;
  },
) {
  if (!isProviderCredentialEncryptionAvailable()) {
    throw new WexPayProviderCredentialStorageError(
      "PSP credential kaydı için WEXPAY_CREDENTIAL_ENCRYPTION_KEY tanımlı olmalıdır.",
    );
  }

  const ciphertext = encryptProviderConfig(input.config);
  const keyFingerprint = computeKeyFingerprint(input.primarySecret);
  const maskedKey = maskProviderSecret(input.primarySecret);

  const record = await prisma.wexPayProviderCredential.upsert({
    where: {
      organizationId_provider_mode: {
        organizationId: context.organizationId,
        provider: input.provider,
        mode: input.mode,
      },
    },
    create: {
      organizationId: context.organizationId,
      provider: input.provider,
      displayName: input.displayName,
      mode: input.mode,
      isActive: input.isActive ?? true,
      configCiphertext: ciphertext,
      keyFingerprint,
      maskedKey,
    },
    update: {
      displayName: input.displayName,
      isActive: input.isActive ?? true,
      configCiphertext: ciphertext,
      keyFingerprint,
      maskedKey,
    },
  });

  await writeAuditLog({
    action: "wexpay.provider_credential.upserted",
    organizationId: context.organizationId,
    userId: context.userId ?? null,
    entityType: "WexPayProviderCredential",
    entityId: record.id,
    ipAddress: context.ipAddress ?? null,
    source: "wexpay_app",
    metadata: {
      provider: input.provider,
      mode: input.mode,
      keyFingerprint,
      maskedKey,
      isActive: record.isActive,
    },
  });

  return toSummary(record);
}

export async function deactivateWexPayProviderCredential(
  context: CredentialAuditContext,
  input: { credentialId: string },
) {
  const existing = await prisma.wexPayProviderCredential.findFirst({
    where: { id: input.credentialId, organizationId: context.organizationId },
  });
  if (!existing) {
    throw new WexPayProviderCredentialStorageError("Provider credential bulunamadı.");
  }

  const record = await prisma.wexPayProviderCredential.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  await writeAuditLog({
    action: "wexpay.provider_credential.deactivated",
    organizationId: context.organizationId,
    userId: context.userId ?? null,
    entityType: "WexPayProviderCredential",
    entityId: record.id,
    ipAddress: context.ipAddress ?? null,
    source: "wexpay_app",
    metadata: {
      provider: record.provider,
      mode: record.mode,
      keyFingerprint: record.keyFingerprint,
    },
  });

  return toSummary(record);
}

export type WexPayProviderCredentialClient = Pick<typeof prisma, "wexPayProviderCredential">;

export async function assertProviderCredentialInOrg(
  client: WexPayProviderCredentialClient,
  organizationId: string,
  credentialId: string,
) {
  const record = await client.wexPayProviderCredential.findFirst({
    where: { id: credentialId, organizationId },
  });
  if (!record) {
    throw new Error("Provider credential not found.");
  }
  return record;
}

export function sanitizeProviderCredentialAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set(["config", "configCiphertext", "primarySecret", "merchantKey", "merchantSalt", "secretKey"]);
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
}
