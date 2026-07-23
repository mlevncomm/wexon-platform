/**
 * Bind Cloudflare Access subject to PlatformAdmin (PR2B).
 * Fail-closed; concurrent first-bind is tenant-safe via row lock + unique constraint.
 * Audit uses masked email only — never raw subject/JWT/email.
 */

import { Prisma } from ".prisma/client";
import {
  buildPlatformAdminAuditMetadata,
  lockPlatformAdminForUpdate,
  maskPlatformAdminEmail,
  normalizePlatformAdminEmail,
  type PlatformAdminClient,
  type PlatformAdminRecord,
} from "@/lib/wexon-platform-admin";
import { ADMIN_ACCESS_GENERIC_DENIED } from "@/lib/wexon-cloudflare-access-config";

function asAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PlatformAdminCloudflareAccessError extends Error {
  readonly code:
    | "not_found"
    | "inactive"
    | "subject_mismatch"
    | "subject_conflict"
    | "email_mismatch";

  constructor(code: PlatformAdminCloudflareAccessError["code"], message = ADMIN_ACCESS_GENERIC_DENIED) {
    super(message);
    this.name = "PlatformAdminCloudflareAccessError";
    this.code = code;
  }
}

export type ResolvePlatformAdminCloudflareAccessInput = {
  emailNormalized: string;
  cloudflareSubject: string;
  /** When true, bump lastLoginAt after successful resolve/bind. */
  touchLastLogin?: boolean;
};

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findActiveByEmailNormalized(
  tx: PlatformAdminClient,
  emailNormalized: string,
): Promise<PlatformAdminRecord | null> {
  return tx.platformAdmin.findFirst({
    where: { emailNormalized, isActive: true },
  });
}

async function lockByEmailNormalized(
  tx: Pick<PlatformAdminClient, "$queryRaw">,
  emailNormalized: string,
): Promise<PlatformAdminRecord | null> {
  const rows = await tx.$queryRaw<PlatformAdminRecord[]>`
    SELECT id, email, "emailNormalized", "displayName", "isActive", "cloudflareSubject",
           "lastLoginAt", "createdAt", "updatedAt"
    FROM "PlatformAdmin"
    WHERE "emailNormalized" = ${emailNormalized}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Resolve ACTIVE PlatformAdmin for a verified Cloudflare identity.
 * - subject null → bind once (same transaction) when email matches
 * - subject set → must equal JWT sub exactly
 * Concurrent binds are idempotent / unique-constraint safe.
 */
export async function resolvePlatformAdminForCloudflareAccess(
  tx: PlatformAdminClient,
  input: ResolvePlatformAdminCloudflareAccessInput,
): Promise<PlatformAdminRecord> {
  const emailNormalized = normalizePlatformAdminEmail(input.emailNormalized);
  const subject = String(input.cloudflareSubject ?? "").trim();
  if (!emailNormalized || !subject) {
    throw new PlatformAdminCloudflareAccessError("not_found");
  }

  const locked = await lockByEmailNormalized(tx, emailNormalized);
  if (!locked) {
    throw new PlatformAdminCloudflareAccessError("not_found");
  }
  if (!locked.isActive) {
    throw new PlatformAdminCloudflareAccessError("inactive");
  }
  if (normalizePlatformAdminEmail(locked.emailNormalized) !== emailNormalized) {
    throw new PlatformAdminCloudflareAccessError("email_mismatch");
  }

  let admin = locked;

  if (admin.cloudflareSubject == null) {
    try {
      const updated = await tx.platformAdmin.updateMany({
        where: { id: admin.id, cloudflareSubject: null, isActive: true },
        data: { cloudflareSubject: subject },
      });

      if (updated.count === 1) {
        await tx.auditLog.create({
          data: {
            organizationId: null,
            userId: null,
            action: "admin.platform_admin.cloudflare_subject_bound",
            entityType: "PlatformAdmin",
            entityId: admin.id,
            metadataJson: asAuditJson(
              buildPlatformAdminAuditMetadata({
                email: admin.email,
                extra: {
                  source: "admin_cloudflare_access",
                  bound: true,
                  emailMasked: maskPlatformAdminEmail(admin.email),
                },
              }),
            ),
          },
        });
      }

      const refreshed = await lockPlatformAdminForUpdate(tx, admin.id);
      if (!refreshed || !refreshed.isActive) {
        throw new PlatformAdminCloudflareAccessError("inactive");
      }
      if (refreshed.cloudflareSubject !== subject) {
        // Lost race to another subject, or concurrent bind to different sub.
        throw new PlatformAdminCloudflareAccessError("subject_mismatch");
      }
      admin = refreshed;
    } catch (error) {
      if (error instanceof PlatformAdminCloudflareAccessError) throw error;
      if (isUniqueConflict(error)) {
        // Subject already owned by another PlatformAdmin.
        throw new PlatformAdminCloudflareAccessError("subject_conflict");
      }
      throw error;
    }
  } else if (admin.cloudflareSubject !== subject) {
    throw new PlatformAdminCloudflareAccessError("subject_mismatch");
  }

  if (input.touchLastLogin !== false) {
    admin = await tx.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
  }

  return admin;
}

/** Non-mutating lookup used when validating an existing session against PlatformAdmin. */
export async function assertActivePlatformAdminMatchesIdentity(
  client: PlatformAdminClient,
  input: { adminId: string; emailNormalized: string; cloudflareSubject: string },
): Promise<PlatformAdminRecord> {
  const admin = await client.platformAdmin.findUnique({ where: { id: input.adminId } });
  if (!admin || !admin.isActive) {
    throw new PlatformAdminCloudflareAccessError(admin ? "inactive" : "not_found");
  }
  if (normalizePlatformAdminEmail(admin.emailNormalized) !== normalizePlatformAdminEmail(input.emailNormalized)) {
    throw new PlatformAdminCloudflareAccessError("email_mismatch");
  }
  if (!admin.cloudflareSubject || admin.cloudflareSubject !== input.cloudflareSubject) {
    throw new PlatformAdminCloudflareAccessError("subject_mismatch");
  }
  return admin;
}

export async function findActivePlatformAdminByEmail(
  client: PlatformAdminClient,
  emailNormalized: string,
) {
  return findActiveByEmailNormalized(client, normalizePlatformAdminEmail(emailNormalized));
}
