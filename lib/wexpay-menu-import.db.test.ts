import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationStepKey,
  ActivationJourneyStepStatus,
  MenuImportJobStatus,
  MembershipRole,
  MembershipStatus,
} from ".prisma/client";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import { prisma } from "@/lib/prisma";
import { EXPECTED_PUBLIC_TABLE_COUNT } from "@/lib/wexon-db-backup-guards";
import { ActivationJourneyError } from "@/lib/wexpay-activation-journey";
import {
  MenuImportError,
  applyMenuImportUntilDone,
  cancelMenuImportJob,
  skipMenuImportEmptyStart,
  uploadAndDryRunMenuImport,
} from "@/lib/wexpay-menu-import";
import { hashPassword } from "@/lib/wexon-passwords";

assertLocalDbTestGuard(process.env);

const suffix = randomUUID().slice(0, 8);

function tinyCsv(rows: string[]): Buffer {
  const header = "category,product_name,price";
  return Buffer.from(`${header}\n${rows.join("\n")}\n`, "utf8");
}

describe("menu import security (db)", () => {
  let orgId = "";
  let orgBId = "";
  let ownerId = "";
  let productId = "";
  let planId = "";
  let journeyId = "";
  let version = 1;
  let branchId = "";
  let branchBId = "";
  let productLimitEntId = "";
  let previousProductLimit: number | null = null;

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
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
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

  async function seedBranch(organizationId: string, label: string) {
    const restaurant = await prisma.restaurant.create({
      data: {
        organizationId,
        name: `Rest ${label} ${suffix}`,
        slug: `rest-${label.toLowerCase()}-${suffix}`,
        isActive: true,
      },
    });
    const branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: `Branch ${label}`,
        slug: `branch-${label.toLowerCase()}-${suffix}`,
        address: "Addr 1",
        isActive: true,
      },
    });
    return branch.id;
  }

  async function resetJourneyToMenuImport() {
    await prisma.menuImportRowError.deleteMany({
      where: { job: { organizationId: orgId } },
    });
    await prisma.menuImportJob.deleteMany({ where: { organizationId: orgId } });
    await prisma.menuProductModifierGroup.deleteMany({
      where: { product: { branch: { restaurant: { organizationId: orgId } } } },
    });
    await prisma.menuModifierOption.deleteMany({
      where: { group: { branch: { restaurant: { organizationId: orgId } } } },
    });
    await prisma.menuModifierGroup.deleteMany({
      where: { branch: { restaurant: { organizationId: orgId } } },
    });
    await prisma.menuProduct.deleteMany({
      where: { branch: { restaurant: { organizationId: orgId } } },
    });
    await prisma.menuCategory.deleteMany({
      where: { branch: { restaurant: { organizationId: orgId } } },
    });

    const journey = await prisma.activationJourney.update({
      data: {
        status: ActivationJourneyStatus.IN_PROGRESS,
        currentStep: ActivationStepKey.MENU_IMPORT,
        version: { increment: 1 },
      },
      where: { id: journeyId },
    });
    version = journey.version;

    for (const stepKey of Object.values(ActivationStepKey)) {
      const status =
        stepKey === ActivationStepKey.MENU_IMPORT ||
        stepKey === ActivationStepKey.PAYMENT_PROVIDER ||
        stepKey === ActivationStepKey.VALIDATION ||
        stepKey === ActivationStepKey.GO_LIVE
          ? ActivationJourneyStepStatus.PENDING
          : ActivationJourneyStepStatus.COMPLETED;
      await prisma.activationJourneyStep.update({
        where: { journeyId_stepKey: { journeyId, stepKey } },
        data: {
          status,
          completedAt: status === ActivationJourneyStepStatus.COMPLETED ? new Date() : null,
          safeMetadataJson:
            stepKey === ActivationStepKey.BRANCH_SETUP
              ? { branchId, restaurantId: undefined }
              : {},
        },
      });
    }

    // Ensure BRANCH_SETUP metadata has branchId for assertBranchInOrgJourney.
    await prisma.activationJourneyStep.update({
      where: {
        journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.BRANCH_SETUP },
      },
      data: {
        status: ActivationJourneyStepStatus.COMPLETED,
        safeMetadataJson: { branchId },
      },
    });
  }

  before(async () => {
    const product = await prisma.product.findFirst({ where: { key: "wexpay", isActive: true } });
    assert.ok(product);
    productId = product!.id;
    const plan = await prisma.plan.findFirst({ where: { productId, isActive: true } });
    assert.ok(plan);
    planId = plan!.id;

    for (const key of ["branch_limit", "table_limit", "staff_limit", "product_limit"]) {
      const existing = await prisma.entitlement.findFirst({ where: { planId, key } });
      if (!existing) {
        const created = await prisma.entitlement.create({
          data: { planId, key, valueType: "INTEGER", valueInt: 50, isActive: true },
        });
        if (key === "product_limit") {
          productLimitEntId = created.id;
          previousProductLimit = 50;
        }
      } else {
        if (key === "product_limit") {
          productLimitEntId = existing.id;
          previousProductLimit = existing.valueInt;
          if (existing.valueInt !== null && existing.valueInt >= 0 && existing.valueInt < 5) {
            await prisma.entitlement.update({
              where: { id: existing.id },
              data: { valueInt: 50 },
            });
            previousProductLimit = 50;
          }
        } else if (existing.valueInt !== null && existing.valueInt >= 0 && existing.valueInt < 5) {
          await prisma.entitlement.update({
            where: { id: existing.id },
            data: { valueInt: 50 },
          });
        }
      }
    }

    const a = await seedOrg("MenuA");
    orgId = a.orgId;
    ownerId = a.userId;
    const b = await seedOrg("MenuB");
    orgBId = b.orgId;

    branchId = await seedBranch(orgId, "A");
    branchBId = await seedBranch(orgBId, "B");

    const journey = await prisma.activationJourney.create({
      data: {
        organizationId: orgId,
        productId,
        status: ActivationJourneyStatus.IN_PROGRESS,
        source: ActivationJourneySource.SELF_SERVE,
        currentStep: ActivationStepKey.MENU_IMPORT,
        version: 1,
        steps: {
          create: Object.values(ActivationStepKey).map((stepKey) => ({
            stepKey,
            status:
              stepKey === ActivationStepKey.MENU_IMPORT ||
              stepKey === ActivationStepKey.PAYMENT_PROVIDER ||
              stepKey === ActivationStepKey.VALIDATION ||
              stepKey === ActivationStepKey.GO_LIVE
                ? ActivationJourneyStepStatus.PENDING
                : ActivationJourneyStepStatus.COMPLETED,
            safeMetadataJson:
              stepKey === ActivationStepKey.BRANCH_SETUP ? { branchId } : undefined,
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

    if (productLimitEntId && previousProductLimit != null) {
      await prisma.entitlement
        .update({ where: { id: productLimitEntId }, data: { valueInt: previousProductLimit } })
        .catch(() => undefined);
    }

    await prisma.menuImportRowError.deleteMany({
      where: { job: { organizationId: { in: orgIds } } },
    });
    await prisma.menuImportJob.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.menuProductModifierGroup.deleteMany({
      where: { product: { branch: { restaurant: { organizationId: { in: orgIds } } } } },
    });
    await prisma.menuModifierOption.deleteMany({
      where: { group: { branch: { restaurant: { organizationId: { in: orgIds } } } } },
    });
    await prisma.menuModifierGroup.deleteMany({
      where: { branch: { restaurant: { organizationId: { in: orgIds } } } },
    });
    await prisma.menuProduct.deleteMany({
      where: { branch: { restaurant: { organizationId: { in: orgIds } } } },
    });
    await prisma.menuCategory.deleteMany({
      where: { branch: { restaurant: { organizationId: { in: orgIds } } } },
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
      where: { email: { in: [`menua-${suffix}@example.com`, `menub-${suffix}@example.com`] } },
    });
  });

  it("dry-run does not create MenuProduct", async () => {
    await resetJourneyToMenuImport();
    const before = await prisma.menuProduct.count({ where: { branchId } });
    const job = await uploadAndDryRunMenuImport({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId,
      buffer: tinyCsv(["Icecek,Cay,45.00"]),
      originalFileName: "menu.csv",
    });
    assert.equal(job.status, MenuImportJobStatus.DRY_RUN);
    assert.equal(job.validRows, 1);
    assert.equal(await prisma.menuProduct.count({ where: { branchId } }), before);
  });

  it("apply success creates products and advances journey", async () => {
    await resetJourneyToMenuImport();
    const dry = await uploadAndDryRunMenuImport({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId,
      buffer: tinyCsv(["Icecek,Cay,45.00", "Ana Yemek,Adana,320.50"]),
      originalFileName: "apply.csv",
    });
    const applied = await applyMenuImportUntilDone({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      jobId: dry.id,
      jobExpectedVersion: dry.version,
      confirmApply: true,
    });
    assert.equal(applied.job.status, MenuImportJobStatus.APPLIED);
    assert.equal(await prisma.menuProduct.count({ where: { branchId } }), 2);
    const journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    assert.equal(journey.currentStep, ActivationStepKey.PAYMENT_PROVIDER);
    version = journey.version;
  });

  it("duplicate product update is idempotent on reimport", async () => {
    await resetJourneyToMenuImport();
    const csv = tinyCsv(["Icecek,Cay,45.00"]);
    const firstDry = await uploadAndDryRunMenuImport({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId,
      buffer: csv,
      originalFileName: "dup.csv",
    });
    await applyMenuImportUntilDone({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      jobId: firstDry.id,
      jobExpectedVersion: firstDry.version,
      confirmApply: true,
    });
    const journeyAfter = await prisma.activationJourney.findUniqueOrThrow({
      where: { id: journeyId },
    });
    version = journeyAfter.version;

    // Move back to MENU_IMPORT for reimport path.
    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: {
        currentStep: ActivationStepKey.MENU_IMPORT,
        version: { increment: 1 },
        status: ActivationJourneyStatus.IN_PROGRESS,
      },
    });
    await prisma.activationJourneyStep.update({
      where: { journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.MENU_IMPORT } },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null },
    });
    await prisma.activationJourneyStep.update({
      where: {
        journeyId_stepKey: { journeyId, stepKey: ActivationStepKey.PAYMENT_PROVIDER },
      },
      data: { status: ActivationJourneyStepStatus.PENDING, completedAt: null },
    });
    const j = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    version = j.version;

    const updatedCsv = tinyCsv(["Icecek,Cay,55.00"]);
    const secondDry = await uploadAndDryRunMenuImport({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId,
      buffer: updatedCsv,
      originalFileName: "dup2.csv",
      forceReimport: true,
    });
    assert.equal(secondDry.preview?.productsToUpdate, 1);
    assert.equal(secondDry.preview?.productsToCreate, 0);

    await applyMenuImportUntilDone({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      jobId: secondDry.id,
      jobExpectedVersion: secondDry.version,
      confirmApply: true,
      forceReimport: true,
    });

    assert.equal(await prisma.menuProduct.count({ where: { branchId } }), 1);
    const product = await prisma.menuProduct.findFirstOrThrow({ where: { branchId, name: "Cay" } });
    assert.equal(Number(product.price), 55);
    const journey = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    version = journey.version;
  });

  it("product_limit blocks apply when exceeded", async () => {
    await resetJourneyToMenuImport();
    assert.ok(productLimitEntId);
    await prisma.entitlement.update({
      where: { id: productLimitEntId },
      data: { valueInt: 0 },
    });

    try {
      const dry = await uploadAndDryRunMenuImport({
        organizationId: orgId,
        actorUserId: ownerId,
        expectedVersion: version,
        branchId,
        buffer: tinyCsv(["Icecek,Cay,45.00"]),
        originalFileName: "limit.csv",
      });
      assert.equal(dry.preview?.wouldExceedLimit, true);

      await assert.rejects(
        () =>
          applyMenuImportUntilDone({
            organizationId: orgId,
            actorUserId: ownerId,
            expectedVersion: version,
            jobId: dry.id,
            jobExpectedVersion: dry.version,
            confirmApply: true,
          }),
        (err: unknown) =>
          (err instanceof MenuImportError && err.code === "LIMIT") ||
          (err instanceof ActivationJourneyError && err.code === "LIMIT"),
      );
      assert.equal(await prisma.menuProduct.count({ where: { branchId } }), 0);
    } finally {
      await prisma.entitlement.update({
        where: { id: productLimitEntId },
        data: { valueInt: previousProductLimit ?? 50 },
      });
    }
  });

  it("cancel marks job CANCELLED and blocks apply", async () => {
    await resetJourneyToMenuImport();
    const dry = await uploadAndDryRunMenuImport({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      branchId,
      buffer: tinyCsv(["Icecek,Cay,45.00"]),
      originalFileName: "cancel.csv",
    });
    const cancelled = await cancelMenuImportJob({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      jobId: dry.id,
      jobExpectedVersion: dry.version,
    });
    assert.equal(cancelled.status, MenuImportJobStatus.CANCELLED);

    await assert.rejects(
      () =>
        applyMenuImportUntilDone({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version,
          jobId: dry.id,
          jobExpectedVersion: cancelled.version,
          confirmApply: true,
        }),
      (err: unknown) => err instanceof MenuImportError && err.code === "JOB_CANCELLED",
    );
  });

  it("empty skip advances with explicit confirmation", async () => {
    await resetJourneyToMenuImport();
    await assert.rejects(
      () =>
        skipMenuImportEmptyStart({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version,
          confirmEmpty: false,
        }),
      (err: unknown) => err instanceof MenuImportError && err.code === "CONFIRM_REQUIRED",
    );

    const skipped = await skipMenuImportEmptyStart({
      organizationId: orgId,
      actorUserId: ownerId,
      expectedVersion: version,
      confirmEmpty: true,
    });
    assert.equal(skipped.currentStep, ActivationStepKey.PAYMENT_PROVIDER);
    const step = skipped.steps.find((s) => s.stepKey === ActivationStepKey.MENU_IMPORT);
    assert.equal(step?.status, ActivationJourneyStepStatus.SKIPPED);
    version = skipped.version;
  });

  it("stale journey version is rejected", async () => {
    await resetJourneyToMenuImport();
    await assert.rejects(
      () =>
        uploadAndDryRunMenuImport({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version + 99,
          branchId,
          buffer: tinyCsv(["Icecek,Cay,45.00"]),
          originalFileName: "stale.csv",
        }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "VERSION_CONFLICT",
    );
  });

  it("out-of-order step is rejected", async () => {
    await resetJourneyToMenuImport();
    await prisma.activationJourney.update({
      where: { id: journeyId },
      data: { currentStep: ActivationStepKey.BUSINESS_PROFILE, version: { increment: 1 } },
    });
    const j = await prisma.activationJourney.findUniqueOrThrow({ where: { id: journeyId } });
    version = j.version;

    await assert.rejects(
      () =>
        uploadAndDryRunMenuImport({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version,
          branchId,
          buffer: tinyCsv(["Icecek,Cay,45.00"]),
          originalFileName: "ooo.csv",
        }),
      (err: unknown) => err instanceof ActivationJourneyError && err.code === "OUT_OF_ORDER",
    );

    await resetJourneyToMenuImport();
  });

  it("cross-tenant branch is rejected", async () => {
    await resetJourneyToMenuImport();
    await assert.rejects(
      () =>
        uploadAndDryRunMenuImport({
          organizationId: orgId,
          actorUserId: ownerId,
          expectedVersion: version,
          branchId: branchBId,
          buffer: tinyCsv(["Icecek,Cay,45.00"]),
          originalFileName: "xtenant.csv",
        }),
      (err: unknown) => err instanceof MenuImportError && err.code === "CROSS_TENANT",
    );
  });

  it("public schema has 40 tables and MenuImport RLS enabled", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string; rls: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    assert.equal(tables.length, EXPECTED_PUBLIC_TABLE_COUNT);
    assert.equal(EXPECTED_PUBLIC_TABLE_COUNT, 40);
    for (const name of ["MenuImportJob", "MenuImportRowError"]) {
      const row = tables.find((t) => t.table_name === name);
      assert.ok(row, `${name} must exist`);
      assert.equal(row!.rls, true);
    }
  });
});
