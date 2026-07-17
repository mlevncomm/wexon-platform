/**
 * DB-backed integration tests for last-active-owner lockout prevention.
 *
 * Exercises real Prisma transactions, organization FOR UPDATE locking,
 * `assertUserDeactivationPreservesActiveOwners`, and concurrent deactivation
 * races. Server-action cookie/session wiring is NOT exercised; tests replicate
 * the transactional body used by `toggleAdminUserActiveAction`.
 *
 * Gated by `assertLocalDbTestGuard`. Run with:
 *   WEXON_ALLOW_LOCAL_DB_TESTS=1 npm run test:unit:db
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  assertMembershipChangePreservesActiveOwners,
  assertUserDeactivationPreservesActiveOwners,
  LastActiveOwnerError,
  lockUserForUpdate,
  resolveNextActiveFromLockedUser,
  runWithTransactionRetry,
} from "./wexon-active-owner";
import { assertLocalDbTestGuard } from "./wexon-local-db-test-guard";
import { prisma } from "./prisma";

assertLocalDbTestGuard(process.env);

/** Mirrors toggleAdminUserActiveAction transactional body (no cookies/redirect). */
async function toggleUserActiveInTransaction(userId: string) {
  return runWithTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockUserForUpdate(tx, userId);
      if (!locked) throw new Error("Kullanıcı bulunamadı.");
      const nextActive = resolveNextActiveFromLockedUser(locked);
      if (!nextActive) {
        await assertUserDeactivationPreservesActiveOwners(tx, userId);
      }
      await tx.user.update({ where: { id: userId }, data: { isActive: nextActive } });
      await tx.auditLog.create({
        data: {
          action: nextActive ? "admin.user.reactivated" : "admin.user.deactivated",
          entityType: "User",
          entityId: userId,
          status: "SUCCESS",
          metadataJson: {
            email: locked.email,
            before: { isActive: locked.isActive },
            after: { isActive: nextActive },
          },
        },
      });
      return { before: locked.isActive, after: nextActive };
    }),
  );
}

/** Mirrors resetAdminUserPasswordAction transactional body (reactivation path). */
async function passwordResetReactivateInTransaction(userId: string) {
  return runWithTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const locked = await lockUserForUpdate(tx, userId);
      if (!locked) throw new Error("Kullanıcı bulunamadı.");
      await tx.user.update({
        where: { id: userId },
        data: { isActive: true, mustChangePassword: true, passwordSetAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: "admin.user.password_reset",
          entityType: "User",
          entityId: userId,
          status: "SUCCESS",
          metadataJson: {
            email: locked.email,
            before: { isActive: locked.isActive },
            after: { isActive: true },
          },
        },
      });
      return { before: locked.isActive, after: true };
    }),
  );
}

const suffix = randomUUID().slice(0, 8);
const ids: {
  orgSole?: string;
  orgDual?: string;
  orgMultiA?: string;
  orgMultiB?: string;
  orgOther?: string;
  userSole?: string;
  userA?: string;
  userB?: string;
  userStaff?: string;
  userMulti?: string;
  userCoA?: string;
  userCoB?: string;
} = {};

async function createUser(emailPrefix: string) {
  return prisma.user.create({
    data: {
      email: `${emailPrefix}-${suffix}@example.test`,
      name: emailPrefix,
      isActive: true,
    },
  });
}

async function createOrg(slugPrefix: string, name: string) {
  return prisma.organization.create({
    data: {
      name,
      slug: `${slugPrefix}-${suffix}`,
      isActive: true,
      isDemo: false,
    },
  });
}

async function createMembership(
  organizationId: string,
  userId: string,
  role: "OWNER" | "STAFF" | "ADMIN",
  status: "ACTIVE" | "SUSPENDED" | "REMOVED" | "INVITED" = "ACTIVE",
) {
  return prisma.membership.create({
    data: {
      organizationId,
      userId,
      role,
      status,
      acceptedAt: status === "ACTIVE" ? new Date() : null,
    },
  });
}

describe("last active owner lockout (DB-backed)", () => {
  before(async () => {
    const orgSole = await createOrg("owner-lock-sole", `Owner Lock Sole ${suffix}`);
    const orgDual = await createOrg("owner-lock-dual", `Owner Lock Dual ${suffix}`);
    const orgMultiA = await createOrg("owner-lock-ma", `Owner Lock Multi A ${suffix}`);
    const orgMultiB = await createOrg("owner-lock-mb", `Owner Lock Multi B ${suffix}`);
    const orgOther = await createOrg("owner-lock-other", `Owner Lock Other ${suffix}`);
    ids.orgSole = orgSole.id;
    ids.orgDual = orgDual.id;
    ids.orgMultiA = orgMultiA.id;
    ids.orgMultiB = orgMultiB.id;
    ids.orgOther = orgOther.id;

    const userSole = await createUser("sole-owner");
    const userA = await createUser("owner-a");
    const userB = await createUser("owner-b");
    const userStaff = await createUser("staff-user");
    const userMulti = await createUser("multi-owner");
    const userCoA = await createUser("co-owner-a");
    const userCoB = await createUser("co-owner-b");

    ids.userSole = userSole.id;
    ids.userA = userA.id;
    ids.userB = userB.id;
    ids.userStaff = userStaff.id;
    ids.userMulti = userMulti.id;
    ids.userCoA = userCoA.id;
    ids.userCoB = userCoB.id;

    await createMembership(orgSole.id, userSole.id, "OWNER");
    await createMembership(orgSole.id, userStaff.id, "STAFF");

    await createMembership(orgDual.id, userA.id, "OWNER");
    await createMembership(orgDual.id, userB.id, "OWNER");

    await createMembership(orgMultiA.id, userMulti.id, "OWNER");
    await createMembership(orgMultiA.id, userCoA.id, "OWNER");
    await createMembership(orgMultiB.id, userMulti.id, "OWNER");

    await createMembership(orgOther.id, userCoA.id, "OWNER");
    await createMembership(orgOther.id, userCoB.id, "OWNER");
  });

  after(async () => {
    const userIds = [ids.userSole, ids.userA, ids.userB, ids.userStaff, ids.userMulti, ids.userCoA, ids.userCoB].filter(
      Boolean,
    ) as string[];
    const orgIds = [ids.orgSole, ids.orgDual, ids.orgMultiA, ids.orgMultiB, ids.orgOther].filter(Boolean) as string[];

    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ organizationId: { in: orgIds } }, { entityId: { in: userIds }, entityType: "User" }],
      },
    });
    await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  it("11/13: sole OWNER deactivation rolls back user + writes no success audit", async () => {
    await assert.rejects(() => toggleUserActiveInTransaction(ids.userSole!), LastActiveOwnerError);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userSole! } });
    assert.equal(user.isActive, true);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: ids.userSole!, action: "admin.user.deactivated" },
    });
    assert.equal(audits.length, 0);
  });

  it("2/12: dual OWNER deactivation succeeds with audit", async () => {
    const result = await toggleUserActiveInTransaction(ids.userA!);
    assert.deepEqual(result, { before: true, after: false });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userA! } });
    assert.equal(user.isActive, false);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: ids.userA!, action: "admin.user.deactivated", status: "SUCCESS" },
    });
    assert.equal(audits.length, 1);
    const meta = audits[0].metadataJson as { before: { isActive: boolean }; after: { isActive: boolean } };
    assert.deepEqual(meta, { before: { isActive: true }, after: { isActive: false } });

    await prisma.user.update({ where: { id: ids.userA! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({ where: { entityType: "User", entityId: ids.userA!, action: "admin.user.deactivated" } });
  });

  it("7: STAFF deactivation is allowed", async () => {
    await toggleUserActiveInTransaction(ids.userStaff!);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userStaff! } });
    assert.equal(user.isActive, false);
    await prisma.user.update({ where: { id: ids.userStaff! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({
      where: { entityType: "User", entityId: ids.userStaff!, action: "admin.user.deactivated" },
    });
  });

  it("8: multi-org sole-owner org blocks entire deactivation", async () => {
    await assert.rejects(
      () => toggleUserActiveInTransaction(ids.userMulti!),
      (error: unknown) => {
        assert.ok(error instanceof LastActiveOwnerError);
        assert.ok(error.organizations.some((org) => org.id === ids.orgMultiB));
        return true;
      },
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userMulti! } });
    assert.equal(user.isActive, true);
  });

  it("10: reactivation false→true is not blocked by the owner guard", async () => {
    await prisma.user.update({ where: { id: ids.userSole! }, data: { isActive: false } });
    const result = await toggleUserActiveInTransaction(ids.userSole!);
    assert.deepEqual(result, { before: false, after: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userSole! } });
    assert.equal(user.isActive, true);
    await prisma.auditLog.deleteMany({ where: { entityType: "User", entityId: ids.userSole!, action: "admin.user.reactivated" } });
  });

  it("14/16: concurrent dual-owner deactivation cannot deactivate both; other org untouched", async () => {
    await prisma.user.update({ where: { id: ids.userA! }, data: { isActive: true } });
    await prisma.user.update({ where: { id: ids.userB! }, data: { isActive: true } });

    const otherBefore = await prisma.membership.findMany({
      where: { organizationId: ids.orgOther! },
      include: { user: { select: { id: true, isActive: true } } },
      orderBy: { id: "asc" },
    });

    const results = await Promise.allSettled([
      toggleUserActiveInTransaction(ids.userA!),
      toggleUserActiveInTransaction(ids.userB!),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled").length;
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled, 1, "exactly one concurrent deactivation should succeed");
    assert.equal(rejected.length, 1, "exactly one concurrent deactivation should fail");
    assert.ok(rejected[0].status === "rejected" && rejected[0].reason instanceof LastActiveOwnerError);

    const userA = await prisma.user.findUniqueOrThrow({ where: { id: ids.userA! } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { id: ids.userB! } });
    assert.equal(userA.isActive && userB.isActive, false, "both owners must not be inactive");
    assert.equal(userA.isActive || userB.isActive, true, "at least one owner must remain active");

    const otherAfter = await prisma.membership.findMany({
      where: { organizationId: ids.orgOther! },
      include: { user: { select: { id: true, isActive: true } } },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(
      otherAfter.map((row) => ({ id: row.id, userId: row.userId, isActive: row.user.isActive })),
      otherBefore.map((row) => ({ id: row.id, userId: row.userId, isActive: row.user.isActive })),
    );

    await prisma.user.update({ where: { id: ids.userA! }, data: { isActive: true } });
    await prisma.user.update({ where: { id: ids.userB! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "User",
        entityId: { in: [ids.userA!, ids.userB!] },
        action: "admin.user.deactivated",
      },
    });
  });

  it("3: other OWNER with isActive=false cannot authorize deactivation", async () => {
    await prisma.user.update({ where: { id: ids.userB! }, data: { isActive: false } });
    await assert.rejects(
      () =>
        runWithTransactionRetry(() =>
          prisma.$transaction(async (tx) => {
            await lockUserForUpdate(tx, ids.userA!);
            await assertUserDeactivationPreservesActiveOwners(tx, ids.userA!);
            await tx.user.update({ where: { id: ids.userA! }, data: { isActive: false } });
          }),
        ),
      LastActiveOwnerError,
    );
    const userA = await prisma.user.findUniqueOrThrow({ where: { id: ids.userA! } });
    assert.equal(userA.isActive, true);
    await prisma.user.update({ where: { id: ids.userB! }, data: { isActive: true } });
  });

  it("stale-safe: concurrent toggles on the same user serialize without audit/state corruption", async () => {
    await prisma.user.update({ where: { id: ids.userStaff! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "User",
        entityId: ids.userStaff!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated"] },
      },
    });

    const results = await Promise.allSettled([
      toggleUserActiveInTransaction(ids.userStaff!),
      toggleUserActiveInTransaction(ids.userStaff!),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userStaff! } });
    // Two sequential toggles from true → false → true (or equivalent under lock).
    assert.equal(user.isActive, true);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "User",
        entityId: ids.userStaff!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated"] },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(audits.length, 2);
    for (const audit of audits) {
      const meta = audit.metadataJson as { before: { isActive: boolean }; after: { isActive: boolean } };
      assert.equal(meta.after.isActive, !meta.before.isActive);
      assert.equal(audit.action, meta.after.isActive ? "admin.user.reactivated" : "admin.user.deactivated");
    }

    await prisma.auditLog.deleteMany({
      where: {
        entityType: "User",
        entityId: ids.userStaff!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated"] },
      },
    });
  });

  it("stale-safe: deactivation vs password-reset race keeps final isActive and audit consistent", async () => {
    await prisma.user.update({ where: { id: ids.userA! }, data: { isActive: true } });
    await prisma.user.update({ where: { id: ids.userB! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "User",
        entityId: ids.userA!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated", "admin.user.password_reset"] },
      },
    });

    const results = await Promise.allSettled([
      toggleUserActiveInTransaction(ids.userA!),
      passwordResetReactivateInTransaction(ids.userA!),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.equal(fulfilled.length, 2);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.userA! } });
    // Password reset always ends with isActive=true; if it ran last, user is active.
    // If toggle ran last after reset, user may be inactive. Either way final state must
    // match the last audit's `after.isActive`.
    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "User",
        entityId: ids.userA!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated", "admin.user.password_reset"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    assert.ok(audits.length >= 2);
    const last = audits[audits.length - 1];
    const lastMeta = last.metadataJson as { before: { isActive: boolean }; after: { isActive: boolean } };
    assert.equal(user.isActive, lastMeta.after.isActive);
    for (const audit of audits) {
      const meta = audit.metadataJson as { before: { isActive: boolean }; after: { isActive: boolean } };
      assert.ok(typeof meta.before.isActive === "boolean");
      assert.ok(typeof meta.after.isActive === "boolean");
    }

    await prisma.user.update({ where: { id: ids.userA! }, data: { isActive: true } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "User",
        entityId: ids.userA!,
        action: { in: ["admin.user.deactivated", "admin.user.reactivated", "admin.user.password_reset"] },
      },
    });
  });

  it("membership: concurrent demote of two OWNERs leaves at least one OWNER", async () => {
    const memberships = await prisma.membership.findMany({
      where: { organizationId: ids.orgDual!, role: "OWNER", status: "ACTIVE" },
      orderBy: { id: "asc" },
    });
    assert.equal(memberships.length, 2);

    const demote = (membershipId: string) =>
      runWithTransactionRetry(() =>
        prisma.$transaction(async (tx) => {
          await assertMembershipChangePreservesActiveOwners(tx, {
            organizationId: ids.orgDual!,
            excludingMembershipId: membershipId,
          });
          await tx.membership.update({ where: { id: membershipId }, data: { role: "ADMIN" } });
        }),
      );

    const results = await Promise.allSettled([demote(memberships[0].id), demote(memberships[1].id)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.ok(
      results.some((r) => r.status === "rejected" && r.reason instanceof LastActiveOwnerError),
    );

    const remainingOwners = await prisma.membership.count({
      where: { organizationId: ids.orgDual!, role: "OWNER", status: "ACTIVE" },
    });
    assert.equal(remainingOwners, 1);

    // Restore dual OWNER fixture.
    await prisma.membership.updateMany({
      where: { organizationId: ids.orgDual!, userId: { in: [ids.userA!, ids.userB!] } },
      data: { role: "OWNER", status: "ACTIVE" },
    });
  });
});
