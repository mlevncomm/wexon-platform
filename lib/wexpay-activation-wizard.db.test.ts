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
  createTablesWithOpaqueQr,
  recoverWizardTableQrPack,
  saveBranchSetupStep,
  saveBusinessProfileStep,
} from "@/lib/wexpay-activation-wizard";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import { assertEntitlementLimit } from "@/lib/wexon-core-access";
import { hashPassword } from "@/lib/wexon-passwords";

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
});
