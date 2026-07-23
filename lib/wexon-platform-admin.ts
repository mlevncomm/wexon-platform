/**
 * PlatformAdmin domain (PR2A foundation).
 *
 * Separate from tenant User/Membership. No role system.
 * Auth cutover (Cloudflare JWT, session v3, shared-password removal) is PR2B.
 */

import { Prisma } from ".prisma/client";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { runWithTransactionRetry } from "@/lib/wexon-active-owner";

function asAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Interactive transaction client (or compatible root client with the same delegates). */
export type PlatformAdminClient = {
  platformAdmin: Prisma.TransactionClient["platformAdmin"];
  auditLog: Prisma.TransactionClient["auditLog"];
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export type PlatformAdminRecord = {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string;
  isActive: boolean;
  cloudflareSubject: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class LastActivePlatformAdminError extends Error {
  readonly code = "last_active_platform_admin" as const;

  constructor(message = "Son aktif platform yöneticisi pasife alınamaz. Önce başka bir aktif yönetici ekleyin.") {
    super(message);
    this.name = "LastActivePlatformAdminError";
  }
}

export class PlatformAdminDuplicateEmailError extends Error {
  readonly code = "platform_admin_duplicate_email" as const;

  constructor(message = "Bu e-posta ile kayıtlı bir platform yöneticisi zaten var.") {
    super(message);
    this.name = "PlatformAdminDuplicateEmailError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 120;

/** trim + lowercase canonical identity for uniqueness. */
export function normalizePlatformAdminEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Audit-safe email mask: a***@domain (never full address). */
export function maskPlatformAdminEmail(email: string): string {
  const normalized = normalizePlatformAdminEmail(email);
  const at = normalized.indexOf("@");
  if (at < 1) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return "***";
  const visible = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${visible}@${domain}`;
}

export function parsePlatformAdminEmail(raw: string): { email: string; emailNormalized: string } {
  const email = String(raw ?? "").trim();
  if (!email) {
    throw new AdminValidationError("E-posta zorunludur.");
  }
  const emailNormalized = normalizePlatformAdminEmail(email);
  if (!EMAIL_RE.test(emailNormalized)) {
    throw new AdminValidationError("Geçerli bir e-posta adresi girin.");
  }
  return { email, emailNormalized };
}

export function parsePlatformAdminDisplayName(raw: string): string {
  const displayName = String(raw ?? "").trim();
  if (!displayName) {
    throw new AdminValidationError("Görünen ad zorunludur.");
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    throw new AdminValidationError(`Görünen ad en fazla ${DISPLAY_NAME_MAX} karakter olabilir.`);
  }
  return displayName;
}

/**
 * Pure status decision for activate/deactivate.
 * Deactivating when this row is the only active admin is blocked.
 */
export function decidePlatformAdminActiveStatus(input: {
  currentlyActive: boolean;
  otherActiveCount: number;
  nextActive: boolean;
}): { ok: true; nextActive: boolean } | { ok: false; reason: "last_active_platform_admin" } {
  if (input.nextActive) {
    return { ok: true, nextActive: true };
  }
  if (!input.currentlyActive) {
    // Already inactive — no-op deactivate is fine.
    return { ok: true, nextActive: false };
  }
  if (input.otherActiveCount < 1) {
    return { ok: false, reason: "last_active_platform_admin" };
  }
  return { ok: true, nextActive: false };
}

export type PlatformAdminReadiness = {
  activeCount: number;
  recommendAtLeastTwo: boolean;
  cloudflareIdentity: "PR2B'de bağlanacak";
  sharedPasswordTransitional: true;
  message: string;
};

export function evaluatePlatformAdminReadiness(activeCount: number): PlatformAdminReadiness {
  const recommendAtLeastTwo = activeCount < 2;
  return {
    activeCount,
    recommendAtLeastTwo,
    cloudflareIdentity: "PR2B'de bağlanacak",
    sharedPasswordTransitional: true,
    message: recommendAtLeastTwo
      ? "En az 2 aktif platform yöneticisi önerilir. Paylaşılan admin şifresi geçiş sürecinde hâlâ kullanılmaktadır."
      : "Paylaşılan admin şifresi geçiş sürecinde hâlâ kullanılmaktadır. Cloudflare kimliği PR2B'de bağlanacak.",
  };
}

/** Cloudflare subject shown only as connected/not — never the raw subject. */
export function formatCloudflareSubjectStatus(subject: string | null | undefined): "Bağlandı" | "Bağlanmadı" {
  return subject && String(subject).trim() ? "Bağlandı" : "Bağlanmadı";
}

export function buildPlatformAdminAuditMetadata(input: {
  email: string;
  displayName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    emailMasked: maskPlatformAdminEmail(input.email),
    source: "admin_platform_admin_management",
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
    ...(input.before ? { before: sanitizeAuditStatusSlice(input.before) } : {}),
    ...(input.after ? { after: sanitizeAuditStatusSlice(input.after) } : {}),
    ...(input.extra ?? {}),
  };
  return sanitizePlatformAdminAuditMetadata(metadata);
}

/** Strip secrets / subjects / raw emails from audit metadata. */
export function sanitizePlatformAdminAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const forbidden = new Set([
    "email",
    "emailNormalized",
    "cloudflareSubject",
    "subject",
    "jwt",
    "token",
    "password",
    "secret",
    "ADMIN_LOGIN_PASSWORD",
    "ADMIN_EMAILS",
    "ADMIN_SESSION_SECRET",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (forbidden.has(key)) continue;
    if (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret")) continue;
    if (key.toLowerCase().includes("jwt") || key.toLowerCase().includes("token")) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      out[key] = sanitizePlatformAdminAuditMetadata(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function sanitizeAuditStatusSlice(slice: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(["isActive", "displayName"]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(slice)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}

/** Serializes last-active PlatformAdmin mutations across concurrent deactivations. */
export async function lockPlatformAdminActiveGuard(tx: Pick<PlatformAdminClient, "$executeRaw">) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"platform-admin"}), hashtext(${"last-active"}))`;
}

export async function lockPlatformAdminForUpdate(
  tx: Pick<PlatformAdminClient, "$queryRaw">,
  id: string,
): Promise<PlatformAdminRecord | null> {
  const rows = await tx.$queryRaw<PlatformAdminRecord[]>`
    SELECT id, email, "emailNormalized", "displayName", "isActive", "cloudflareSubject",
           "lastLoginAt", "createdAt", "updatedAt"
    FROM "PlatformAdmin"
    WHERE id = ${id}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function countOtherActivePlatformAdmins(
  tx: PlatformAdminClient,
  excludingId: string,
): Promise<number> {
  return tx.platformAdmin.count({
    where: { isActive: true, id: { not: excludingId } },
  });
}

export async function assertPlatformAdminDeactivationAllowed(
  tx: PlatformAdminClient,
  adminId: string,
): Promise<void> {
  await lockPlatformAdminActiveGuard(tx);
  const others = await countOtherActivePlatformAdmins(tx, adminId);
  const decision = decidePlatformAdminActiveStatus({
    currentlyActive: true,
    otherActiveCount: others,
    nextActive: false,
  });
  if (!decision.ok) {
    throw new LastActivePlatformAdminError();
  }
}

export type CreatePlatformAdminInput = {
  email: string;
  displayName: string;
};

export type UpdatePlatformAdminDisplayNameInput = {
  id: string;
  displayName: string;
};

export type SetPlatformAdminActiveInput = {
  id: string;
  isActive: boolean;
};

export type PlatformAdminActor = {
  email: string;
};

function actorMeta(actor: PlatformAdminActor) {
  return {
    type: "admin_session",
    emailMasked: maskPlatformAdminEmail(actor.email),
  };
}

export async function createPlatformAdminRecord(
  client: PlatformAdminClient,
  input: CreatePlatformAdminInput,
  actor: PlatformAdminActor,
): Promise<PlatformAdminRecord> {
  const { email, emailNormalized } = parsePlatformAdminEmail(input.email);
  const displayName = parsePlatformAdminDisplayName(input.displayName);

  const existing = await client.platformAdmin.findUnique({ where: { emailNormalized } });
  if (existing) {
    throw new PlatformAdminDuplicateEmailError();
  }

  try {
    const created = await client.platformAdmin.create({
      data: {
        email,
        emailNormalized,
        displayName,
        isActive: true,
      },
    });
    await client.auditLog.create({
      data: {
        organizationId: null,
        userId: null,
        action: "admin.platform_admin.created",
        entityType: "PlatformAdmin",
        entityId: created.id,
        metadataJson: asAuditJson(
          buildPlatformAdminAuditMetadata({
            email: created.email,
            displayName: created.displayName,
            after: { isActive: true, displayName: created.displayName },
            extra: { actor: actorMeta(actor) },
          }),
        ),
      },
    });
    return created;
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new PlatformAdminDuplicateEmailError();
    }
    throw error;
  }
}

export async function updatePlatformAdminDisplayNameRecord(
  client: PlatformAdminClient,
  input: UpdatePlatformAdminDisplayNameInput,
  actor: PlatformAdminActor,
): Promise<PlatformAdminRecord> {
  const displayName = parsePlatformAdminDisplayName(input.displayName);
  const locked = await lockPlatformAdminForUpdate(client, input.id);
  if (!locked) {
    throw new AdminValidationError("Platform yöneticisi bulunamadı.");
  }
  const updated = await client.platformAdmin.update({
    where: { id: input.id },
    data: { displayName },
  });
  await client.auditLog.create({
    data: {
      organizationId: null,
      userId: null,
      action: "admin.platform_admin.display_name_updated",
      entityType: "PlatformAdmin",
      entityId: updated.id,
      metadataJson: asAuditJson(
        buildPlatformAdminAuditMetadata({
          email: updated.email,
          before: { displayName: locked.displayName },
          after: { displayName: updated.displayName },
          extra: { actor: actorMeta(actor) },
        }),
      ),
    },
  });
  return updated;
}

export async function setPlatformAdminActiveRecord(
  client: PlatformAdminClient,
  input: SetPlatformAdminActiveInput,
  actor: PlatformAdminActor,
): Promise<PlatformAdminRecord> {
  const locked = await lockPlatformAdminForUpdate(client, input.id);
  if (!locked) {
    throw new AdminValidationError("Platform yöneticisi bulunamadı.");
  }

  if (locked.isActive === input.isActive) {
    return locked;
  }

  if (!input.isActive) {
    await assertPlatformAdminDeactivationAllowed(client, input.id);
  } else {
    // Reactivation still takes the advisory lock so it serializes with deactivations.
    await lockPlatformAdminActiveGuard(client);
  }

  const updated = await client.platformAdmin.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  });

  await client.auditLog.create({
    data: {
      organizationId: null,
      userId: null,
      action: input.isActive ? "admin.platform_admin.reactivated" : "admin.platform_admin.deactivated",
      entityType: "PlatformAdmin",
      entityId: updated.id,
      metadataJson: asAuditJson(
        buildPlatformAdminAuditMetadata({
          email: updated.email,
          displayName: updated.displayName,
          before: { isActive: locked.isActive },
          after: { isActive: updated.isActive },
          extra: { actor: actorMeta(actor) },
        }),
      ),
    },
  });

  return updated;
}

export async function listPlatformAdmins(client: PlatformAdminClient): Promise<PlatformAdminRecord[]> {
  return client.platformAdmin.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}

export async function countActivePlatformAdmins(client: PlatformAdminClient): Promise<number> {
  return client.platformAdmin.count({ where: { isActive: true } });
}

export async function runPlatformAdminMutation<T>(run: () => Promise<T>): Promise<T> {
  return runWithTransactionRetry(run);
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
