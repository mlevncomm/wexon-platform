import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationStepKey,
  ActivationJourneyStepStatus,
} from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import {
  ActivationWizardError,
  acknowledgeTableQrPack,
  completeStaffInviteWizardStep,
  createTablesWithOpaqueQr,
  recoverWizardTableQrPack,
  saveBranchSetupStep,
  saveBusinessProfileStep,
} from "@/lib/wexpay-activation-wizard";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import { assertEntitlementLimit } from "@/lib/wexon-core-access";
import { hashPassword } from "@/lib/wexon-passwords";
import { MembershipRole, MembershipStatus } from ".prisma/client";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);

describe("activation wizard security (db)", () => {
  let orgId = "";
  let orgBId = "";
  let ownerId = "";
  let productId = "";
  let planId = "";
  let journeyId = "";
  let version = 1;

  async function seedOrg(label: string) {
    const org = await prisma.organization.create({
      data: {
        name: `${label} ${suffix}`,
        slug: `${label.toLowerCase()}-${suffix}`,
        isActive: true,
        isDemo: false,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `${label.toLowerCase()}-${suffix}@example.com`,
        name: label,
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });
    const license = await prisma.license.create({
      data: {
        organizationId: org.id,
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
        organizationId: org.id,
        productId,
        licenseId: license.id,
        status: "ACTIVE",
      },
    });
    await prisma.activationFeeLedger.create({
      data: {
        organizationId: org.id,
        productId,
        planId,
        status: "PAID",
        activationFeeMinor: 0,
        paidAt: new Date(),
      },
    });
    return { orgId: org.id, userId: user.id };
  }

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay", isActive: true } });
    assert.ok(product);
    productId = product!.id;
    const plan = await prisma.plan.findFirst({ where: { productId, isActive: true } });
    assert.ok(plan);
    planId = plan!.id;

    for (const key of ["branch_limit", "table_limit", "staff_limit"]) {
      const existing = await prisma.entitlement.findFirst({ where: { planId, key } });
      if (!existing) {
        await prisma.entitlement.create({
          data: { planId, key, valueType: "INTEGER", valueInt: 50, isActive: true },
        });
      } else if (existing.valueInt !== null && existing.valueInt >= 0 && existing.valueInt < 5) {
        await prisma.entitlement.update({
          where: { id: existing.id },
          data: { valueInt: 50 },
        });
      }
    }

    const a = await seedOrg("WizA");
    orgId = a.orgId;
    ownerId = a.userId;
    const b = await seedOrg("WizB");
    orgBId = b.orgId;

    const journey = await prisma.activationJourney.create({
      data: {
        organizationId: orgId,
        productId,
        status: ActivationJourneyStatus.IN_PROGRESS,
        source: ActivationJourneySource.SELF_SERVE,
        currentStep: ActivationStepKey.BUSINESS_PROFILE,
        version: 1,
        steps: {
          create: Object.values(ActivationStepKey).map((stepKey) => ({
            stepKey,
            status: ActivationJourneyStepStatus.PENDING,
          })),
        },
      },
    });
    journeyId = journey.id;
    version = 1;
  });

  after(async () => {
    const orgIds = [orgId, orgBId].filter(Boolean);
    if (!orgIds.length) return;
    await prisma.tableQrToken.deleteMany({
      where: { table: { branch: { restaurant: { organizationId: { in: orgIds } } } } },
    });
    await prisma.restaurantTable.deleteMany({
      where: { branch: { restaurant: { organizationId: { in: orgIds } } } },
    });
    await prisma.branch.deleteMany({ where: { restaurant: { organizationId: { in: orgIds } } } });
    await prisma.restaurant.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.activationJourneyStep.deleteMany({
      where: { journey: { organizationId: { in: orgIds } } },
    });
    await prisma.activationJourney.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.activationFeeLedger.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.appInstallation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.license.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.staffInvite.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({
      where: { email: { in: [`wiza-${suffix}@example.com`, `wizb-${suffix}@example.com`] } },
    });
  });

  it("canonical limit missing/0/invalid default-deny", () => {
    assert.equal(assertEntitlementLimit({}, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: 0 }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: -2 }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: "nope" }, "table_limit", 0).ok, false);
    assert.equal(assertEntitlementLimit({ table_limit: -1 }, "table_limit", 999).ok, true);
  });

  it("out-of-order wizard transition is rejected", async () => {
    await assert.rejects(
      () =>
        saveBranchSetupStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version,
          restaurantName: "Restoran",
          branchName: "Sube",
          branchAddress: "Addr 1",
        }),
      (err: unknown) =>
        (err instanceof ActivationJourneyError && err.code === "OUT_OF_ORDER") ||
        (err instanceof ActivationWizardError && err.code === "OUT_OF_ORDER"),
    );
  });

  it("stale version is rejected", async () => {
    await assert.rejects(
      () =>
        saveBusinessProfileStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version + 99,
          name: "Stale Org",
        }),
      (err: unknown) =>
        err instanceof ActivationJourneyError && err.code === "VERSION_CONFLICT",
    );
  });

  it("business → branch → atomic tables+QR; double submit does not duplicate; recover rotates", async () => {
    const profile = await saveBusinessProfileStep({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      name: `Biz ${suffix}`,
    });
    version = profile.version;
    assert.equal(profile.currentStep, ActivationStepKey.BRANCH_SETUP);

    const branch = await saveBranchSetupStep({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      restaurantName: `Rest ${suffix}`,
      branchName: `Branch ${suffix}`,
      branchAddress: "Ataturk Cad 1",
    });
    version = branch.version;
    const branchMeta = branch.steps.find((s) => s.stepKey === ActivationStepKey.BRANCH_SETUP)
      ?.safeMetadataJson as { branchId?: string };
    assert.ok(branchMeta?.branchId);

    const pack = await createTablesWithOpaqueQr({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId: branchMeta.branchId!,
      count: 2,
      prefix: "Masa",
      seats: 4,
    });
    version = pack.journeyVersion;
    assert.equal(pack.qrs.length, 2);
    for (const qr of pack.qrs) {
      assert.ok(qr.plaintext.length > 20);
      assert.ok(qr.publicPath.startsWith("/q/"));
      const row = await prisma.tableQrToken.findFirst({
        where: { tableId: qr.tableId, status: "ACTIVE" },
      });
      assert.ok(row);
      assert.ok(!JSON.stringify(row).includes(qr.plaintext));
    }

    const tableCountAfterFirst = await prisma.restaurantTable.count({
      where: { branchId: branchMeta.branchId },
    });
    assert.equal(tableCountAfterFirst, 2);

    // Stale expectedVersion must not create another pack.
    await assert.rejects(
      () =>
        createTablesWithOpaqueQr({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version - 1,
          branchId: branchMeta.branchId!,
          count: 2,
          prefix: "Masa",
          seats: 4,
        }),
      (err: unknown) =>
        (err instanceof ActivationWizardError && err.code === "VERSION_CONFLICT") ||
        (err instanceof ActivationJourneyError && err.code === "VERSION_CONFLICT"),
    );

    const tableCountAfterStale = await prisma.restaurantTable.count({
      where: { branchId: branchMeta.branchId },
    });
    assert.equal(tableCountAfterStale, 2);

    const recovered = await recoverWizardTableQrPack({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
    });
    version = recovered.journeyVersion;
    assert.equal(recovered.qrs.length, 2);
    assert.equal(
      await prisma.restaurantTable.count({ where: { branchId: branchMeta.branchId } }),
      2,
    );
    // Old plaintexts from first pack must no longer resolve as ACTIVE.
    for (const old of pack.qrs) {
      const active = await prisma.tableQrToken.findFirst({
        where: {
          tableId: old.tableId,
          status: "ACTIVE",
          tokenPrefix: old.tokenPrefix,
        },
      });
      assert.equal(active, null);
    }

    await acknowledgeTableQrPack({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId: branchMeta.branchId!,
    });
    const journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.equal(journey.currentStep, ActivationStepKey.STAFF_INVITE);
  });

  it("cross-tenant branch id is rejected", async () => {
    // Reset a fresh journey on org B at BRANCH_SETUP for this check.
    const foreignBranch = await prisma.branch.findFirst({
      where: { restaurant: { organizationId: orgId } },
    });
    assert.ok(foreignBranch);

    const journeyB = await prisma.activationJourney.create({
      data: {
        organizationId: orgBId,
        productId,
        status: ActivationJourneyStatus.IN_PROGRESS,
        source: ActivationJourneySource.SELF_SERVE,
        currentStep: ActivationStepKey.TABLE_SETUP,
        version: 1,
        steps: {
          create: Object.values(ActivationStepKey).map((stepKey) => ({
            stepKey,
            status:
              stepKey === ActivationStepKey.TABLE_SETUP
                ? ActivationJourneyStepStatus.PENDING
                : ActivationJourneyStepStatus.COMPLETED,
          })),
        },
      },
    });

    const ownerB = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgBId, role: "OWNER" },
    });

    await assert.rejects(
      () =>
        createTablesWithOpaqueQr({
          organizationId: orgBId,
          actorUserId: ownerB.userId,
          expectedVersion: 1,
          branchId: foreignBranch!.id,
          count: 1,
          prefix: "X",
          seats: 2,
        }),
      (err: unknown) => err instanceof ActivationWizardError && err.code === "CROSS_TENANT",
    );

    await prisma.activationJourneyStep.deleteMany({ where: { journeyId: journeyB.id } });
    await prisma.activationJourney.delete({ where: { id: journeyB.id } });
  });

  it("completed BUSINESS_PROFILE replay does not mutate Organization or add audit", async () => {
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const auditBefore = await prisma.auditLog.count({
      where: { organizationId: orgId, action: "activation.business_profile.saved" },
    });
    const journeyNow = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.notEqual(journeyNow.currentStep, ActivationStepKey.BUSINESS_PROFILE);

    await assert.rejects(
      () =>
        saveBusinessProfileStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: journeyNow.version,
          name: "REPLAY SHOULD NOT APPLY",
        }),
      (err: unknown) =>
        (err instanceof ActivationJourneyError && err.code === "OUT_OF_ORDER") ||
        (err instanceof ActivationWizardError && err.code === "OUT_OF_ORDER"),
    );

    const after = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    assert.equal(after.name, before.name);
    assert.equal(
      await prisma.auditLog.count({
        where: { organizationId: orgId, action: "activation.business_profile.saved" },
      }),
      auditBefore,
    );
    const journeyAfter = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.equal(journeyAfter.currentStep, journeyNow.currentStep);
    assert.equal(journeyAfter.version, journeyNow.version);
  });

  it("completed BRANCH_SETUP replay does not create or rename restaurant/branch", async () => {
    const journeyNow = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    const restaurantsBefore = await prisma.restaurant.count({ where: { organizationId: orgId } });
    const branchesBefore = await prisma.branch.count({
      where: { restaurant: { organizationId: orgId } },
    });
    const existingBranch = await prisma.branch.findFirstOrThrow({
      where: { restaurant: { organizationId: orgId } },
    });

    await assert.rejects(
      () =>
        saveBranchSetupStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: journeyNow.version,
          restaurantName: "Replay Rest",
          branchName: "Replay Branch",
          branchAddress: "Replay Address 99",
          existingBranchId: existingBranch.id,
        }),
      (err: unknown) =>
        (err instanceof ActivationJourneyError && err.code === "OUT_OF_ORDER") ||
        (err instanceof ActivationWizardError && err.code === "OUT_OF_ORDER"),
    );

    assert.equal(
      await prisma.restaurant.count({ where: { organizationId: orgId } }),
      restaurantsBefore,
    );
    assert.equal(
      await prisma.branch.count({ where: { restaurant: { organizationId: orgId } } }),
      branchesBefore,
    );
    const branchAfter = await prisma.branch.findUniqueOrThrow({ where: { id: existingBranch.id } });
    assert.equal(branchAfter.name, existingBranch.name);
    assert.equal(branchAfter.address, existingBranch.address);
  });

  it("demoted STAFF actor cannot mutate wizard domain inside TX", async () => {
    const staff = await prisma.user.create({
      data: {
        email: `staff-actor-${suffix}@example.com`,
        name: "Staff Actor",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: staff.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });

    const journeyNow = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    const orgBefore = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const auditBefore = await prisma.auditLog.count({ where: { organizationId: orgId } });

    await assert.rejects(
      () =>
        completeStaffInviteWizardStep({
          organizationId: orgId,
          actorUserId: staff.id,
          expectedVersion: journeyNow.version,
          skip: true,
        }),
      (err: unknown) =>
        (err instanceof ActivationWizardError &&
          (err.code === "FORBIDDEN" || err.code === "ACTOR_INACTIVE")) ||
        (err instanceof ActivationJourneyError && err.code === "FORBIDDEN"),
    );

    const orgAfter = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    assert.equal(orgAfter.name, orgBefore.name);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: orgId } }), auditBefore);
    const journeyAfter = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.equal(journeyAfter.version, journeyNow.version);
    assert.equal(journeyAfter.currentStep, journeyNow.currentStep);

    await prisma.membership.deleteMany({ where: { userId: staff.id } });
    await prisma.user.delete({ where: { id: staff.id } });
  });

  it("STAFF_INVITE: active staff completes; owner-only skip; staff_limit=-1 does not auto-skip", async () => {
    const journeyNow = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.equal(journeyNow.currentStep, ActivationStepKey.STAFF_INVITE);

    const staffEnt = await prisma.entitlement.findFirstOrThrow({
      where: { planId, key: "staff_limit" },
    });
    const previousStaffLimit = staffEnt.valueInt;
    await prisma.entitlement.update({
      where: { id: staffEnt.id },
      data: { valueInt: -1 },
    });

    // Unlimited capacity alone must NOT complete or skip without an explicit decision.
    await assert.rejects(
      () =>
        completeStaffInviteWizardStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: journeyNow.version,
          skip: false,
        }),
      (err: unknown) => err instanceof ActivationWizardError && err.code === "NO_INVITES",
    );

    const skipped = await completeStaffInviteWizardStep({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: journeyNow.version,
      skip: true,
    });
    assert.equal(skipped.currentStep, ActivationStepKey.MENU_IMPORT);
    const skippedStep = skipped.steps.find((s) => s.stepKey === ActivationStepKey.STAFF_INVITE);
    assert.equal(skippedStep?.status, ActivationJourneyStepStatus.SKIPPED);
    assert.equal(
      (skippedStep?.safeMetadataJson as { reason?: string } | null)?.reason,
      "OWNER_ONLY",
    );

    await prisma.entitlement.update({
      where: { id: staffEnt.id },
      data: { valueInt: previousStaffLimit },
    });

    // Reset step for COMPLETED-via-staff path
    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: { currentStep: ActivationStepKey.STAFF_INVITE, version: skipped.version },
    });
    await prisma.activationJourneyStep.update({
      where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.STAFF_INVITE } },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null, safeMetadataJson: {} },
    });

    const staffUser = await prisma.user.create({
      data: {
        email: `active-staff-${suffix}@example.com`,
        name: "Active Staff",
        passwordHash: await hashPassword("Password1!"),
        passwordSetAt: new Date(),
        isActive: true,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: staffUser.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });

    const j2 = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    const completed = await completeStaffInviteWizardStep({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: j2.version,
      skip: false,
    });
    assert.equal(completed.currentStep, ActivationStepKey.MENU_IMPORT);
    assert.equal(
      completed.steps.find((s) => s.stepKey === ActivationStepKey.STAFF_INVITE)?.status,
      ActivationJourneyStepStatus.COMPLETED,
    );

    // Explicit skip with active staff must fail
    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: { currentStep: ActivationStepKey.STAFF_INVITE, version: completed.version },
    });
    await prisma.activationJourneyStep.update({
      where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.STAFF_INVITE } },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null },
    });
    const j3 = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    await assert.rejects(
      () =>
        completeStaffInviteWizardStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: j3.version,
          skip: true,
        }),
      (err: unknown) => err instanceof ActivationWizardError && err.code === "SKIP_FORBIDDEN",
    );

    await prisma.membership.deleteMany({ where: { userId: staffUser.id } });
    await prisma.user.delete({ where: { id: staffUser.id } });
  });

  it("FAILED and PENDING invites do not qualify STAFF_INVITE completion", async () => {
    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: { currentStep: ActivationStepKey.STAFF_INVITE },
    });
    await prisma.activationJourneyStep.update({
      where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.STAFF_INVITE } },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null },
    });
    // Remove non-owner staff so only invites could qualify
    await prisma.membership.deleteMany({
      where: { organizationId: orgId, role: { not: MembershipRole.OWNER } },
    });
    await prisma.staffInvite.deleteMany({ where: { organizationId: orgId } });

    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `failed-only-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: `hash-failed-${suffix}`,
        tokenPrefix: "failprefix",
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
        deliveryStatus: "FAILED",
        lastDeliveryErrorCode: "TEST",
      },
    });
    await prisma.staffInvite.create({
      data: {
        organizationId: orgId,
        email: `pending-only-${suffix}@example.com`,
        role: MembershipRole.STAFF,
        tokenHash: `hash-pending-${suffix}`,
        tokenPrefix: "pendprefix",
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: ownerId,
        deliveryStatus: "PENDING",
      },
    });

    const j = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    await assert.rejects(
      () =>
        completeStaffInviteWizardStep({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: j.version,
          skip: false,
        }),
      (err: unknown) => err instanceof ActivationWizardError && err.code === "NO_INVITES",
    );
  });

  it("staff_limit=0 rejects invite create but allows owner-only skip", async () => {
    const { createStaffInvite, StaffInviteError } = await import("@/lib/wexpay-staff-invite");
    const staffEnt = await prisma.entitlement.findFirstOrThrow({
      where: { planId, key: "staff_limit" },
    });
    const previousStaffLimit = staffEnt.valueInt;
    await prisma.entitlement.update({
      where: { id: staffEnt.id },
      data: { valueInt: 0 },
    });

    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: { currentStep: ActivationStepKey.STAFF_INVITE },
    });
    await prisma.activationJourneyStep.update({
      where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.STAFF_INVITE } },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null },
    });
    await prisma.membership.deleteMany({
      where: { organizationId: orgId, role: { not: MembershipRole.OWNER } },
    });
    await prisma.staffInvite.deleteMany({ where: { organizationId: orgId } });

    await assert.rejects(
      () =>
        createStaffInvite({
          organizationId: orgId,
          actorUserId: ownerId,
          email: `zero-limit-${suffix}@example.com`,
          role: MembershipRole.STAFF,
        }),
      (err: unknown) => err instanceof StaffInviteError && err.code === "STAFF_LIMIT",
    );

    const j = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    const skipped = await completeStaffInviteWizardStep({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: j.version,
      skip: true,
    });
    assert.equal(
      skipped.steps.find((s) => s.stepKey === ActivationStepKey.STAFF_INVITE)?.status,
      ActivationJourneyStepStatus.SKIPPED,
    );
    assert.equal(
      (
        skipped.steps.find((s) => s.stepKey === ActivationStepKey.STAFF_INVITE)
          ?.safeMetadataJson as { reason?: string } | null
      )?.reason,
      "OWNER_ONLY",
    );

    await prisma.entitlement.update({
      where: { id: staffEnt.id },
      data: { valueInt: previousStaffLimit },
    });
  });
});
