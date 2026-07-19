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
import {
  buildStaffInviteEmailContent,
  resolveEmailTransportConfig,
  sendTransactionalEmail,
} from "@/lib/wexon-email";
import { hashPassword } from "@/lib/wexon-passwords";
import { isHostedProduction } from "@/lib/wexon-production-guards";
import { lockWexPayOrgStaffLimit } from "@/lib/wexpay-locks";
import { completeActivationStepInTx } from "@/lib/wexpay-activation-journey";
import {
  ActivationTxAccessError,
  assertActorManageMembershipInTx,
  assertCanonicalStaffLimitInTx,
  assertWexPayAccessInTx,
} from "@/lib/wexpay-activation-tx-access";

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

function mapTxAccessError(error: unknown): never {
  if (error instanceof ActivationTxAccessError) {
    throw new StaffInviteError(error.code, error.message);
  }
  throw error;
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

  const material = generateSecureStaffInviteTokenMaterial();
  const expiresAt = new Date(Date.now() + STAFF_INVITE_TTL_MS);

  let invite: StaffInvite;
  try {
    invite = await prisma.$transaction(
      async (tx) => {
        await lockWexPayOrgStaffLimit(tx, input.organizationId);

        const access = await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: [MembershipRole.OWNER, MembershipRole.ADMIN],
        });

        const existingUser = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existingUser) {
          const existingMembership = await tx.membership.findUnique({
            where: {
              organizationId_userId: {
                organizationId: input.organizationId,
                userId: existingUser.id,
              },
            },
            select: { id: true },
          });
          if (existingMembership) {
            throw new StaffInviteError(
              "MEMBERSHIP_EXISTS",
              "Bu e-posta zaten organizasyon üyesi; yeni davet oluşturulamaz.",
            );
          }
        }

        // Revoke open invites first so seat count does not double-count re-invites.
        await tx.staffInvite.updateMany({
          where: {
            organizationId: input.organizationId,
            email,
            acceptedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        const seatCount = await countStaffSeatsForLimit(tx, input.organizationId);
        assertCanonicalStaffLimitInTx(access, seatCount);

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
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }

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

  return { invite: updated, oneTimeInviteUrl };
}

export async function revokeStaffInvite(input: {
  organizationId: string;
  actorUserId: string;
  inviteId: string;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const invite = await tx.staffInvite.findFirst({
        where: { id: input.inviteId, organizationId: input.organizationId },
      });
      if (!invite) throw new StaffInviteError("NOT_FOUND", "Davet bulunamadı.");

      await assertActorManageMembershipInTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        roles: [MembershipRole.OWNER, MembershipRole.ADMIN],
      });

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
  } catch (error) {
    mapTxAccessError(error);
  }
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

export type AcceptStaffInviteResult = {
  membershipId: string;
  userId: string;
  organizationId: string;
  /** True only for new or previously passwordless users. */
  shouldCreateSession: boolean;
};

export async function acceptStaffInvite(input: {
  plaintextToken: string;
  email: string;
  name?: string;
  password?: string;
  /**
   * Active customer session from the request. Required for existing passworded users.
   * Pass null/undefined when unauthenticated — do not call getCustomerSession inside TX.
   */
  customerSession?: { userId: string } | null;
}): Promise<AcceptStaffInviteResult> {
  const email = normalizeInviteEmail(input.email);
  const tokenHash = hashStaffInviteToken(input.plaintextToken);

  // Pre-TX: resolve invite + user path so password hashing stays outside the interactive TX.
  const invitePreview = await prisma.staffInvite.findUnique({ where: { tokenHash } });
  if (
    !invitePreview ||
    invitePreview.revokedAt ||
    invitePreview.acceptedAt ||
    invitePreview.expiresAt.getTime() <= Date.now()
  ) {
    throw new StaffInviteError("INVALID", "Davet geçersiz veya süresi dolmuş.");
  }
  if (normalizeInviteEmail(invitePreview.email) !== email) {
    throw new StaffInviteError("EMAIL_MISMATCH", "E-posta davet ile eşleşmiyor.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && !existingUser.isActive) {
    throw new StaffInviteError("USER_INACTIVE", "Hesap pasif.");
  }

  let passwordHash: string | null = null;
  let displayName: string | null = null;
  let shouldCreateSession = false;
  let sessionUserId: string | null = null;

  if (!existingUser) {
    const password = input.password?.trim() ?? "";
    if (password.length < 8) {
      throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
    }
    const name = (input.name ?? "").trim();
    if (name.length < 2) {
      throw new StaffInviteError("NAME", "Ad soyad gerekli.");
    }
    passwordHash = await hashPassword(password);
    displayName = name;
    shouldCreateSession = true;
  } else if (!existingUser.passwordHash) {
    const password = input.password?.trim() ?? "";
    if (password.length < 8) {
      throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
    }
    passwordHash = await hashPassword(password);
    displayName = input.name?.trim() || null;
    shouldCreateSession = true;
  } else {
    // Existing passworded user: require matching active customer session; never change password.
    const session = input.customerSession ?? null;
    if (!session) {
      throw new StaffInviteError(
        "LOGIN_REQUIRED",
        "Mevcut hesabınız için önce giriş yapmalısınız.",
      );
    }
    if (session.userId !== existingUser.id) {
      throw new StaffInviteError(
        "SESSION_MISMATCH",
        "Oturum davet e-postası ile eşleşmiyor.",
      );
    }
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, isActive: true },
    });
    if (
      !sessionUser?.isActive ||
      normalizeInviteEmail(sessionUser.email) !== email
    ) {
      throw new StaffInviteError(
        "SESSION_MISMATCH",
        "Oturum davet e-postası ile eşleşmiyor.",
      );
    }
    sessionUserId = session.userId;
    shouldCreateSession = false;
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockWexPayOrgStaffLimit(tx, invitePreview.organizationId);

        const locked = await tx.staffInvite.findUnique({ where: { id: invitePreview.id } });
        if (
          !locked ||
          locked.acceptedAt ||
          locked.revokedAt ||
          locked.expiresAt.getTime() <= Date.now()
        ) {
          throw new StaffInviteError("INVALID", "Davet geçersiz veya süresi dolmuş.");
        }
        if (normalizeInviteEmail(locked.email) !== email) {
          throw new StaffInviteError("EMAIL_MISMATCH", "E-posta davet ile eşleşmiyor.");
        }

        const access = await assertWexPayAccessInTx(tx, {
          organizationId: locked.organizationId,
          productKey: "wexpay",
        });

        let user = await tx.user.findUnique({ where: { email } });
        if (user && !user.isActive) {
          throw new StaffInviteError("USER_INACTIVE", "Hesap pasif.");
        }

        if (!user) {
          if (!passwordHash || !displayName) {
            throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
          }
          user = await tx.user.create({
            data: {
              email,
              name: displayName,
              passwordHash,
              passwordSetAt: new Date(),
              mustChangePassword: false,
              isActive: true,
            },
          });
        } else if (!user.passwordHash) {
          if (!passwordHash) {
            throw new StaffInviteError("PASSWORD", "Şifre en az 8 karakter olmalıdır.");
          }
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              passwordHash,
              passwordSetAt: new Date(),
              mustChangePassword: false,
              ...(displayName ? { name: displayName } : {}),
            },
          });
        } else {
          // Passworded path: session already validated outside TX; never mutate password.
          if (!sessionUserId || sessionUserId !== user.id) {
            throw new StaffInviteError(
              "LOGIN_REQUIRED",
              "Mevcut hesabınız için önce giriş yapmalısınız.",
            );
          }
        }

        const existingMembership = await tx.membership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: locked.organizationId,
              userId: user.id,
            },
          },
        });
        if (existingMembership) {
          // Fail-closed: never update role (OWNER must not become STAFF).
          throw new StaffInviteError(
            "MEMBERSHIP_EXISTS",
            "Bu hesap zaten organizasyon üyesi; davet kabul edilemez.",
          );
        }

        const seatCount = await countStaffSeatsForLimit(tx, locked.organizationId);
        // This open invite is included in seatCount — exclude it for the accept check.
        const seatsExcludingThisInvite = Math.max(0, seatCount - 1);
        assertCanonicalStaffLimitInTx(access, seatsExcludingThisInvite);

        const membership = await tx.membership.create({
          data: {
            organizationId: locked.organizationId,
            userId: user.id,
            role: locked.role,
            status: MembershipStatus.ACTIVE,
            acceptedAt: new Date(),
          },
        });

        const accepted = await tx.staffInvite.updateMany({
          where: { id: locked.id, acceptedAt: null, revokedAt: null },
          data: { acceptedAt: new Date() },
        });
        if (accepted.count !== 1) {
          throw new StaffInviteError("ALREADY_ACCEPTED", "Davet zaten kabul edilmiş.");
        }

        await writeAuditLog(
          {
            organizationId: locked.organizationId,
            userId: user.id,
            action: "wexpay.staff_invite.accepted",
            entityType: "StaffInvite",
            entityId: locked.id,
            source: "staff_invite",
            metadata: sanitizeStaffInviteAuditMetadata({
              role: locked.role,
              tokenPrefix: locked.tokenPrefix,
              membershipId: membership.id,
            }),
          },
          tx,
        );

        // Atomic wizard step update only when STAFF_INVITE is the active step.
        const product = await tx.product.findFirst({
          where: { key: "wexpay" },
          select: { id: true },
        });
        if (product) {
          const journey = await tx.activationJourney.findUnique({
            where: {
              organizationId_productId: {
                organizationId: locked.organizationId,
                productId: product.id,
              },
            },
          });
          if (
            journey &&
            journey.status === "IN_PROGRESS" &&
            journey.currentStep === ActivationStepKey.STAFF_INVITE
          ) {
            await completeActivationStepInTx(tx, {
              journeyId: journey.id,
              expectedVersion: journey.version,
              stepKey: ActivationStepKey.STAFF_INVITE,
              safeMetadata: { via: "invite_accept" },
              advanceTo: ActivationStepKey.MENU_IMPORT,
            });
          }
        }

        return {
          membershipId: membership.id,
          userId: user.id,
          organizationId: locked.organizationId,
          shouldCreateSession,
        };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
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
