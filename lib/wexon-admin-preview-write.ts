/**
 * Admin WexPay preview write capability (PR3).
 *
 * Short-lived, host-only, HMAC-signed cookie. Default preview is read-only.
 * Mutations for admin_session require a valid capability for the target org.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import {
  adminSessionCookieClearOptions,
  adminSessionCookieOptions,
  type AdminSessionCookieOptions,
} from "@/lib/wexon-admin-auth-cookie-options";
import {
  assertAdminAccess,
  getAdminSession,
  readRequestHost,
  type AdminSession,
} from "@/lib/wexon-admin-auth";
import {
  cloudflareAccessAuditSafeMeta,
  verifyCloudflareAccessJwtFromHeaders,
} from "@/lib/wexon-cloudflare-access-jwt";
import {
  isAdminHost,
  isWexonProductionDeployment,
  normalizeHost,
  resolveHostSurface,
} from "@/lib/wexon-canonical-host";
import { assertActivePlatformAdminMatchesIdentity } from "@/lib/wexon-platform-admin-cloudflare-bind";
import { maskPlatformAdminEmail, sanitizePlatformAdminAuditMetadata } from "@/lib/wexon-platform-admin";
import { writeAuditFailure, writeAuditLog, type AuditClient } from "@/lib/wexon-audit";
import { prisma } from "@/lib/prisma";

export const ADMIN_PREVIEW_WRITE_COOKIE = "wexon_admin_preview_write_v1";
export const ADMIN_PREVIEW_WRITE_TTL_MS = 10 * 60 * 1000;
export const ADMIN_PREVIEW_WRITE_REASON_MIN = 8;
export const ADMIN_PREVIEW_WRITE_REASON_MAX = 500;

/** pw2 adds writeSessionId; older pw1 cookies fail closed. */
export const ADMIN_PREVIEW_WRITE_CAPABILITY_VERSION = "pw2";
const CAPABILITY_VERSION = ADMIN_PREVIEW_WRITE_CAPABILITY_VERSION;
const CAPABILITY_PART_COUNT = 9;

export type AdminPreviewWriteCapability = {
  adminId: string;
  cloudflareSubject: string;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
  reasonHash: string;
  /** Secure per-enable nonce linking enable → mutation audits. */
  writeSessionId: string;
};

/** Bound into WexPayMutationContext so domain tx + audit share one Prisma client. */
export type AdminPreviewWriteAuditBinding = {
  actionKey: string;
  /** Verified capability organization — must match mutation context.organizationId. */
  organizationId: string;
  adminId: string;
  email: string;
  cloudflareSubject: string;
  reasonHash: string;
  writeSessionId: string;
  writeModeExpiry: number;
};

export type AdminPreviewWriteDenialReason =
  | "unauthenticated"
  | "jwt_invalid"
  | "session_mismatch"
  | "platform_admin_inactive"
  | "wrong_host"
  | "missing_capability"
  | "capability_mismatch"
  | "capability_expired"
  | "capability_tampered"
  | "organization_inactive"
  | "organization_demo"
  | "organization_missing"
  | "slug_mismatch"
  | "reason_invalid"
  | "rate_limited"
  | "audit_failed";

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Admin oturum yapılandırması eksik.");
  }
  return secret;
}

function encodePart(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodePart(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function createAdminPreviewWriteSessionId() {
  return randomBytes(16).toString("hex");
}

function signingInput(payload: AdminPreviewWriteCapability) {
  return [
    CAPABILITY_VERSION,
    payload.adminId,
    payload.cloudflareSubject,
    payload.organizationId,
    String(payload.issuedAt),
    String(payload.expiresAt),
    payload.reasonHash,
    payload.writeSessionId,
  ].join(".");
}

function signPayload(payload: AdminPreviewWriteCapability) {
  return createHmac("sha256", getSessionSecret()).update(signingInput(payload)).digest("hex");
}

function signaturesEqual(expected: string, provided: string) {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashPreviewWriteReason(reason: string) {
  return createHash("sha256").update(reason.trim(), "utf8").digest("hex").slice(0, 32);
}

export function validatePreviewWriteEnableInput(input: {
  slug: string;
  reason: string;
  expectedSlug: string;
}): { ok: true } | { ok: false; reason: "slug_mismatch" | "reason_invalid"; message: string } {
  const slug = input.slug.trim();
  const expected = input.expectedSlug.trim();
  const reason = input.reason.trim();

  if (!slug || !expected || slug !== expected) {
    return {
      ok: false,
      reason: "slug_mismatch",
      message: "Organizasyon slug doğrulaması başarısız.",
    };
  }

  if (reason.length < ADMIN_PREVIEW_WRITE_REASON_MIN || reason.length > ADMIN_PREVIEW_WRITE_REASON_MAX) {
    return {
      ok: false,
      reason: "reason_invalid",
      message: `Yazma nedeni en az ${ADMIN_PREVIEW_WRITE_REASON_MIN} karakter olmalıdır.`,
    };
  }

  return { ok: true };
}

export function buildAdminPreviewWriteCapability(input: {
  adminId: string;
  cloudflareSubject: string;
  organizationId: string;
  reason: string;
  now?: number;
  ttlMs?: number;
  writeSessionId?: string;
}): AdminPreviewWriteCapability {
  const issuedAt = input.now ?? Date.now();
  const ttlMs = Math.min(input.ttlMs ?? ADMIN_PREVIEW_WRITE_TTL_MS, ADMIN_PREVIEW_WRITE_TTL_MS);
  return {
    adminId: input.adminId,
    cloudflareSubject: input.cloudflareSubject,
    organizationId: input.organizationId,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    reasonHash: hashPreviewWriteReason(input.reason),
    writeSessionId: input.writeSessionId ?? createAdminPreviewWriteSessionId(),
  };
}

export function encodeAdminPreviewWriteCookieValue(payload: AdminPreviewWriteCapability): string {
  const signature = signPayload(payload);
  return [
    CAPABILITY_VERSION,
    encodePart(payload.adminId),
    encodePart(payload.cloudflareSubject),
    encodePart(payload.organizationId),
    String(payload.issuedAt),
    String(payload.expiresAt),
    encodePart(payload.reasonHash),
    encodePart(payload.writeSessionId),
    signature,
  ].join(".");
}

export function parseAdminPreviewWriteCookieValue(
  value: string | undefined | null,
  options: { now?: number; ignoreExpiry?: boolean } = {},
): AdminPreviewWriteCapability | null {
  if (!value) return null;
  const parts = value.split(".");
  // Fail closed on legacy pw1 (8 parts) and any other shape.
  if (parts.length !== CAPABILITY_PART_COUNT) return null;
  const [
    version,
    encAdminId,
    encSubject,
    encOrgId,
    issuedRaw,
    expiresRaw,
    encReasonHash,
    encWriteSessionId,
    signature,
  ] = parts;
  if (
    version !== CAPABILITY_VERSION ||
    !encAdminId ||
    !encSubject ||
    !encOrgId ||
    !encReasonHash ||
    !encWriteSessionId ||
    !signature
  ) {
    return null;
  }

  const adminId = decodePart(encAdminId);
  const cloudflareSubject = decodePart(encSubject);
  const organizationId = decodePart(encOrgId);
  const reasonHash = decodePart(encReasonHash);
  const writeSessionId = decodePart(encWriteSessionId);
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  const now = options.now ?? Date.now();

  if (!adminId || !cloudflareSubject || !organizationId || !reasonHash || !writeSessionId) return null;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (!options.ignoreExpiry && expiresAt < now) return null;
  if (issuedAt > now + 60_000) return null;

  const payload: AdminPreviewWriteCapability = {
    adminId,
    cloudflareSubject,
    organizationId,
    issuedAt,
    expiresAt,
    reasonHash,
    writeSessionId,
  };

  if (!signaturesEqual(signPayload(payload), signature)) return null;
  return payload;
}

export function adminPreviewWriteCookieSetOptions(expiresAt: number): AdminSessionCookieOptions {
  return adminSessionCookieOptions(new Date(expiresAt));
}

export function adminPreviewWriteCookieClearOptions(): AdminSessionCookieOptions {
  return adminSessionCookieClearOptions();
}

export function sanitizeAdminPreviewAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizePlatformAdminAuditMetadata({
    source: "admin_preview_write",
    ...metadata,
  });
}

export function sanitizePreviewWriteReason(reason: string) {
  return reason.trim().slice(0, ADMIN_PREVIEW_WRITE_REASON_MAX);
}

export function buildAdminPreviewAuditMetadata(input: {
  adminId: string;
  email: string;
  organizationId: string;
  actionKey?: string;
  reason?: string;
  reasonHash?: string;
  writeSessionId?: string;
  writeModeExpiry?: number | null;
  denialReason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return sanitizeAdminPreviewAuditMetadata({
    adminId: input.adminId,
    emailMasked: maskPlatformAdminEmail(input.email),
    organizationId: input.organizationId,
    ...(input.actionKey ? { actionKey: input.actionKey } : {}),
    ...(input.reason ? { reason: sanitizePreviewWriteReason(input.reason) } : {}),
    ...(input.reasonHash ? { reasonHash: input.reasonHash } : {}),
    ...(input.writeSessionId ? { writeSessionId: input.writeSessionId } : {}),
    ...(input.writeModeExpiry != null ? { writeModeExpiry: input.writeModeExpiry } : {}),
    ...(input.denialReason ? { denialReason: input.denialReason } : {}),
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {}),
    ...(input.extra ?? {}),
  });
}

export function isAdminPreviewHostAllowed(host: string | null | undefined, productionWexon: boolean) {
  if (!productionWexon) return true;
  const normalized = normalizeHost(host);
  return resolveHostSurface(normalized) === "admin" || isAdminHost(normalized);
}

export async function readAdminPreviewWriteCapabilityCookie(): Promise<AdminPreviewWriteCapability | null> {
  const cookieStore = await cookies();
  return parseAdminPreviewWriteCookieValue(cookieStore.get(ADMIN_PREVIEW_WRITE_COOKIE)?.value);
}

export async function setAdminPreviewWriteCapabilityCookie(payload: AdminPreviewWriteCapability) {
  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_PREVIEW_WRITE_COOKIE,
    encodeAdminPreviewWriteCookieValue(payload),
    adminPreviewWriteCookieSetOptions(payload.expiresAt),
  );
}

export async function clearAdminPreviewWriteCapabilityCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PREVIEW_WRITE_COOKIE, "", adminPreviewWriteCookieClearOptions());
}

export type AdminPreviewWriteState = {
  writeEnabled: boolean;
  expiresAt: number | null;
  remainingMs: number | null;
  capability: AdminPreviewWriteCapability | null;
};

export async function resolveAdminPreviewWriteState(
  organizationId: string,
  session?: AdminSession | null,
): Promise<AdminPreviewWriteState> {
  const admin = session ?? (await getAdminSession());
  const capability = await readAdminPreviewWriteCapabilityCookie();
  if (
    !admin ||
    !capability ||
    capability.adminId !== admin.adminId ||
    capability.cloudflareSubject !== admin.cloudflareSubject ||
    capability.organizationId !== organizationId ||
    capability.expiresAt < Date.now()
  ) {
    return { writeEnabled: false, expiresAt: null, remainingMs: null, capability: null };
  }

  return {
    writeEnabled: true,
    expiresAt: capability.expiresAt,
    remainingMs: Math.max(0, capability.expiresAt - Date.now()),
    capability,
  };
}

export type AdminPreviewActorOk = {
  ok: true;
  session: AdminSession;
  identity: { emailNormalized: string; subject: string };
};

export type AdminPreviewActorDenied = {
  ok: false;
  reason: AdminPreviewWriteDenialReason;
  message: string;
};

/**
 * Re-verify CF JWT + session v3 + ACTIVE PlatformAdmin (fail closed).
 * Does not redirect — for mutation / capability paths.
 */
export async function verifyAdminPreviewActor(): Promise<AdminPreviewActorOk | AdminPreviewActorDenied> {
  const productionWexon = isWexonProductionDeployment();
  const host = await readRequestHost();
  if (!isAdminPreviewHostAllowed(host, productionWexon)) {
    return {
      ok: false,
      reason: "wrong_host",
      message: "Admin önizleme yazma yetkisi yalnızca yönetim hostunda geçerlidir.",
    };
  }

  const headerStore = await headers();
  let identity: { emailNormalized: string; subject: string };
  try {
    identity = await verifyCloudflareAccessJwtFromHeaders(headerStore);
  } catch {
    return {
      ok: false,
      reason: "jwt_invalid",
      message: "Cloudflare Access doğrulaması başarısız.",
    };
  }

  const session = await getAdminSession();
  if (
    !session ||
    session.email !== identity.emailNormalized ||
    session.cloudflareSubject !== identity.subject
  ) {
    return {
      ok: false,
      reason: "session_mismatch",
      message: "Admin oturumu geçersiz.",
    };
  }

  try {
    await assertActivePlatformAdminMatchesIdentity(prisma, {
      adminId: session.adminId,
      emailNormalized: identity.emailNormalized,
      cloudflareSubject: identity.subject,
    });
  } catch {
    return {
      ok: false,
      reason: "platform_admin_inactive",
      message: "Platform yöneticisi aktif değil.",
    };
  }

  return { ok: true, session, identity };
}

export async function auditAdminPreviewWriteDenied(input: {
  adminId?: string;
  email?: string;
  organizationId?: string | null;
  actionKey: string;
  denialReason: AdminPreviewWriteDenialReason | string;
  reason?: string;
  writeModeExpiry?: number | null;
  client?: AuditClient;
}) {
  const metadata = buildAdminPreviewAuditMetadata({
    adminId: input.adminId ?? "unknown",
    email: input.email ?? "unknown@wexon.dev",
    organizationId: input.organizationId ?? "unknown",
    actionKey: input.actionKey,
    denialReason: input.denialReason,
    reason: input.reason,
    writeModeExpiry: input.writeModeExpiry,
    extra: cloudflareAccessAuditSafeMeta({ reason: String(input.denialReason) }),
  });

  if (input.client) {
    await writeAuditLog(
      {
        action: "admin.preview.write_denied",
        organizationId: input.organizationId,
        entityType: "Organization",
        entityId: input.organizationId ?? undefined,
        level: "WARN",
        status: "FAILURE",
        message: input.denialReason,
        source: "admin_preview_write",
        metadata,
      },
      input.client,
    );
    return;
  }

  writeAuditFailure({
    action: "admin.preview.write_denied",
    organizationId: input.organizationId,
    entityType: "Organization",
    entityId: input.organizationId ?? undefined,
    level: "WARN",
    message: input.denialReason,
    source: "admin_preview_write",
    metadata,
  });
}

export async function auditAdminPreviewWriteSuccess(input: {
  action: "admin.preview.write_enabled" | "admin.preview.write_disabled" | "admin.preview.write";
  adminId: string;
  email: string;
  organizationId: string;
  actionKey?: string;
  reason?: string;
  reasonHash?: string;
  writeSessionId?: string;
  writeModeExpiry?: number | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  client?: AuditClient;
}) {
  const metadata = buildAdminPreviewAuditMetadata({
    adminId: input.adminId,
    email: input.email,
    organizationId: input.organizationId,
    actionKey: input.actionKey,
    reason: input.reason,
    reasonHash: input.reasonHash,
    writeSessionId: input.writeSessionId,
    writeModeExpiry: input.writeModeExpiry,
    before: input.before,
    after: input.after,
  });

  return writeAuditLog(
    {
      action: input.action,
      organizationId: input.organizationId,
      entityType: "Organization",
      entityId: input.organizationId,
      level: "INFO",
      status: "SUCCESS",
      source: "admin_preview_write",
      metadata,
    },
    input.client,
  );
}

/**
 * Write `admin.preview.write` using the caller's transaction client.
 * Must be invoked inside the same Prisma `$transaction` as the domain mutation.
 */
export async function writeAdminPreviewMutationAuditInTransaction(
  client: AuditClient,
  input: {
    organizationId: string;
    binding: AdminPreviewWriteAuditBinding;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  },
) {
  await auditAdminPreviewWriteSuccess({
    action: "admin.preview.write",
    adminId: input.binding.adminId,
    email: input.binding.email,
    organizationId: input.organizationId,
    actionKey: input.binding.actionKey,
    reasonHash: input.binding.reasonHash,
    writeSessionId: input.binding.writeSessionId,
    writeModeExpiry: input.binding.writeModeExpiry,
    before: input.before,
    after: input.after,
    client,
  });
}

export type AssertAdminPreviewWriteResult =
  | {
      ok: true;
      session: AdminSession;
      identity: { emailNormalized: string; subject: string };
      capability: AdminPreviewWriteCapability;
      organization: { id: string; slug: string; name: string; isDemo: boolean; isActive: boolean };
    }
  | {
      ok: false;
      reason: AdminPreviewWriteDenialReason;
      message: string;
    };

/**
 * Central enforcement for admin_session mutations.
 * Verifies identity, capability (org-bound, unexpired), and non-demo active org.
 */
export async function assertAdminPreviewWriteAllowed(input: {
  organizationId: string;
  actionKey: string;
  auditDenial?: boolean;
}): Promise<AssertAdminPreviewWriteResult> {
  const actor = await verifyAdminPreviewActor();
  if (!actor.ok) {
    if (input.auditDenial !== false) {
      await auditAdminPreviewWriteDenied({
        organizationId: input.organizationId,
        actionKey: input.actionKey,
        denialReason: actor.reason,
      });
    }
    return actor;
  }

  const capability = await readAdminPreviewWriteCapabilityCookie();
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, slug: true, name: true, isDemo: true, isActive: true },
  });

  const gate = evaluateAdminPreviewWriteGate({
    capability,
    adminId: actor.session.adminId,
    cloudflareSubject: actor.identity.subject,
    organizationId: input.organizationId,
    organization,
  });

  if (!gate.ok) {
    if (input.auditDenial !== false) {
      await auditAdminPreviewWriteDenied({
        adminId: actor.session.adminId,
        email: actor.session.email,
        organizationId: input.organizationId,
        actionKey: input.actionKey,
        denialReason: gate.reason,
        writeModeExpiry: capability?.expiresAt ?? null,
      });
    }
    const messages: Record<AdminPreviewWriteDenialReason, string> = {
      unauthenticated: "Admin oturumu gerekli.",
      jwt_invalid: "Cloudflare Access doğrulaması başarısız.",
      session_mismatch: "Admin oturumu geçersiz.",
      platform_admin_inactive: "Platform yöneticisi aktif değil.",
      wrong_host: "Admin önizleme yazma yetkisi yalnızca yönetim hostunda geçerlidir.",
      missing_capability: "Admin önizleme yazma modu kapalı. Yazma yetkisi etkinleştirin.",
      capability_mismatch: "Yazma yetkisi bu organizasyon veya oturum için geçerli değil.",
      capability_expired: "Yazma yetkisinin süresi doldu.",
      capability_tampered: "Yazma yetkisi geçersiz.",
      organization_inactive: "Pasif organizasyonda değişiklik yapılamaz.",
      organization_demo: "Demo tenant üzerinde admin yazma modu açılamaz.",
      organization_missing: "Organizasyon bulunamadı.",
      slug_mismatch: "Organizasyon slug doğrulaması başarısız.",
      reason_invalid: "Yazma nedeni geçersiz.",
      rate_limited: "Çok fazla deneme.",
      audit_failed: "Denetim kaydı yazılamadı.",
    };
    return { ok: false, reason: gate.reason, message: messages[gate.reason] };
  }

  return {
    ok: true,
    session: actor.session,
    identity: actor.identity,
    capability: gate.capability,
    organization: organization!,
  };
}

/**
 * Pure capability/org gate (unit + DB tests). Cookie/JWT verification stays elsewhere.
 */
export function evaluateAdminPreviewWriteGate(input: {
  capability: AdminPreviewWriteCapability | null;
  adminId: string;
  cloudflareSubject: string;
  organizationId: string;
  organization: { isActive: boolean; isDemo: boolean } | null;
  now?: number;
}): { ok: true; capability: AdminPreviewWriteCapability } | { ok: false; reason: AdminPreviewWriteDenialReason } {
  const now = input.now ?? Date.now();
  if (!input.capability) {
    return { ok: false, reason: "missing_capability" };
  }
  if (input.capability.expiresAt < now) {
    return { ok: false, reason: "capability_expired" };
  }
  if (
    input.capability.adminId !== input.adminId ||
    input.capability.cloudflareSubject !== input.cloudflareSubject ||
    input.capability.organizationId !== input.organizationId
  ) {
    return { ok: false, reason: "capability_mismatch" };
  }
  if (!input.organization) {
    return { ok: false, reason: "organization_missing" };
  }
  if (!input.organization.isActive) {
    return { ok: false, reason: "organization_inactive" };
  }
  if (input.organization.isDemo) {
    return { ok: false, reason: "organization_demo" };
  }
  return { ok: true, capability: input.capability };
}

/**
 * Pure disable-write decision (unit + DB regressions).
 * Form organizationId is never trusted for the audited tenant.
 */
export function evaluateAdminPreviewDisableRequest(input: {
  formOrganizationId: string;
  capability: AdminPreviewWriteCapability | null;
  adminId: string;
  cloudflareSubject: string;
}):
  | { ok: true; organizationId: string; capability: AdminPreviewWriteCapability }
  | {
      ok: false;
      reason: "missing_capability" | "capability_mismatch";
      /** Clear cookie only when capability missing or session-bound mismatch. */
      clearCookie: boolean;
      /** Audit organizationId when denial should be recorded (capability org). */
      auditOrganizationId?: string;
    } {
  if (!input.capability) {
    return { ok: false, reason: "missing_capability", clearCookie: true };
  }
  if (
    input.capability.adminId !== input.adminId ||
    input.capability.cloudflareSubject !== input.cloudflareSubject
  ) {
    return {
      ok: false,
      reason: "capability_mismatch",
      clearCookie: true,
      auditOrganizationId: input.capability.organizationId,
    };
  }
  if (input.formOrganizationId && input.formOrganizationId !== input.capability.organizationId) {
    return {
      ok: false,
      reason: "capability_mismatch",
      clearCookie: false,
      auditOrganizationId: input.capability.organizationId,
    };
  }
  return {
    ok: true,
    organizationId: input.capability.organizationId,
    capability: input.capability,
  };
}

/**
 * Soft check used by resolveWexPaySessionContext for canManage flags (no audit spam).
 */
export async function adminPreviewHasValidWriteCapability(input: {
  organizationId: string;
  adminId: string;
  cloudflareSubject: string;
}): Promise<boolean> {
  const productionWexon = isWexonProductionDeployment();
  const host = await readRequestHost();
  if (!isAdminPreviewHostAllowed(host, productionWexon)) {
    return false;
  }

  const capability = await readAdminPreviewWriteCapabilityCookie();
  if (!capability) return false;
  if (capability.expiresAt < Date.now()) return false;
  if (capability.adminId !== input.adminId) return false;
  if (capability.cloudflareSubject !== input.cloudflareSubject) return false;
  if (capability.organizationId !== input.organizationId) return false;

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { isActive: true, isDemo: true },
  });
  if (!organization?.isActive || organization.isDemo) return false;
  return true;
}

/** Page-load gate for admin preview routes (redirects via assertAdminAccess). */
export async function requireAdminPreviewPageAccess(organizationId: string) {
  const session = await assertAdminAccess();
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, name: true, isDemo: true, isActive: true },
  });
  if (!organization || !organization.isActive) {
    return { ok: false as const, session, organization: null };
  }
  const writeState = await resolveAdminPreviewWriteState(organization.id, session);
  return { ok: true as const, session, organization, writeState };
}
