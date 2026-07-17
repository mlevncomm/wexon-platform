import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMembershipChangePreservesActiveOwners,
  assertUserDeactivationPreservesActiveOwners,
  isActiveOwnerRecord,
  isRetryableTransactionError,
  LastActiveOwnerError,
  runWithTransactionRetry,
  type ActiveOwnerClient,
  type ActiveOwnerOrganization,
} from "./wexon-active-owner";

type MembershipRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  userIsActive: boolean;
  organization: ActiveOwnerOrganization;
};

function createMockTx(rows: MembershipRow[]): ActiveOwnerClient {
  const client = {
    membership: {
      findMany: async (args: unknown) => {
        const where = (args as { where?: Record<string, unknown> }).where ?? {};
        return rows
          .filter((row) => {
            if (where.userId && row.userId !== where.userId) return false;
            if (where.organizationId && row.organizationId !== where.organizationId) return false;
            if (where.role && row.role !== where.role) return false;
            if (where.status && row.status !== where.status) return false;
            return true;
          })
          .map((row) => ({
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            role: row.role,
            status: row.status,
            organization: row.organization,
            user: { id: row.userId, isActive: row.userIsActive },
          }));
      },
      count: async (args: unknown) => {
        const where = (args as { where?: Record<string, unknown> }).where ?? {};
        const userFilter = where.user as { isActive?: boolean } | undefined;
        const userIdNot = (where.userId as { not?: string } | undefined)?.not;
        const idNot = (where.id as { not?: string } | undefined)?.not;

        return rows.filter((row) => {
          if (where.organizationId && row.organizationId !== where.organizationId) return false;
          if (where.role && row.role !== where.role) return false;
          if (where.status && row.status !== where.status) return false;
          if (userFilter?.isActive === true && !row.userIsActive) return false;
          if (userIdNot && row.userId === userIdNot) return false;
          if (idNot && row.id === idNot) return false;
          return true;
        }).length;
      },
    },
    organization: {
      findUnique: async (args: unknown) => {
        const id = (args as { where: { id: string } }).where.id;
        const row = rows.find((candidate) => candidate.organizationId === id);
        return row?.organization ?? null;
      },
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
  };

  return client as unknown as ActiveOwnerClient;
}

const orgA: ActiveOwnerOrganization = { id: "org-a", name: "Alpha Cafe", slug: "alpha-cafe" };
const orgB: ActiveOwnerOrganization = { id: "org-b", name: "Beta Kitchen", slug: "beta-kitchen" };
const orgC: ActiveOwnerOrganization = { id: "org-c", name: "Gamma Deli", slug: "gamma-deli" };

describe("isActiveOwnerRecord", () => {
  it("requires OWNER + ACTIVE membership + active user", () => {
    assert.equal(isActiveOwnerRecord({ role: "OWNER", status: "ACTIVE", userIsActive: true }), true);
    assert.equal(isActiveOwnerRecord({ role: "OWNER", status: "ACTIVE", userIsActive: false }), false);
    assert.equal(isActiveOwnerRecord({ role: "OWNER", status: "SUSPENDED", userIsActive: true }), false);
    assert.equal(isActiveOwnerRecord({ role: "OWNER", status: "REMOVED", userIsActive: true }), false);
    assert.equal(isActiveOwnerRecord({ role: "OWNER", status: "INVITED", userIsActive: true }), false);
    assert.equal(isActiveOwnerRecord({ role: "ADMIN", status: "ACTIVE", userIsActive: true }), false);
    assert.equal(isActiveOwnerRecord({ role: "STAFF", status: "ACTIVE", userIsActive: true }), false);
  });
});

describe("assertUserDeactivationPreservesActiveOwners", () => {
  it("1: sole active OWNER deactivation is rejected", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.rejects(
      () => assertUserDeactivationPreservesActiveOwners(tx, "user-1"),
      (error: unknown) => {
        assert.ok(error instanceof LastActiveOwnerError);
        assert.equal(error.organizations.length, 1);
        assert.equal(error.organizations[0].slug, "alpha-cafe");
        assert.match(error.message, /alpha-cafe/);
        return true;
      },
    );
  });

  it("2: two active OWNERs — one may deactivate", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.doesNotReject(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"));
  });

  it("3: other OWNER with User.isActive=false does not count", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: false,
        organization: orgA,
      },
    ]);

    await assert.rejects(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"), LastActiveOwnerError);
  });

  it("4: other OWNER membership SUSPENDED does not count", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "SUSPENDED",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.rejects(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"), LastActiveOwnerError);
  });

  it("5: other OWNER membership REMOVED does not count", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "REMOVED",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.rejects(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"), LastActiveOwnerError);
  });

  it("6: other OWNER membership INVITED does not count", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "INVITED",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.rejects(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"), LastActiveOwnerError);
  });

  it("7: non-OWNER STAFF/ADMIN may deactivate", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-staff",
        role: "STAFF",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-admin",
        role: "ADMIN",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m3",
        organizationId: orgA.id,
        userId: "user-owner",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.doesNotReject(() => assertUserDeactivationPreservesActiveOwners(tx, "user-staff"));
    await assert.doesNotReject(() => assertUserDeactivationPreservesActiveOwners(tx, "user-admin"));
  });

  it("8: multi-org owner blocked when any org would lose its last active owner", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m3",
        organizationId: orgB.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgB,
      },
    ]);

    await assert.rejects(
      () => assertUserDeactivationPreservesActiveOwners(tx, "user-1"),
      (error: unknown) => {
        assert.ok(error instanceof LastActiveOwnerError);
        assert.equal(error.organizations.length, 1);
        assert.equal(error.organizations[0].id, orgB.id);
        return true;
      },
    );
  });

  it("9: multi-org owner allowed when every org keeps another active owner", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m3",
        organizationId: orgB.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgB,
      },
      {
        id: "m4",
        organizationId: orgB.id,
        userId: "user-3",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgB,
      },
    ]);

    await assert.doesNotReject(() => assertUserDeactivationPreservesActiveOwners(tx, "user-1"));
  });

  it("lists every unsafe organization when multiple would be orphaned", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgB.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgB,
      },
      {
        id: "m3",
        organizationId: orgC.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgC,
      },
      {
        id: "m4",
        organizationId: orgC.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgC,
      },
    ]);

    await assert.rejects(
      () => assertUserDeactivationPreservesActiveOwners(tx, "user-1"),
      (error: unknown) => {
        assert.ok(error instanceof LastActiveOwnerError);
        assert.equal(error.organizations.length, 2);
        assert.deepEqual(
          error.organizations.map((org) => org.slug).sort(),
          ["alpha-cafe", "beta-kitchen"],
        );
        return true;
      },
    );
  });
});

describe("assertMembershipChangePreservesActiveOwners", () => {
  it("15: last active OWNER membership demotion/suspension is rejected", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.rejects(
      () =>
        assertMembershipChangePreservesActiveOwners(tx, {
          organizationId: orgA.id,
          excludingMembershipId: "m1",
        }),
      LastActiveOwnerError,
    );
  });

  it("15b: demotion allowed when another active OWNER remains", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
    ]);

    await assert.doesNotReject(() =>
      assertMembershipChangePreservesActiveOwners(tx, {
        organizationId: orgA.id,
        excludingMembershipId: "m1",
      }),
    );
  });

  it("inactive-user OWNER does not satisfy membership last-owner check", async () => {
    const tx = createMockTx([
      {
        id: "m1",
        organizationId: orgA.id,
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: true,
        organization: orgA,
      },
      {
        id: "m2",
        organizationId: orgA.id,
        userId: "user-2",
        role: "OWNER",
        status: "ACTIVE",
        userIsActive: false,
        organization: orgA,
      },
    ]);

    await assert.rejects(
      () =>
        assertMembershipChangePreservesActiveOwners(tx, {
          organizationId: orgA.id,
          excludingMembershipId: "m1",
        }),
      LastActiveOwnerError,
    );
  });
});

describe("runWithTransactionRetry", () => {
  it("retries only known serialization/deadlock errors", async () => {
    let attempts = 0;
    const result = await runWithTransactionRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("Transaction conflict");
        (error as { code?: string }).code = "P2034";
        throw error;
      }
      return "ok";
    });

    assert.equal(result, "ok");
    assert.equal(attempts, 3);
  });

  it("does not retry LastActiveOwnerError", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        runWithTransactionRetry(async () => {
          attempts += 1;
          throw new LastActiveOwnerError([orgA]);
        }),
      LastActiveOwnerError,
    );
    assert.equal(attempts, 1);
  });

  it("classifies retryable codes", () => {
    assert.equal(isRetryableTransactionError({ code: "P2034" }), true);
    assert.equal(isRetryableTransactionError({ code: "40P01" }), true);
    assert.equal(isRetryableTransactionError({ code: "40001" }), true);
    assert.equal(isRetryableTransactionError(new LastActiveOwnerError([orgA])), false);
    assert.equal(isRetryableTransactionError(new Error("validation")), false);
  });
});
