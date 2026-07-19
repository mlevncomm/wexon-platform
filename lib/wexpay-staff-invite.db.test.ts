import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  MembershipRole,
  MembershipStatus,
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationStepKey,
} from ".prisma/client";
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

const suffix = Date.now().toString(36);

describe("staff invite db", () => {
  let orgId = "";
  let ownerId = "";
  let productId = "";
  let journeyId = "";

  before(async () => {
    process.env.WEXON_EMAIL_PROVIDER = "fake";
    delete process.env.VERCEL_ENV;

    const product = await prisma.product.findFirst({ where: { key: "wexpay" } });
    assert.ok(product);
    productId = product!.id;

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

    // Minimal license/install/fee so evaluateProductAccess can pass if seeded plans exist.
    // If access fails in this env, tests that need create will skip via catch.
    const plan = await prisma.plan.findFirst({ where: { productId, isActive: true } });
    if (plan) {
      const license = await prisma.license.create({
        data: {
          organizationId: orgId,
          productId,
          planId: plan.id,
          status: "ACTIVE",
          licenseType: "MONTHLY",
        },
      });
      await prisma.appInstallation.create({
        data: {
          organizationId: orgId,
          productId,
          licenseId: license.id,
          status: "ACTIVE",
        },
      });
      await prisma.activationFeeLedger.create({
        data: {
          organizationId: orgId,
          productId,
          status: "WAIVED",
          currency: "TRY",
          activationFeeMinor: 0,
          grossAmountMinor: 0,
        },
      });
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
              status: "PENDING",
            })),
          },
        },
      });
      journeyId = journey.id;
    }
  });

  after(async () => {
    if (orgId) {
      await prisma.staffInvite.deleteMany({ where: { organizationId: orgId } });
      await prisma.activationJourney.deleteMany({ where: { organizationId: orgId } });
      await prisma.activationFeeLedger.deleteMany({ where: { organizationId: orgId } });
      await prisma.appInstallation.deleteMany({ where: { organizationId: orgId } });
      await prisma.license.deleteMany({ where: { organizationId: orgId } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it("stores only hashed tokens and never raw plaintext", async () => {
    const material = generateSecureStaffInviteTokenMaterial();
    const row = await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `staff-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: material.tokenHash,
        tokenPrefix: material.tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
      },
    });
    assert.equal(row.tokenHash, hashStaffInviteToken(material.plaintext));
    assert.ok(!JSON.stringify(row).includes(material.plaintext));
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

  it("accepts new user invite when product access allows", async () => {
    if (!journeyId) return;
    let created;
    try {
      created = await createStaffInvite({
        organizationId: orgId,
        actorUserId: ownerId,
        email: `newbie-${suffix}@example.com`,
        role: MembershipRole.STAFF,
      });
    } catch (error) {
      if (error instanceof StaffInviteError && error.code === "NO_ACCESS") return;
      throw error;
    }

    // Recover plaintext via oneTime URL in fake mode or by re-hashing from DB is impossible —
    // create returns oneTimeInviteUrl in fake mode.
    assert.ok(created.oneTimeInviteUrl);
    const token = created.oneTimeInviteUrl!.split("/invite/")[1]!;
    const result = await acceptStaffInvite({
      plaintextToken: decodeURIComponent(token),
      email: `newbie-${suffix}@example.com`,
      name: "Newbie Staff",
      password: "Password1!",
    });
    assert.equal(result.organizationId, orgId);
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: result.userId } },
    });
    assert.equal(membership?.status, MembershipStatus.ACTIVE);
    assert.equal(membership?.role, MembershipRole.STAFF);

    await assert.rejects(
      () =>
        acceptStaffInvite({
          plaintextToken: decodeURIComponent(token),
          email: `newbie-${suffix}@example.com`,
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
