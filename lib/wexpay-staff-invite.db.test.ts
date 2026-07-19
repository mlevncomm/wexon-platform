import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationStepKey,
  StaffInviteDeliveryStatus,
} from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";
import {
  acceptStaffInvite,
  createStaffInvite,
  hashStaffInviteToken,
  generateSecureStaffInviteTokenMaterial,
  StaffInviteError,
} from "@/lib/wexpay-staff-invite";
import { hashPassword } from "@/lib/wexon-passwords";
import { clearFakeEmailOutbox, getFakeEmailOutbox } from "@/lib/wexon-email";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);

describe("staff invite security (db)", () => {
  let orgId = "";
  let orgBId = "";
  let ownerId = "";
  let productId = "";
  let planId = "";
  let journeyId = "";
  const createdUserIds: string[] = [];

  async function seedAccess(organizationId: string) {
    const license = await prisma.license.create({
      data: {
        organizationId,
        productId,
        planId,
        status: "ACTIVE",
        licenseType: "MONTHLY",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.appInstallation.create({
      data: {
        organizationId,
        productId,
        licenseId: license.id,
        status: "ACTIVE",
      },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId,
        productId,
        planId,
        status: "WAIVED",
        currency: "TRY",
        activationFeeMinor: 0,
        grossAmountMinor: 0,
      },
    });
  }

  before(async () => {
    process.env.WEXON_EMAIL_PROVIDER = "fake";
    delete process.env.VERCEL_ENV;
    clearFakeEmailOutbox();

    const product = await prisma.product.findFirst({ where: { key: "wexpay", isActive: true } });
    assert.ok(product, "wexpay product must exist");
    productId = product!.id;

    const plan = await prisma.plan.findFirst({ where: { productId, isActive: true } });
    assert.ok(plan, "active plan must exist");
    planId = plan!.id;

    // Ensure staff_limit is present and finite for seat tests.
    const staffEnt = await prisma.entitlement.findFirst({
      where: { planId, key: "staff_limit" },
    });
    if (!staffEnt) {
      await prisma.entitlement.create({
        data: {
          planId,
          key: "staff_limit",
          valueType: "INTEGER",
          valueInt: 10,
          isActive: true,
        },
      });
    }

    const owner = await prisma.user.create({
      data: {
        email: `owner-invite-${suffix}@example.com`,
        name: "Owner",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    ownerId = owner.id;
    createdUserIds.push(owner.id);

    const org = await prisma.organization.create({
      data: {
        name: `Invite Org ${suffix}`,
        slug: `invite-org-${suffix}`,
        isActive: true,
        isDemo: false,
      },
    });
    orgId = org.id;

    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: ownerId,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });

    await seedAccess(orgId);

    const orgB = await prisma.organization.create({
      data: {
        name: `Invite OrgB ${suffix}`,
        slug: `invite-org-b-${suffix}`,
        isActive: true,
        isDemo: false,
      },
    });
    orgBId = orgB.id;
    await seedAccess(orgBId);

    const journey = await prisma.activationJourney.create({
      data: {
        organizationId: orgId,
        productId,
        status: ActivationJourneyStatus.IN_PROGRESS,
        source: ActivationJourneySource.SELF_SERVE,
        currentStep: ActivationStepKey.STAFF_INVITE,
        version: 1,
        steps: {
          create: Object.values(ActivationStepKey).map((stepKey) => ({
            stepKey,
            status:
              stepKey === ActivationStepKey.STAFF_INVITE
                ? "PENDING"
                : stepKey === ActivationStepKey.MENU_IMPORT ||
                    stepKey === ActivationStepKey.PAYMENT_PROVIDER ||
                    stepKey === ActivationStepKey.VALIDATION ||
                    stepKey === ActivationStepKey.GO_LIVE
                  ? "PENDING"
                  : "COMPLETED",
          })),
        },
      },
    });
    journeyId = journey.id;
  });

  after(async () => {
    if (orgId) {
      await prisma.staffInvite.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.activationJourneyStep.deleteMany({
        where: { journey: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } },
      });
      await prisma.activationJourney.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.license.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: [orgId, orgBId].filter(Boolean) } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, orgBId].filter(Boolean) } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("stores only hashed tokens and never raw plaintext in DB/audit", async () => {
    const material = generateSecureStaffInviteTokenMaterial();
    const row = await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `hash-only-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
      },
    });
    assert.equal(row.tokenHash, hashStaffInviteToken(material.plaintext));
    assert.ok(!JSON.stringify(row).includes(material.plaintext));
    const audits = await prisma.auditLog.findMany({
      where: { organizationId: orgId, entityType: "StaffInvite" },
      take: 20,
    });
    for (const audit of audits) {
      assert.ok(!JSON.stringify(audit).includes(material.plaintext));
    }
    await prisma.staffInvite.delete({ where: { id: row.id } });
  });

  it("rejects OWNER invites via createStaffInvite", async () => {
    await assert.rejects(
      () =>
        createStaffInvite({
          organizationId: orgId,
          actorUserId: ownerId,
          email: `owner-try-${suffix}@example.com`,
          role: MembershipRole.OWNER,
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "OWNER_FORBIDDEN",
    );
  });

  it("rejects invite when membership already exists", async () => {
    await assert.rejects(
      () =>
        createStaffInvite({
          organizationId: orgId,
          actorUserId: ownerId,
          email: `owner-invite-${suffix}@example.com`,
          role: MembershipRole.STAFF,
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "MEMBERSHIP_EXISTS",
    );
  });

  it("passworded user without session → LOGIN_REQUIRED and no session flag", async () => {
    const existing = await prisma.user.create({
      data: {
        email: `existing-${suffix}@example.com`,
        name: "Existing",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    createdUserIds.push(existing.id);

    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email: existing.email,
      role: MembershipRole.STAFF,
    });
    assert.ok(created.oneTimeInviteUrl);
    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);

    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: token,
          email: existing.email,
          customerSession: null,
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "LOGIN_REQUIRED",
    );

    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: existing.id } },
    });
    assert.equal(membership, null);

    const inviteStillOpen = await prisma.staffInvite.findUnique({ where: { id: created.invite.id } });
    assert.equal(inviteStillOpen?.acceptedAt, null);
  });

  it("passworded user with matching session can accept (no shouldCreateSession)", async () => {
    const email = `session-ok-${suffix}@example.com`;
    const existing = await prisma.user.create({
      data: {
        email,
        name: "Session Ok",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    createdUserIds.push(existing.id);

    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.MANAGER,
    });
    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);

    const result = await acceptStaffInvite({
      plaintextToken: token,
      email,
      customerSession: { userId: existing.id },
    });
    assert.equal(result.shouldCreateSession, false);
    assert.equal(result.userId, existing.id);

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: existing.id } },
    });
    assert.equal(membership.role, MembershipRole.MANAGER);

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(unchanged.passwordHash, existing.passwordHash);
  });

  it("wrong session user → SESSION_MISMATCH", async () => {
    const email = `session-bad-${suffix}@example.com`;
    const existing = await prisma.user.create({
      data: {
        email,
        name: "Session Bad",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    createdUserIds.push(existing.id);

    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);

    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: token,
          email,
          customerSession: { userId: ownerId },
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "SESSION_MISMATCH",
    );
  });

  it("existing OWNER membership is not downgraded (MEMBERSHIP_EXISTS)", async () => {
    const email = `owner-other-${suffix}@example.com`;
    const otherOwner = await prisma.user.create({
      data: {
        email,
        name: "Other Owner",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    createdUserIds.push(otherOwner.id);

    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: otherOwner.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });

    // Direct invite insert (createStaffInvite would reject MEMBERSHIP_EXISTS)
    const material = generateSecureStaffInviteTokenMaterial();
    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email,
        role: MembershipRole.STAFF,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
        deliveryStatus: StaffInviteDeliveryStatus.SENT,
      },
    });

    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: material.plaintext,
          email,
          customerSession: { userId: otherOwner.id },
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "MEMBERSHIP_EXISTS",
    );

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgId, userId: otherOwner.id } },
    });
    assert.equal(membership.role, MembershipRole.OWNER);
  });

  it("cross-tenant accept stays on invite org only (fail-closed for foreign membership)", async () => {
    const email = `cross-${suffix}@example.com`;
    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);
    const result = await acceptStaffInvite({
      plaintextToken: token,
      email,
      name: "Cross User",
      password: "Password1!",
      customerSession: null,
    });
    createdUserIds.push(result.userId);
    assert.equal(result.organizationId, orgId);

    const foreign = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgBId, userId: result.userId } },
    });
    assert.equal(foreign, null);
  });

  it("expired and revoked invites fail-closed", async () => {
    const expiredMaterial = generateSecureStaffInviteTokenMaterial();
    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `expired-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: expiredMaterial.tokenHash,
        tokenPrefix: expiredMaterial.tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
        createdByUserId: ownerId,
        deliveryStatus: StaffInviteDeliveryStatus.SENT,
      },
    });
    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: expiredMaterial.plaintext,
          email: `expired-${suffix}@example.com`,
          name: "X",
          password: "Password1!",
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "INVALID",
    );

    const revokedMaterial = generateSecureStaffInviteTokenMaterial();
    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `revoked-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: revokedMaterial.tokenHash,
        tokenPrefix: revokedMaterial.tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        createdByUserId: ownerId,
        deliveryStatus: StaffInviteDeliveryStatus.SENT,
      },
    });
    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: revokedMaterial.plaintext,
          email: `revoked-${suffix}@example.com`,
          name: "X",
          password: "Password1!",
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "INVALID",
    );
  });

  it("re-invite revokes previous open invite so staff limit is not double-counted", async () => {
    const email = `reinvite-${suffix}@example.com`;
    const first = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    const second = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    assert.notEqual(first.invite.id, second.invite.id);

    const firstRow = await prisma.staffInvite.findUniqueOrThrow({ where: { id: first.invite.id } });
    assert.ok(firstRow.revokedAt);

    const open = await prisma.staffInvite.count({
      where: {
        organizationId: orgId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    assert.equal(open, 1);
  });

  it("concurrent accept only succeeds once", async () => {
    const email = `concurrent-${suffix}@example.com`;
    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);

    const results = await Promise.allSettled([
      acceptStaffInvite({
        plaintextToken: token,
        email,
        name: "C1",
        password: "Password1!",
      }),
      acceptStaffInvite({
        plaintextToken: token,
        email,
        name: "C1",
        password: "Password1!",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const userId = (fulfilled[0] as PromiseFulfilledResult<{ userId: string }>).value.userId;
    createdUserIds.push(userId);

    const memberships = await prisma.membership.count({
      where: { organizationId: orgId, userId },
    });
    assert.equal(memberships, 1);
  });

  it("FAILED delivery does not count as SENT for wizard completion policy", async () => {
    const material = generateSecureStaffInviteTokenMaterial();
    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `failed-del-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
        deliveryStatus: StaffInviteDeliveryStatus.FAILED,
        lastDeliveryErrorCode: "TEST_FAIL",
      },
    });

    const qualifying = await prisma.staffInvite.count({
      where: {
        organizationId: orgId,
        OR: [
          { acceptedAt: { not: null } },
          {
            revokedAt: null,
            expiresAt: { gt: new Date() },
            deliveryStatus: StaffInviteDeliveryStatus.SENT,
          },
        ],
        email: `failed-del-${suffix}@example.com`,
      },
    });
    assert.equal(qualifying, 0);
  });

  it("new user accept works and fake email outbox has no raw token", async () => {
    clearFakeEmailOutbox();
    const email = `newbie-${suffix}@example.com`;
    const created = await createStaffInvite({
      organizationId: orgId,
      actorUserId: ownerId,
      email,
      role: MembershipRole.STAFF,
    });
    assert.ok(created.oneTimeInviteUrl);
    assert.equal(created.invite.deliveryStatus, StaffInviteDeliveryStatus.SENT);

    for (const row of getFakeEmailOutbox()) {
      assert.ok(!JSON.stringify(row).includes(created.oneTimeInviteUrl!.split("/invite/")[1]!));
    }

    const token = decodeURIComponent(created.oneTimeInviteUrl!.split("/invite/")[1]!);
    const result = await acceptStaffInvite({
      plaintextToken: token,
      email,
      name: "Newbie Staff",
      password: "Password1!",
    });
    createdUserIds.push(result.userId);
    assert.equal(result.shouldCreateSession, true);
    assert.equal(result.organizationId, orgId);
    assert.ok(journeyId);

    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: token,
          email,
          password: "Password1!",
        }),
      (err: unknown) => err instanceof StaffInviteError,
    );
  });

  it("expects 38 public tables including StaffInvite", async () => {
    const tables = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT count(*)::bigint AS c
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `;
    assert.equal(Number(tables[0]!.c), EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 38);
  });
});
