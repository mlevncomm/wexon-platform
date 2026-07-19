import { createHash, randomBytes } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  StaffInviteDeliveryStatus,
  ActivationStepKey,
  type Prisma,
  type PrismaClient,
  type StaffInvite,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { assertStaffEntitlementLimit, evaluateProductAccess } from "@/lib/wexon-core-access";
import {
  buildStaffInviteEmailContent,
  resolveEmailTransportConfig,
  sendTransactionalEmail,
} from "@/lib/wexon-email";
import { hashPassword } from "@/lib/wexon-passwords";
import { isHostedProduction } from "@/lib/wexon-production-guards";
import { lockWexPayOrgStaffLimit } from "@/lib/wexpay-locks";
import { completeActivationStepInTx } from "@/lib/wexpay-activation-journey";

export const STAFF_INVITE_TOKEN_BYTES = 32;
export const STAFF_INVITE_TOKEN_PREFIX_LENGTH = 10;
export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const INVITEABLE_ROLES = new Set<MembershipRole>([
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.STAFF,
  MembershipRole.BILLING,
  MembershipRole.VIEWER,
]);

type DbClient = PrismaClient | Prisma.TransactionClient;

export class StaffInviteError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StaffInviteError";
    this.code = code;
  }
}

export type GeneratedStaffInviteToken = {
  plaintext: string;
  tokenHash: string;
  tokenPrefix: string;
};

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSecureStaffInviteTokenMaterial(): GeneratedStaffInviteToken {
  const bytes = randomBytes(STAFF_INVITE_TOKEN_BYTES);
  if (bytes.length < STAFF_INVITE_TOKEN_BYTES) {
    throw new StaffInviteError("ENTROPY", "Yetersiz rastgele entropi.");
  }
  const plaintext = bytes.toString("base64url");
  return {
    plaintext,
    tokenHash: hashStaffInviteToken(plaintext),
    tokenPrefix: plaintext.slice(0, STAFF_INVITE_TOKEN_PREFIX_LENGTH),
  };
}

export function hashStaffInviteToken(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (!trimmed) throw new StaffInviteError("EMPTY_TOKEN", "Token boş olamaz.");
  return createHash("sha256").update(trimmed, "utf8").digest("hex");
}

export function sanitizeStaffInviteAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    "token",
    "plaintext",
    "rawToken",
    "inviteToken",
    "inviteUrl",
    "password",
    "passwordHash",
    "secret",
  ]);
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
}

export function roleLabelTr(role: MembershipRole): string {
  switch (role) {
    case MembershipRole.ADMIN:
      return "Yönetici";
    case MembershipRole.MANAGER:
      return "Müdür";
    case MembershipRole.STAFF:
      return "Personel";
    case MembershipRole.BILLING:
      return "Faturalama";
    case MembershipRole.VIEWER:
      return "Görüntüleyici";
    case MembershipRole.OWNER:
      return "Sahip";
    default:
      return role;
  }
}

export function isInviteOpen(invite: Pick<StaffInvite, "acceptedAt" | "revokedAt" | "expiresAt">, now = new Date()) {
  if (invite.acceptedAt || invite.revokedAt) return false;
  return invite.expiresAt.getTime() > now.getTime();
}

async function countStaffSeatsForLimit(client: DbClient, organizationId: string) {
  const [activeNonOwner, openInvites] = await Promise.all([
    client.membership.count({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
        role: { not: MembershipRole.OWNER },
      },
    }),
    client.staffInvite.count({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        role: { not: MembershipRole.OWNER },
      },
    }),
  ]);
  return activeNonOwner + openInvites;
}

export async function createStaffInvite(input: {
  organizationId: string;
  actorUserId: string;
  email: string;
  role: MembershipRole;
  expectedJourneyVersion?: number;
}): Promise<{
  invite: StaffInvite;
  /** Shown once to creator in non-production when provider is fake. Never log. */
  oneTimeInviteUrl: string | null;
}> {
  const email = normalizeInviteEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new StaffInviteError("INVALID_EMAIL", "Geçerli bir e-posta girin.");
  }
  if (input.role === MembershipRole.OWNER || !INVITEABLE_ROLES.has(input.role)) {
    throw new StaffInviteError("OWNER_FORBIDDEN", "OWNER rolü wizard üzerinden davet edilemez.");
  }

  const access = await evaluateProductAccess({
    organizationId: input.organizationId,
    productKey: "wexpay",
  });
  if (!access.allowed) {
    throw new StaffInviteError("NO_ACCESS", "WexPay erişimi gerekli.");
  }

  const material = generateSecureStaffInviteTokenMaterial();
  const expiresAt = new Date(Date.now() + STAFF_INVITE_TTL_MS);

  const invite = await prisma.$transaction(async (tx) => {
    await lockWexPayOrgStaffLimit(tx, input.organizationId);

    const actorMembership = await tx.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        status: MembershipStatus.ACTIVE,
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      },
      select: { id: true },
    });
    if (!actorMembership) {
      throw new StaffInviteError("FORBIDDEN", "Davet göndermek için OWNER veya ADMIN yetkisi gerekir.");
    }

    const actor = await tx.user.findFirst({
      where: { id: input.actorUserId, isActive: true },
      select: { id: true },
    });
    if (!actor) throw new StaffInviteError("ACTOR_INACTIVE", "Oturum kullanıcısı aktif değil.");

    const seatCount = await countStaffSeatsForLimit(tx, input.organizationId);
    const limit = assertStaffEntitlementLimit(access, seatCount);
    if (!limit.ok) {
      throw new StaffInviteError("STAFF_LIMIT", limit.message);
    }

    // Revoke any open invite for same org+email (re-invite).
    await tx.staffInvite.updateMany({
      where: {
        organizationId: input.organizationId,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const created = await tx.staffInvite.create({
      data: {
        organizationId: input.organizationId,
        email,
        role: input.role,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        expiresAt,
        createdByUserId: input.actorUserId,
        deliveryStatus: StaffInviteDeliveryStatus.PENDING,
      },
    });

    await writeAuditLog(
      {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: "wexpay.staff_invite.created",
        entityType: "StaffInvite",
        entityId: created.id,
        source: "staff_invite",
        metadata: sanitizeStaffInviteAuditMetadata({
          emailDomain: email.includes("@") ? email.split("@")[1] : null,
          role: created.role,
          tokenPrefix: created.tokenPrefix,
          expiresAt: created.expiresAt.toISOString(),
        }),
      },
      tx,
    );

    return created;
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true },
  });

  const content = buildStaffInviteEmailContent({
    organizationName: org.name,
    roleLabel: roleLabelTr(input.role),
    invitePathToken: material.plaintext,
    expiresAt,
  });

  const send = await sendTransactionalEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: `staff-invite:${invite.id}`,
  });

  const updated = await prisma.staffInvite.update({
    where: { id: invite.id },
    data: send.ok
      ? {
          deliveryStatus: StaffInviteDeliveryStatus.SENT,
          providerMessageId: send.providerMessageId,
          lastDeliveryErrorCode: null,
        }
      : {
          deliveryStatus: StaffInviteDeliveryStatus.FAILED,
          lastDeliveryErrorCode: send.errorCode,
        },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    action: send.ok ? "wexpay.staff_invite.delivery_sent" : "wexpay.staff_invite.delivery_failed",
    entityType: "StaffInvite",
    entityId: invite.id,
    source: "staff_invite",
    metadata: sanitizeStaffInviteAuditMetadata({
      deliveryStatus: updated.deliveryStatus,
      errorCode: send.ok ? null : send.errorCode,
      provider: send.provider,
    }),
  });

  const config = resolveEmailTransportConfig();
  const production = isHostedProduction() || process.env.NODE_ENV === "production";
  const oneTimeInviteUrl =
    !production && config.ready && config.provider === "fake" && send.ok
      ? content.inviteUrl
      : null;

  if (production && !send.ok) {
    // Fail-closed: never expose invite link when provider missing/failed in production.
    return { invite: updated, oneTimeInviteUrl: null };
  }

  return { invite: updated, oneTimeInviteUrl };
}

export async function revokeStaffInvite(input: {
  organizationId: string;
  actorUserId: string;
  inviteId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.staffInvite.findFirst({
      where: { id: input.inviteId, organizationId: input.organizationId },
    });
    if (!invite) throw new StaffInviteError("NOT_FOUND", "Davet bulunamadı.");

    const actorMembership = await tx.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        status: MembershipStatus.ACTIVE,
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      },
    });
    if (!actorMembership) throw new StaffInviteError("FORBIDDEN", "Yetkisiz.");

    if (invite.revokedAt || invite.acceptedAt) return invite;

    const updated = await tx.staffInvite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog(
      {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        action: "wexpay.staff_invite.revoked",
        entityType: "StaffInvite",
        entityId: invite.id,
        source: "staff_invite",
        metadata: sanitizeStaffInviteAuditMetadata({ tokenPrefix: invite.tokenPrefix }),
      },
      tx,
    );

    return updated;
  });
}

export type StaffInviteLookupResult =
  | { ok: true; invite: StaffInvite; organizationName: string }
  | { ok: false; code: string };

/** Hash lookup for public accept page — never disclose cross-tenant details beyond safe codes. */
export async function lookupStaffInviteByPlaintext(plaintext: string): Promise<StaffInviteLookupResult> {
  const tokenHash = hashStaffInviteToken(plaintext);
  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash },
    include: { organization: { select: { name: true, isActive: true } } },
  });
  if (!invite || !invite.organization.isActive) {
    return { ok: false, code: "INVALID" };
  }
  if (invite.revokedAt) return { ok: false, code: "REVOKED" };
  if (invite.acceptedAt) return { ok: false, code: "ACCEPTED" };
  if (invite.expiresAt.getTime() <= Date.now()) return { ok: false, code: "EXPIRED" };
  return { ok: true, invite, organizationName: invite.organization.name };
}

export async function acceptStaffInvite(input: {
  plaintextToken: string;
  email: string;
  name?: string;
  password?: string;
}): Promise<{ membershipId: string; userId: string; organizationId: string }> {
  const email = normalizeInviteEmail(input.email);
  const tokenHash = hashStaffInviteToken(input.plaintextToken);

  return prisma.$transaction(async (tx) => {
    const invite = await tx.staffInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new StaffInviteError("INVALID", "Davet geçersiz veya süresi dolmuş.");
    }
    if (normalizeInviteEmail(invite.email) !== email) {
      throw new StaffInviteError("EMAIL_MISMATCH", "E-posta davet ile eşleşmiyor.");
    }

    await lockWexPayOrgStaffLimit(tx, invite.organizationId);

    // Re-read under lock for single-use concurrency.
    const locked = await tx.staffInvite.findUnique({ where: { id: invite.id } });
    if (!locked || locked.acceptedAt || locked.revokedAt || locked.expiresAt.getTime() <= Date.now()) {
      throw new StaffInviteError("INVALID", "Davet geçersiz veya süresi dolmuş.");
    }

    const access = await evaluateProductAccess({
      organizationId: invite.organizationId,
      productKey: "wexpay",
    });
    if (!access.allowed) {
      throw new StaffInviteError("NO_ACCESS", "Organizasyon erişimi kapalı.");
    }

    let user = await tx.user.findUnique({ where: { email } });
    if (user && !user.isActive) {
      throw new StaffInviteError("USER_INACTIVE", "Hesap pasif.");
    }

    if (!user) {
      const password = input.password?.trim() ?? "";
      if (password.length < 8) {
        throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
      }
      const name = (input.name ?? "").trim();
      if (name.length < 2) {
        throw new StaffInviteError("NAME", "Ad soyad gerekli.");
      }
      user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash: await hashPassword(password),
          passwordSetAt: new Date(),
          mustChangePassword: false,
          isActive: true,
        },
      });
    } else if (!user.passwordHash) {
      const password = input.password?.trim() ?? "";
      if (password.length < 8) {
        throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
      }
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          passwordSetAt: new Date(),
          mustChangePassword: false,
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        },
      });
    }
    // Existing passworded user: do not change password or takeover — membership only.

    const existingMembership = await tx.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
    });

    const seatCount = await countStaffSeatsForLimit(tx, invite.organizationId);
    // Open invite being accepted is already in seatCount — exclude it for the accept check.
    const seatsExcludingThisInvite = Math.max(0, seatCount - 1);
    const needsNewSeat =
      !existingMembership || existingMembership.status !== MembershipStatus.ACTIVE;
    if (needsNewSeat) {
      const limit = assertStaffEntitlementLimit(access, seatsExcludingThisInvite);
      if (!limit.ok) {
        throw new StaffInviteError("STAFF_LIMIT", limit.message);
      }
    }

    const membership = existingMembership
      ? await tx.membership.update({
          where: { id: existingMembership.id },
          data: {
            role: invite.role,
            status: MembershipStatus.ACTIVE,
            acceptedAt: existingMembership.acceptedAt ?? new Date(),
          },
        })
      : await tx.membership.create({
          data: {
            organizationId: invite.organizationId,
            userId: user.id,
            role: invite.role,
            status: MembershipStatus.ACTIVE,
            acceptedAt: new Date(),
          },
        });

    const accepted = await tx.staffInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (accepted.count !== 1) {
      throw new StaffInviteError("ALREADY_ACCEPTED", "Davet zaten kabul edilmiş.");
    }

    await writeAuditLog(
      {
        organizationId: invite.organizationId,
        userId: user.id,
        action: "wexpay.staff_invite.accepted",
        entityType: "StaffInvite",
        entityId: invite.id,
        source: "staff_invite",
        metadata: sanitizeStaffInviteAuditMetadata({
          role: invite.role,
          tokenPrefix: invite.tokenPrefix,
          membershipId: membership.id,
        }),
      },
      tx,
    );

    // Best-effort: mark STAFF_INVITE step completed when at least one acceptance lands.
    try {
      const product = await tx.product.findFirst({
        where: { key: "wexpay" },
        select: { id: true },
      });
      if (product) {
        const journey = await tx.activationJourney.findUnique({
          where: {
            organizationId_productId: {
              organizationId: invite.organizationId,
              productId: product.id,
            },
          },
        });
        if (journey && journey.status === "IN_PROGRESS") {
          await completeActivationStepInTx(tx, {
            journeyId: journey.id,
            expectedVersion: journey.version,
            stepKey: ActivationStepKey.STAFF_INVITE,
            safeMetadata: { via: "invite_accept" },
            advanceTo: ActivationStepKey.MENU_IMPORT,
          });
        }
      }
    } catch {
      // Step completion is secondary to membership accept.
    }

    return {
      membershipId: membership.id,
      userId: user.id,
      organizationId: invite.organizationId,
    };
  });
}

export async function listOrganizationStaffInvites(organizationId: string) {
  return prisma.staffInvite.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      role: true,
      deliveryStatus: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      lastDeliveryErrorCode: true,
      tokenPrefix: true,
    },
  });
}
