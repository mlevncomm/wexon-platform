/**
 * Active-owner invariants for organizations.
 *
 * An owner is "active" only when ALL of:
 * - Membership.role = OWNER
 * - Membership.status = ACTIVE
 * - User.isActive = true
 *
 * SUSPENDED / REMOVED / INVITED memberships and globally inactive users do not
 * count. Callers that deactivate a User or strip OWNER/ACTIVE from a membership
 * must leave every affected organization with at least one active owner.
 */

import { Prisma, type PrismaClient } from ".prisma/client";

export type ActiveOwnerOrganization = {
  id: string;
  name: string;
  slug: string;
};

export class LastActiveOwnerError extends Error {
  readonly code = "last_active_owner" as const;
  readonly organizations: ReadonlyArray<ActiveOwnerOrganization>;

  constructor(organizations: ReadonlyArray<ActiveOwnerOrganization>, context: "user_deactivation" | "membership_change" = "user_deactivation") {
    const unique = dedupeOrganizations(organizations);
    const detail = unique.map((org) => `"${org.name}" (${org.slug})`).join(", ");
    const message =
      context === "membership_change"
        ? unique.length === 1
          ? `Son aktif sahip kaldırılamaz: "${unique[0].name}" (${unique[0].slug}). Önce başka bir aktif sahip atayın.`
          : `Son aktif sahip kaldırılamaz: ${detail}.`
        : unique.length === 1
          ? `Bu kullanıcı "${unique[0].name}" (${unique[0].slug}) organizasyonunun son aktif sahibidir. Önce başka bir aktif sahip atayın.`
          : `Bu kullanıcı şu organizasyonların son aktif sahibidir: ${detail}. Önce bu organizasyonlara başka aktif sahipler atayın.`;

    super(message);
    this.name = "LastActiveOwnerError";
    this.organizations = unique;
  }
}

/** Works on both the root client and a `$transaction` client. */
export type ActiveOwnerClient = Prisma.TransactionClient | PrismaClient;

export function isActiveOwnerRecord(input: {
  role: string;
  status: string;
  userIsActive: boolean;
}): boolean {
  return input.role === "OWNER" && input.status === "ACTIVE" && input.userIsActive === true;
}

function dedupeOrganizations(organizations: ReadonlyArray<ActiveOwnerOrganization>): ActiveOwnerOrganization[] {
  const seen = new Set<string>();
  const result: ActiveOwnerOrganization[] = [];
  for (const org of organizations) {
    if (seen.has(org.id)) continue;
    seen.add(org.id);
    result.push(org);
  }
  return result;
}

/**
 * Lock Organization rows FOR UPDATE in ascending id order to serialize
 * concurrent owner mutations and avoid deadlocks.
 */
export async function lockOrganizationsForUpdate(tx: ActiveOwnerClient, organizationIds: ReadonlyArray<string>): Promise<void> {
  const sorted = [...new Set(organizationIds)].filter(Boolean).sort();
  if (sorted.length === 0) return;

  // Parameterized list — never string-interpolate IDs into SQL.
  await tx.$queryRaw`
    SELECT id
    FROM "Organization"
    WHERE id IN (${Prisma.join(sorted)})
    ORDER BY id
    FOR UPDATE
  `;
}

export async function countOtherActiveOwners(
  tx: ActiveOwnerClient,
  input: {
    organizationId: string;
    excludingUserId?: string;
    excludingMembershipId?: string;
  },
): Promise<number> {
  return tx.membership.count({
    where: {
      organizationId: input.organizationId,
      role: "OWNER",
      status: "ACTIVE",
      user: { isActive: true },
      ...(input.excludingUserId ? { userId: { not: input.excludingUserId } } : {}),
      ...(input.excludingMembershipId ? { id: { not: input.excludingMembershipId } } : {}),
    },
  });
}

/**
 * Before globally deactivating a user (isActive true → false), ensure every
 * organization where they are an ACTIVE OWNER still has another active owner.
 * Must run inside the same transaction as the User update, after org locks.
 */
export async function assertUserDeactivationPreservesActiveOwners(
  tx: ActiveOwnerClient,
  userId: string,
): Promise<void> {
  const owned = await tx.membership.findMany({
    where: {
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (owned.length === 0) return;

  const organizationIds = owned.map((row) => row.organizationId);
  await lockOrganizationsForUpdate(tx, organizationIds);

  const blocked: ActiveOwnerOrganization[] = [];
  // Re-check under locks in deterministic org id order.
  const byOrgId = new Map(owned.map((row) => [row.organizationId, row.organization!]));
  for (const organizationId of [...new Set(organizationIds)].sort()) {
    const others = await countOtherActiveOwners(tx, {
      organizationId,
      excludingUserId: userId,
    });
    if (others < 1) {
      const org = byOrgId.get(organizationId);
      if (org) blocked.push(org);
    }
  }

  if (blocked.length > 0) {
    throw new LastActiveOwnerError(blocked, "user_deactivation");
  }
}

/**
 * Before demoting / suspending / removing an OWNER membership, ensure at least
 * one other active owner remains in that organization.
 */
export async function assertMembershipChangePreservesActiveOwners(
  tx: ActiveOwnerClient,
  input: {
    organizationId: string;
    excludingMembershipId: string;
  },
): Promise<void> {
  await lockOrganizationsForUpdate(tx, [input.organizationId]);

  const others = await countOtherActiveOwners(tx, {
    organizationId: input.organizationId,
    excludingMembershipId: input.excludingMembershipId,
  });

  if (others >= 1) return;

  const organization = await tx.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true, slug: true },
  });

  throw new LastActiveOwnerError(
    organization ? [organization] : [{ id: input.organizationId, name: input.organizationId, slug: input.organizationId }],
    "membership_change",
  );
}

export function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string;
    meta?: { code?: string; cause?: string };
    message?: string;
  };

  if (candidate.code === "P2034" || candidate.code === "40P01" || candidate.code === "40001") {
    return true;
  }
  if (candidate.meta?.code === "40P01" || candidate.meta?.code === "40001") {
    return true;
  }
  if (typeof candidate.message === "string") {
    return /deadlock detected|could not serialize|write conflict|serialization failure/i.test(candidate.message);
  }
  return false;
}

/** Retry only known serialization / deadlock failures a bounded number of times. */
export async function runWithTransactionRetry<T>(
  run: () => Promise<T>,
  options?: { attempts?: number },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === attempts) {
        throw error;
      }
    }
  }

  throw lastError;
}
