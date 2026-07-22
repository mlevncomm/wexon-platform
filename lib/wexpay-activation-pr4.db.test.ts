import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  ActivationJourneySource,
  ActivationJourneyStatus,
  ActivationJourneyStepStatus,
  ActivationStepKey,
  MembershipRole,
  MembershipStatus,
  WexPayProviderCredentialMode,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { assertLocalDbTestGuard } from "@/lib/wexon-local-db-test-guard";
import {
  adminAssistedWexPayGoLive,
  blockWexPayActivationAsAdmin,
  unblockWexPayActivationAsAdmin,
} from "@/lib/wexpay-activation-admin";
import {
  goLiveWexPayActivation,
} from "@/lib/wexpay-activation-go-live";
import {
  ACTIVATION_STEP_ORDER,
  ActivationJourneyError,
  assertWexPayPublicLiveReady,
} from "@/lib/wexpay-activation-journey";
import {
  saveActivationPaymentProviderStep,
} from "@/lib/wexpay-activation-payment-provider";
import { ActivationTxAccessError } from "@/lib/wexpay-activation-tx-access";
import {
  runWexPayActivationValidation,
  validateWexPayActivationInTx,
  type ActivationValidationReport,
} from "@/lib/wexpay-activation-validation";
import {
  decryptProviderConfig,
  upsertWexPayProviderCredential,
  type WexPayProviderCredentialSummary,
} from "@/lib/wexpay-provider-credentials";
import {
  createPublicCheckoutPayment,
  WexPayPublicCheckoutUnavailableError,
} from "@/lib/wexpay-public-checkout";
import { resolveWexPayPublicPaymentAvailability } from "@/lib/wexpay-public-payment-availability";

assertLocalDbTestGuard(process.env);

const suiteSuffix = randomUUID().replaceAll("-", "").slice(0, 12);
const validationEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  VERCEL_ENV: "development",
  WEXPAY_PAYTR_ENABLE_API: "false",
  WEXON_EMAIL_PROVIDER: "fake",
};

type FixtureOptions = {
  currentStep?: ActivationStepKey;
  menuSkipped?: boolean;
  menuActive?: boolean;
};

type CleanupRecord = {
  organizationId: string;
  userIds: string[];
};

type Fixture = Awaited<ReturnType<typeof createFixture>>;

const cleanupRecords = new Map<string, CleanupRecord>();
let productId = "";
let planId = "";
let originalPaytrApiFlag: string | undefined;
let originalAppUrl: string | undefined;

function metadataForStep(
  stepKey: ActivationStepKey,
  refs: {
    restaurantId: string;
    branchId: string;
    tableId: string;
  },
) {
  switch (stepKey) {
    case ActivationStepKey.BRANCH_SETUP:
      return { restaurantId: refs.restaurantId, branchId: refs.branchId };
    case ActivationStepKey.TABLE_SETUP:
      return {
        branchId: refs.branchId,
        tableIds: [refs.tableId],
        qrAck: true,
        awaitingQrAck: false,
      };
    case ActivationStepKey.STAFF_INVITE:
      return { reason: "OWNER_ONLY" };
    case ActivationStepKey.MENU_IMPORT:
      return { branchId: refs.branchId, explicitSkip: true };
    case ActivationStepKey.PAYMENT_PROVIDER:
      return {
        provider: "MANUAL",
        acknowledged: true,
        onlinePaymentReady: false,
      };
    case ActivationStepKey.VALIDATION:
      return {
        result: "PASS",
        passCount: 1,
        warningCount: 0,
        failCount: 0,
        checks: [],
      };
    default:
      return {};
  }
}

async function createFixture(options: FixtureOptions = {}) {
  const marker = randomUUID().replaceAll("-", "").slice(0, 12);
  const currentStep = options.currentStep ?? ActivationStepKey.VALIDATION;
  const menuSkipped = options.menuSkipped ?? true;
  const currentIndex = ACTIVATION_STEP_ORDER.indexOf(currentStep);

  const organization = await prisma.organization.create({
    data: {
      name: `PR4 ${marker}`,
      slug: `pr4-${suiteSuffix}-${marker}`,
      legalName: `PR4 Legal ${marker}`,
      taxNo: `TX${marker}`,
      isActive: true,
      isDemo: false,
    },
  });
  const cleanup: CleanupRecord = { organizationId: organization.id, userIds: [] };
  cleanupRecords.set(organization.id, cleanup);

  const users = await Promise.all(
    [
      ["owner", MembershipRole.OWNER],
      ["admin", MembershipRole.ADMIN],
      ["manager", MembershipRole.MANAGER],
    ].map(async ([label, role]) => {
      const user = await prisma.user.create({
        data: {
          email: `pr4-${label}-${suiteSuffix}-${marker}@example.test`,
          name: `PR4 ${label}`,
          isActive: true,
          passwordHash: "db-test-only",
          passwordSetAt: new Date(),
        },
      });
      cleanup.userIds.push(user.id);
      await prisma.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: role as MembershipRole,
          status: MembershipStatus.ACTIVE,
          acceptedAt: new Date(),
        },
      });
      return { label, id: user.id };
    }),
  );
  const userId = (label: string) => users.find((user) => user.label === label)!.id;

  const license = await prisma.license.create({
    data: {
      organizationId: organization.id,
      productId,
      planId,
      status: "ACTIVE",
      licenseType: "MONTHLY",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  const subscription = await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      licenseId: license.id,
      planId,
      status: "ACTIVE",
      interval: "MONTHLY",
      currentPeriodStart: new Date(Date.now() - 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  const installation = await prisma.appInstallation.create({
    data: {
      organizationId: organization.id,
      productId,
      licenseId: license.id,
      status: "ACTIVE",
    },
  });
  const fee = await prisma.activationFeeLedger.create({
    data: {
      organizationId: organization.id,
      productId,
      planId,
      status: "PAID",
      activationFeeMinor: 0,
      paidAt: new Date(),
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: `PR4 Restaurant ${marker}`,
      slug: `pr4-r-${suiteSuffix}-${marker}`,
    },
  });
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: "Main",
      slug: `pr4-b-${marker}`,
      address: "Local DB test",
    },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      branchId: branch.id,
      label: "T1",
      seats: 4,
      qrCode: `PR4-QR-${suiteSuffix}-${marker}`,
    },
  });
  const token = await prisma.tableQrToken.create({
    data: {
      tableId: table.id,
      tokenHash: `pr4-token-hash-${suiteSuffix}-${marker}`,
      tokenPrefix: marker.slice(0, 8),
      status: "ACTIVE",
    },
  });
  const category = await prisma.menuCategory.create({
    data: { branchId: branch.id, name: `PR4 Category ${marker}` },
  });
  const menuProduct = await prisma.menuProduct.create({
    data: {
      branchId: branch.id,
      categoryId: category.id,
      name: `PR4 Item ${marker}`,
      price: 10,
      isActive: options.menuActive ?? true,
    },
  });

  const refs = {
    restaurantId: restaurant.id,
    branchId: branch.id,
    tableId: table.id,
  };
  const journey = await prisma.activationJourney.create({
    data: {
      organizationId: organization.id,
      productId,
      source: ActivationJourneySource.SELF_SERVE,
      status:
        currentStep === ActivationStepKey.GO_LIVE
          ? ActivationJourneyStatus.READY
          : ActivationJourneyStatus.IN_PROGRESS,
      currentStep,
      version: 1,
      steps: {
        create: ACTIVATION_STEP_ORDER.map((stepKey, index) => {
          let status: ActivationJourneyStepStatus =
            index < currentIndex
              ? ActivationJourneyStepStatus.COMPLETED
              : ActivationJourneyStepStatus.PENDING;
          if (
            index < currentIndex &&
            (stepKey === ActivationStepKey.STAFF_INVITE ||
              (stepKey === ActivationStepKey.MENU_IMPORT && menuSkipped))
          ) {
            status = ActivationJourneyStepStatus.SKIPPED;
          }
          return {
            stepKey,
            status,
            attemptCount: status === ActivationJourneyStepStatus.PENDING ? 0 : 1,
            completedAt: status === ActivationJourneyStepStatus.PENDING ? null : new Date(),
            safeMetadataJson: metadataForStep(stepKey, refs),
          };
        }),
      },
    },
  });

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    ownerId: userId("owner"),
    adminId: userId("admin"),
    managerId: userId("manager"),
    licenseId: license.id,
    subscriptionId: subscription.id,
    installationId: installation.id,
    feeId: fee.id,
    restaurantId: restaurant.id,
    branchId: branch.id,
    tableId: table.id,
    tokenId: token.id,
    menuProductId: menuProduct.id,
    journeyId: journey.id,
  };
}

async function cleanupFixture(fixture: Fixture | CleanupRecord) {
  const record = cleanupRecords.get(fixture.organizationId);
  if (!record) return;
  await prisma.auditLog.deleteMany({ where: { organizationId: record.organizationId } });
  await prisma.restaurant.deleteMany({ where: { organizationId: record.organizationId } });
  await prisma.organization.deleteMany({ where: { id: record.organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: record.userIds } } });
  cleanupRecords.delete(record.organizationId);
}

async function usingFixture<T>(
  options: FixtureOptions,
  run: (fixture: Fixture) => Promise<T>,
): Promise<T> {
  const fixture = await createFixture(options);
  try {
    return await run(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
}

function paytrInput() {
  const marker = randomUUID().replaceAll("-", "");
  return {
    provider: "PAYTR" as const,
    mode: WexPayProviderCredentialMode.TEST,
    merchantId: `merchant-${marker}`,
    merchantKey: `key-${marker}`,
    merchantSalt: `salt-${marker}`,
  };
}

async function createPaytrCredential(
  fixture: Fixture,
  mode: WexPayProviderCredentialMode = WexPayProviderCredentialMode.TEST,
) {
  const input = { ...paytrInput(), mode };
  const summary = await upsertWexPayProviderCredential(
    { organizationId: fixture.organizationId, userId: fixture.ownerId },
    {
      provider: "paytr",
      displayName: "PayTR",
      mode,
      config: {
        merchantId: input.merchantId,
        merchantKey: input.merchantKey,
        merchantSalt: input.merchantSalt,
      },
      primarySecret: input.merchantKey,
      isActive: true,
    },
  );
  return { input, summary };
}

function paytrStepMetadata(summary: WexPayProviderCredentialSummary) {
  return {
    provider: "PAYTR",
    credentialId: summary.id,
    mode: summary.mode,
    keyFingerprint: summary.keyFingerprint,
    configCheckedAt: new Date().toISOString(),
    onlinePaymentApiEnabled: false,
  };
}

async function setPaymentMetadata(
  fixture: Fixture,
  metadata: ReturnType<typeof paytrStepMetadata>,
) {
  await prisma.activationJourneyStep.update({
    where: {
      journeyId_stepKey: {
        journeyId: fixture.journeyId,
        stepKey: ActivationStepKey.PAYMENT_PROVIDER,
      },
    },
    data: { safeMetadataJson: metadata },
  });
}

function assertCheck(
  report: ActivationValidationReport,
  key: string,
  status: "PASS" | "WARNING" | "FAIL",
) {
  assert.equal(report.checks.find((check) => check.key === key)?.status, status, key);
}

function assertNoPlaintext(value: unknown, plaintexts: string[]) {
  const serialized = JSON.stringify(value);
  assert.equal(plaintexts.some((plaintext) => serialized.includes(plaintext)), false);
}

function assertAuditMetadataKeys(
  metadata: unknown,
  allowedKeys: readonly string[],
) {
  assert.equal(metadata !== null && typeof metadata === "object" && !Array.isArray(metadata), true);
  const keys = Object.keys(metadata as Record<string, unknown>);
  assert.equal(keys.every((key) => allowedKeys.includes(key)), true);
}

function isCode(error: unknown, code: string) {
  return (
    (error instanceof ActivationJourneyError || error instanceof ActivationTxAccessError) &&
    error.code === code
  );
}

describe("WexPay activation PR-4 database contracts", { concurrency: false }, () => {
  before(async () => {
    originalPaytrApiFlag = process.env.WEXPAY_PAYTR_ENABLE_API;
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.WEXPAY_PAYTR_ENABLE_API = "false";
    process.env.NEXT_PUBLIC_APP_URL = validationEnv.NEXT_PUBLIC_APP_URL;

    const product = await prisma.product.findFirst({
      where: { key: "wexpay", isActive: true, status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(product, "Local seed must contain active wexpay product");
    productId = product.id;

    const plan = await prisma.plan.create({
      data: {
        productId,
        key: `pr4_db_${suiteSuffix}`,
        name: `PR4 DB ${suiteSuffix}`,
        billingInterval: "MONTHLY",
        tierKey: `pr4-${suiteSuffix}`,
        isPublic: false,
        isActive: true,
        entitlements: {
          create: {
            key: "feature_qr_payment",
            valueType: "BOOLEAN",
            valueBool: true,
            isActive: true,
          },
        },
      },
    });
    planId = plan.id;
  });

  after(async () => {
    for (const record of [...cleanupRecords.values()]) {
      await cleanupFixture(record);
    }
    if (planId) {
      await prisma.plan.deleteMany({ where: { id: planId } });
    }
    if (originalPaytrApiFlag === undefined) delete process.env.WEXPAY_PAYTR_ENABLE_API;
    else process.env.WEXPAY_PAYTR_ENABLE_API = originalPaytrApiFlag;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("rejects wrong-tenant and inactive selected credentials", async (t) => {
    await t.test("wrong tenant", async () => {
      const fixture = await createFixture({ currentStep: ActivationStepKey.VALIDATION });
      const foreign = await createFixture({ currentStep: ActivationStepKey.VALIDATION });
      try {
        const { summary } = await createPaytrCredential(foreign);
        await setPaymentMetadata(fixture, paytrStepMetadata(summary));
        const report = await validateWexPayActivationInTx(prisma, {
          organizationId: fixture.organizationId,
          journeyId: fixture.journeyId,
          env: validationEnv,
        });
        assertCheck(report, "SELECTED_CREDENTIAL_TENANT", "FAIL");
        assertCheck(report, "PROVIDER_CREDENTIAL_READY", "FAIL");
      } finally {
        await cleanupFixture(fixture);
        await cleanupFixture(foreign);
      }
    });

    await t.test("inactive credential", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.VALIDATION },
        async (fixture) => {
          const { summary } = await createPaytrCredential(fixture);
          await prisma.wexPayProviderCredential.update({
            where: { id: summary.id },
            data: { isActive: false },
          });
          await setPaymentMetadata(fixture, paytrStepMetadata(summary));
          const report = await validateWexPayActivationInTx(prisma, {
            organizationId: fixture.organizationId,
            journeyId: fixture.journeyId,
            env: validationEnv,
          });
          assertCheck(report, "SELECTED_CREDENTIAL_TENANT", "PASS");
          assertCheck(report, "PROVIDER_CREDENTIAL_READY", "FAIL");
        },
      );
    });
  });

  it("encrypts PayTR secrets and keeps audits and step metadata secret-free", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const providerInput = paytrInput();
        const plaintexts = [
          providerInput.merchantId,
          providerInput.merchantKey,
          providerInput.merchantSalt,
        ];
        const result = await saveActivationPaymentProviderStep({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          providerInput,
        });
        assert.equal(result.currentStep, ActivationStepKey.VALIDATION);

        const credential = await prisma.wexPayProviderCredential.findFirstOrThrow({
          where: { organizationId: fixture.organizationId, provider: "paytr" },
        });
        assertNoPlaintext(credential.configCiphertext, plaintexts);
        const decrypted = decryptProviderConfig(credential.configCiphertext);
        assert.equal(decrypted.merchantId === providerInput.merchantId, true);
        assert.equal(decrypted.merchantKey === providerInput.merchantKey, true);
        assert.equal(decrypted.merchantSalt === providerInput.merchantSalt, true);

        const step = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.PAYMENT_PROVIDER,
            },
          },
        });
        assertNoPlaintext(step.safeMetadataJson, plaintexts);
        assertAuditMetadataKeys(step.safeMetadataJson, [
          "provider",
          "credentialId",
          "mode",
          "keyFingerprint",
          "configCheckedAt",
          "onlinePaymentApiEnabled",
        ]);

        const audits = await prisma.auditLog.findMany({
          where: { organizationId: fixture.organizationId },
          orderBy: { createdAt: "asc" },
        });
        assert.equal(audits.length, 2);
        for (const audit of audits) assertNoPlaintext(audit, plaintexts);
        const credentialAudit = audits.find(
          (audit) => audit.action === "wexpay.provider_credential.upserted",
        );
        const stepAudit = audits.find(
          (audit) => audit.action === "activation.payment_provider.completed",
        );
        assert.ok(credentialAudit);
        assert.ok(stepAudit);
        assertAuditMetadataKeys(credentialAudit.metadataJson, [
          "source",
          "provider",
          "mode",
          "keyFingerprint",
          "maskedKey",
          "isActive",
        ]);
        assertAuditMetadataKeys(stepAudit.metadataJson, [
          "source",
          "provider",
          "credentialId",
          "mode",
          "keyFingerprint",
          "configCheckedAt",
          "onlinePaymentApiEnabled",
        ]);
      },
    );
  });

  it("fully rolls back stale provider completion", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const beforeStep = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.PAYMENT_PROVIDER,
            },
          },
        });
        await assert.rejects(
          () =>
            saveActivationPaymentProviderStep({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 999,
              providerInput: paytrInput(),
            }),
          (error: unknown) => isCode(error, "VERSION_CONFLICT"),
        );
        assert.equal(
          await prisma.wexPayProviderCredential.count({
            where: { organizationId: fixture.organizationId },
          }),
          0,
        );
        assert.equal(
          await prisma.auditLog.count({ where: { organizationId: fixture.organizationId } }),
          0,
        );
        const journey = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const afterStep = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.PAYMENT_PROVIDER,
            },
          },
        });
        assert.equal(journey.version, 1);
        assert.equal(journey.currentStep, ActivationStepKey.PAYMENT_PROVIDER);
        assert.equal(afterStep.status, beforeStep.status);
        assert.equal(afterStep.attemptCount, beforeStep.attemptCount);
        assert.deepEqual(afterStep.safeMetadataJson, beforeStep.safeMetadataJson);
      },
    );
  });

  it("serializes concurrent provider completion without partial duplicates", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const providerInput = paytrInput();
        const calls = await Promise.allSettled(
          [fixture.ownerId, fixture.adminId].map((actorUserId) =>
            saveActivationPaymentProviderStep({
              organizationId: fixture.organizationId,
              actorUserId,
              expectedVersion: 1,
              providerInput,
            }),
          ),
        );
        assert.equal(calls.filter((call) => call.status === "fulfilled").length, 1);
        assert.equal(calls.filter((call) => call.status === "rejected").length, 1);
        const rejected = calls.find((call) => call.status === "rejected");
        assert.equal(
          rejected?.status === "rejected" &&
            (isCode(rejected.reason, "VERSION_CONFLICT") ||
              isCode(rejected.reason, "OUT_OF_ORDER")),
          true,
        );

        assert.equal(
          await prisma.wexPayProviderCredential.count({
            where: { organizationId: fixture.organizationId },
          }),
          1,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action: "wexpay.provider_credential.upserted",
            },
          }),
          1,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action: "activation.payment_provider.completed",
            },
          }),
          1,
        );
        const journey = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const step = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.PAYMENT_PROVIDER,
            },
          },
        });
        assert.equal(journey.version, 2);
        assert.equal(journey.currentStep, ActivationStepKey.VALIDATION);
        assert.equal(step.status, ActivationJourneyStepStatus.COMPLETED);
        assert.equal(step.attemptCount, 1);
      },
    );
  });

  it("persists validation failure then reaches READY after data repair", async () => {
    await usingFixture(
      {
        currentStep: ActivationStepKey.VALIDATION,
        menuSkipped: false,
        menuActive: false,
      },
      async (fixture) => {
        const failed = await runWexPayActivationValidation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          env: validationEnv,
        });
        assert.equal(failed.journey.status, ActivationJourneyStatus.BLOCKED);
        assert.equal(failed.journey.currentStep, ActivationStepKey.VALIDATION);
        assert.equal(failed.journey.blockedReasonCode, "VALIDATION_FAILED");
        assertCheck(failed.report, "MENU_READY", "FAIL");
        const failedStep = failed.journey.steps.find(
          (step) => step.stepKey === ActivationStepKey.VALIDATION,
        );
        assert.equal(failedStep?.status, ActivationJourneyStepStatus.ERROR);
        assert.equal(failedStep?.lastErrorCode, "VALIDATION_FAILED");

        await prisma.menuProduct.update({
          where: { id: fixture.menuProductId },
          data: { isActive: true },
        });
        const retried = await runWexPayActivationValidation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: failed.journey.version,
          env: validationEnv,
        });
        assert.equal(retried.report.failCount, 0);
        assert.equal(retried.journey.status, ActivationJourneyStatus.READY);
        assert.equal(retried.journey.currentStep, ActivationStepKey.GO_LIVE);
        assert.equal(retried.journey.blockedReasonCode, null);
        const retriedStep = retried.journey.steps.find(
          (step) => step.stepKey === ActivationStepKey.VALIDATION,
        );
        assert.equal(retriedStep?.status, ActivationJourneyStepStatus.COMPLETED);
        assert.equal(retriedStep?.attemptCount, 2);
      },
    );
  });

  it("keeps READY private and makes concurrent go-live idempotent", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.GO_LIVE },
      async (fixture) => {
        assert.equal(await assertWexPayPublicLiveReady(fixture.organizationId), false);
        const calls = await Promise.all([
          goLiveWexPayActivation({
            organizationId: fixture.organizationId,
            actorUserId: fixture.ownerId,
            expectedVersion: 1,
            confirmed: true,
            confirmationText: fixture.organizationSlug,
            env: validationEnv,
          }),
          goLiveWexPayActivation({
            organizationId: fixture.organizationId,
            actorUserId: fixture.ownerId,
            expectedVersion: 1,
            confirmed: true,
            confirmationText: fixture.organizationSlug,
            env: validationEnv,
          }),
        ]);
        assert.equal(calls.every((call) => call.activated), true);
        assert.deepEqual(
          calls.map((call) => call.idempotent).sort(),
          [false, true],
        );
        assert.equal(await assertWexPayPublicLiveReady(fixture.organizationId), true);
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action: "activation.go_live.completed",
            },
          }),
          1,
        );
        const goLiveStep = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.GO_LIVE,
            },
          },
        });
        assert.equal(goLiveStep.status, ActivationJourneyStepStatus.COMPLETED);
        assert.equal(goLiveStep.attemptCount, 1);
      },
    );
  });

  it("rejects stale ACTIVE replays beyond the just-completed version", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.GO_LIVE },
      async (fixture) => {
        const activated = await goLiveWexPayActivation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          confirmed: true,
          confirmationText: fixture.organizationSlug,
          env: validationEnv,
        });
        assert.equal(activated.journey.version, 2);

        const immediateReplay = await goLiveWexPayActivation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          confirmed: true,
          confirmationText: fixture.organizationSlug,
          env: validationEnv,
        });
        assert.equal(immediateReplay.idempotent, true);

        await assert.rejects(
          () =>
            goLiveWexPayActivation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 0,
              confirmed: true,
              confirmationText: fixture.organizationSlug,
              env: validationEnv,
            }),
          (error: unknown) => isCode(error, "VERSION_CONFLICT"),
        );
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action: "activation.go_live.completed",
            },
          }),
          1,
        );
      },
    );
  });

  it("revalidates actor role, membership, and activity in the transaction", async (t) => {
    await t.test("demoted owner", async () => {
      await usingFixture({ currentStep: ActivationStepKey.GO_LIVE }, async (fixture) => {
        await prisma.membership.update({
          where: {
            organizationId_userId: {
              organizationId: fixture.organizationId,
              userId: fixture.ownerId,
            },
          },
          data: { role: MembershipRole.MANAGER },
        });
        await assert.rejects(
          () =>
            goLiveWexPayActivation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 1,
              confirmed: true,
              confirmationText: fixture.organizationSlug,
              env: validationEnv,
            }),
          (error: unknown) => isCode(error, "FORBIDDEN"),
        );
      });
    });

    await t.test("inactive membership", async () => {
      await usingFixture({ currentStep: ActivationStepKey.GO_LIVE }, async (fixture) => {
        await prisma.membership.update({
          where: {
            organizationId_userId: {
              organizationId: fixture.organizationId,
              userId: fixture.ownerId,
            },
          },
          data: { status: MembershipStatus.SUSPENDED },
        });
        await assert.rejects(
          () =>
            goLiveWexPayActivation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 1,
              confirmed: true,
              confirmationText: fixture.organizationSlug,
              env: validationEnv,
            }),
          (error: unknown) => isCode(error, "FORBIDDEN"),
        );
      });
    });

    await t.test("inactive user", async () => {
      await usingFixture({ currentStep: ActivationStepKey.GO_LIVE }, async (fixture) => {
        await prisma.user.update({
          where: { id: fixture.ownerId },
          data: { isActive: false },
        });
        await assert.rejects(
          () =>
            goLiveWexPayActivation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 1,
              confirmed: true,
              confirmationText: fixture.organizationSlug,
              env: validationEnv,
            }),
          (error: unknown) => isCode(error, "ACTOR_INACTIVE"),
        );
      });
    });
  });

  it("allows OWNER and ADMIN go-live but rejects MANAGER", async (t) => {
    for (const [role, actorKey, allowed] of [
      ["OWNER", "ownerId", true],
      ["ADMIN", "adminId", true],
      ["MANAGER", "managerId", false],
    ] as const) {
      await t.test(role, async () => {
        await usingFixture({ currentStep: ActivationStepKey.GO_LIVE }, async (fixture) => {
          const request = () =>
            goLiveWexPayActivation({
              organizationId: fixture.organizationId,
              actorUserId: fixture[actorKey],
              expectedVersion: 1,
              confirmed: true,
              confirmationText: fixture.organizationSlug,
              env: validationEnv,
            });
          if (allowed) {
            const result = await request();
            assert.equal(result.activated, true);
          } else {
            await assert.rejects(request, (error: unknown) => isCode(error, "FORBIDDEN"));
          }
        });
      });
    }
  });

  it("admin block and unblock preserve current step without fake completion", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const before = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.PAYMENT_PROVIDER,
            },
          },
        });
        const blocked = await blockWexPayActivationAsAdmin({
          organizationId: fixture.organizationId,
          expectedVersion: 1,
          actor: { email: "ops-admin@example.test" },
          reason: "compliance hold",
          note: "Local database verification hold.",
        });
        assert.equal(blocked.status, ActivationJourneyStatus.BLOCKED);
        assert.equal(blocked.currentStep, ActivationStepKey.PAYMENT_PROVIDER);
        assert.equal(blocked.blockedReasonCode, "ADMIN_BLOCKED");

        const unblocked = await unblockWexPayActivationAsAdmin({
          organizationId: fixture.organizationId,
          expectedVersion: blocked.version,
          actor: { email: "ops-admin@example.test" },
          reason: "compliance clear",
        });
        assert.equal(unblocked.status, ActivationJourneyStatus.IN_PROGRESS);
        assert.equal(unblocked.currentStep, ActivationStepKey.PAYMENT_PROVIDER);
        assert.equal(unblocked.blockedReasonCode, null);
        const afterStep = unblocked.steps.find(
          (step) => step.stepKey === ActivationStepKey.PAYMENT_PROVIDER,
        );
        assert.equal(afterStep?.status, before.status);
        assert.equal(afterStep?.attemptCount, before.attemptCount);
        assert.equal(afterStep?.completedAt, null);
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action: { in: ["activation.admin.blocked", "activation.admin.unblocked"] },
            },
          }),
          2,
        );
      },
    );
  });

  it("restores READY when unblocking a validated GO_LIVE journey", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.GO_LIVE },
      async (fixture) => {
        const validationBefore = await prisma.activationJourneyStep.findUniqueOrThrow({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.VALIDATION,
            },
          },
        });
        assert.equal(
          validationBefore.status,
          ActivationJourneyStepStatus.COMPLETED,
        );

        const blocked = await blockWexPayActivationAsAdmin({
          organizationId: fixture.organizationId,
          expectedVersion: 1,
          actor: { email: "ops-admin@example.test" },
          reason: "launch hold",
          note: "Verified local launch hold.",
        });
        assert.equal(blocked.status, ActivationJourneyStatus.BLOCKED);
        assert.equal(blocked.currentStep, ActivationStepKey.GO_LIVE);

        const unblocked = await unblockWexPayActivationAsAdmin({
          organizationId: fixture.organizationId,
          expectedVersion: blocked.version,
          actor: { email: "ops-admin@example.test" },
          reason: "launch clear",
        });
        assert.equal(unblocked.status, ActivationJourneyStatus.READY);
        assert.equal(unblocked.currentStep, ActivationStepKey.GO_LIVE);
        const validationAfter = unblocked.steps.find(
          (step) => step.stepKey === ActivationStepKey.VALIDATION,
        );
        assert.equal(validationAfter?.status, validationBefore.status);
        assert.equal(
          validationAfter?.attemptCount,
          validationBefore.attemptCount,
        );
        assert.deepEqual(
          validationAfter?.safeMetadataJson,
          validationBefore.safeMetadataJson,
        );
      },
    );
  });

  it("admin-assisted go-live uses the validator and audits its safe reason", async () => {
    await usingFixture(
      {
        currentStep: ActivationStepKey.GO_LIVE,
        menuSkipped: false,
        menuActive: false,
      },
      async (fixture) => {
        const regressed = await adminAssistedWexPayGoLive({
          organizationId: fixture.organizationId,
          expectedVersion: 1,
          actor: { email: "support-admin@example.test" },
          reason: "support assisted",
          note: "Customer requested verified support.",
          confirmed: true,
          confirmationText: fixture.organizationName,
          env: validationEnv,
        });
        assert.equal(regressed.activated, false);
        assertCheck(regressed.report!, "MENU_READY", "FAIL");
        assert.equal(regressed.journey.status, ActivationJourneyStatus.BLOCKED);
        assert.equal(regressed.journey.blockedReasonCode, "VALIDATION_FAILED");

        const regressionAudit = await prisma.auditLog.findFirstOrThrow({
          where: {
            organizationId: fixture.organizationId,
            action: "activation.go_live.regressed",
          },
        });
        assertAuditMetadataKeys(regressionAudit.metadataJson, [
          "source",
          "actorType",
          "actorEmail",
          "reasonCode",
          "noteLength",
          "result",
          "passCount",
          "warningCount",
          "failCount",
          "checks",
        ]);
        assert.equal(
          (regressionAudit.metadataJson as Record<string, unknown>).reasonCode,
          "SUPPORT_ASSISTED",
        );

        await prisma.menuProduct.update({
          where: { id: fixture.menuProductId },
          data: { isActive: true },
        });
        const validated = await runWexPayActivationValidation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: regressed.journey.version,
          env: validationEnv,
        });
        assert.equal(validated.journey.status, ActivationJourneyStatus.READY);

        const activated = await adminAssistedWexPayGoLive({
          organizationId: fixture.organizationId,
          expectedVersion: validated.journey.version,
          actor: { email: "support-admin@example.test" },
          reason: "support assisted",
          note: "Customer requested verified support.",
          confirmed: true,
          confirmationText: fixture.organizationName,
          env: validationEnv,
        });
        assert.equal(activated.activated, true);
        assert.equal(activated.journey.source, ActivationJourneySource.ADMIN_ASSISTED);
        const activationAudit = await prisma.auditLog.findFirstOrThrow({
          where: {
            organizationId: fixture.organizationId,
            action: "activation.go_live.admin_assisted",
          },
        });
        assert.equal(
          (activationAudit.metadataJson as Record<string, unknown>).reasonCode,
          "SUPPORT_ASSISTED",
        );
        assertAuditMetadataKeys(activationAudit.metadataJson, [
          "source",
          "actorType",
          "actorEmail",
          "reasonCode",
          "noteLength",
          "confirmationMatch",
          "validationResult",
          "warningCount",
        ]);
      },
    );
  });

  it("regresses go-live when fee, license, install, or subscription lifecycle changes", async (t) => {
    const cases = [
      {
        name: "fee",
        check: "ACTIVATION_FEE_SETTLED",
        mutate: (fixture: Fixture) =>
          prisma.activationFeeLedger.update({
            where: { id: fixture.feeId },
            data: { status: "PENDING", paidAt: null },
          }),
      },
      {
        name: "license",
        check: "LICENSE_ACTIVE",
        mutate: (fixture: Fixture) =>
          prisma.license.update({
            where: { id: fixture.licenseId },
            data: { status: "SUSPENDED" },
          }),
      },
      {
        name: "installation",
        check: "INSTALLATION_ACTIVE",
        mutate: (fixture: Fixture) =>
          prisma.appInstallation.update({
            where: { id: fixture.installationId },
            data: { status: "DISABLED" },
          }),
      },
      {
        name: "subscription",
        check: "SUBSCRIPTION_LIFECYCLE",
        mutate: (fixture: Fixture) =>
          prisma.subscription.update({
            where: { id: fixture.subscriptionId },
            data: { status: "CANCELLED" },
          }),
      },
    ] as const;

    for (const testCase of cases) {
      await t.test(testCase.name, async () => {
        await usingFixture({ currentStep: ActivationStepKey.GO_LIVE }, async (fixture) => {
          await testCase.mutate(fixture);
          const result = await goLiveWexPayActivation({
            organizationId: fixture.organizationId,
            actorUserId: fixture.ownerId,
            expectedVersion: 1,
            confirmed: true,
            confirmationText: fixture.organizationSlug,
            env: validationEnv,
          });
          assert.equal(result.activated, false);
          assertCheck(result.report!, testCase.check, "FAIL");
          assert.equal(result.journey.status, ActivationJourneyStatus.BLOCKED);
          assert.equal(result.journey.currentStep, ActivationStepKey.VALIDATION);
          assert.equal(result.journey.blockedReasonCode, "VALIDATION_FAILED");
          assert.equal(await assertWexPayPublicLiveReady(fixture.organizationId), false);
          assert.equal(
            await prisma.auditLog.count({
              where: {
                organizationId: fixture.organizationId,
                action: "activation.go_live.completed",
              },
            }),
            0,
          );
        });
      });
    }
  });

  it("enforces the exact selected provider for public checkout availability", async (t) => {
    await t.test("MANUAL stays offline with a legacy PayTR credential", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          await createPaytrCredential(fixture);
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });

          const enabledEnv = {
            ...validationEnv,
            WEXPAY_PAYTR_ENABLE_API: "true",
          };
          const availability = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.deepEqual(availability, {
            onlineCheckoutEnabled: false,
            provider: "MANUAL",
            reason: "MANUAL_SELECTED",
          });

          const originalFlag = process.env.WEXPAY_PAYTR_ENABLE_API;
          process.env.WEXPAY_PAYTR_ENABLE_API = "true";
          try {
            await assert.rejects(
              () =>
                createPublicCheckoutPayment({
                  organizationId: fixture.organizationId,
                  branchId: fixture.branchId,
                  tableId: fixture.tableId,
                  publicPath: "/q/pr4-manual",
                  keyKind: "opaque",
                  tokenId: fixture.tokenId,
                  tokenPrefix: "pr4",
                  ipAddress: "127.0.0.1",
                }),
              WexPayPublicCheckoutUnavailableError,
            );
          } finally {
            if (originalFlag === undefined) {
              delete process.env.WEXPAY_PAYTR_ENABLE_API;
            } else {
              process.env.WEXPAY_PAYTR_ENABLE_API = originalFlag;
            }
          }
          assert.equal(
            await prisma.payment.count({
              where: {
                branch: {
                  restaurant: { organizationId: fixture.organizationId },
                },
              },
            }),
            0,
          );
        },
      );
    });

    await t.test("PayTR rejects selected mode and fingerprint drift", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          const { summary } = await createPaytrCredential(fixture);
          const exactMetadata = paytrStepMetadata(summary);
          await setPaymentMetadata(fixture, exactMetadata);
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });
          const enabledEnv = {
            ...validationEnv,
            WEXPAY_PAYTR_ENABLE_API: "true",
          };

          const exact = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.equal(exact.onlineCheckoutEnabled, true);

          await setPaymentMetadata(fixture, {
            ...exactMetadata,
            mode: WexPayProviderCredentialMode.LIVE,
          });
          const wrongMode = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.equal(wrongMode.onlineCheckoutEnabled, false);
          assert.equal(
            wrongMode.onlineCheckoutEnabled ? null : wrongMode.reason,
            "CREDENTIAL_INVALID",
          );

          await setPaymentMetadata(fixture, {
            ...exactMetadata,
            keyFingerprint: "0000000000000000",
          });
          const wrongFingerprint =
            await resolveWexPayPublicPaymentAvailability(
              fixture.organizationId,
              { env: enabledEnv },
            );
          assert.equal(wrongFingerprint.onlineCheckoutEnabled, false);
          assert.equal(
            wrongFingerprint.onlineCheckoutEnabled
              ? null
              : wrongFingerprint.reason,
            "CREDENTIAL_INVALID",
          );
        },
      );
    });

    await t.test("production disables TEST and permits LIVE", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          const testCredential = await createPaytrCredential(
            fixture,
            WexPayProviderCredentialMode.TEST,
          );
          await setPaymentMetadata(
            fixture,
            paytrStepMetadata(testCredential.summary),
          );
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });
          const productionEnv = {
            ...validationEnv,
            VERCEL_ENV: "production",
            NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN: "https://www.wexon.dev",
            WEXPAY_PAYTR_ENABLE_API: "true",
          };
          const testAvailability =
            await resolveWexPayPublicPaymentAvailability(
              fixture.organizationId,
              { env: productionEnv },
            );
          assert.deepEqual(testAvailability, {
            onlineCheckoutEnabled: false,
            provider: "PAYTR",
            reason: "PAYTR_TEST_MODE_PRODUCTION",
          });

          const liveCredential = await createPaytrCredential(
            fixture,
            WexPayProviderCredentialMode.LIVE,
          );
          await setPaymentMetadata(
            fixture,
            paytrStepMetadata(liveCredential.summary),
          );
          const liveAvailability =
            await resolveWexPayPublicPaymentAvailability(
              fixture.organizationId,
              { env: productionEnv },
            );
          assert.equal(liveAvailability.onlineCheckoutEnabled, true);
          if (liveAvailability.onlineCheckoutEnabled) {
            assert.equal(
              liveAvailability.mode,
              WexPayProviderCredentialMode.LIVE,
            );
          }
        },
      );
    });
  });

  it("applies PayTR fallback only to metadata-less LEGACY_BACKFILL journeys", async (t) => {
    const enabledEnv = {
      ...validationEnv,
      WEXPAY_PAYTR_ENABLE_API: "true",
    };

    await t.test("legacy fallback prefers LIVE then TEST", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          await createPaytrCredential(
            fixture,
            WexPayProviderCredentialMode.TEST,
          );
          const live = await createPaytrCredential(
            fixture,
            WexPayProviderCredentialMode.LIVE,
          );
          await prisma.activationJourneyStep.update({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
            data: {
              status: ActivationJourneyStepStatus.SKIPPED,
              safeMetadataJson: {
                provider: "PAYTR",
                legacyBackfill: true,
              },
            },
          });
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              source: ActivationJourneySource.LEGACY_BACKFILL,
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });

          const availability = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.equal(availability.onlineCheckoutEnabled, true);
          if (availability.onlineCheckoutEnabled) {
            assert.equal(
              availability.selectionSource,
              "LEGACY_BACKFILL",
            );
            assert.equal(
              availability.mode,
              WexPayProviderCredentialMode.LIVE,
            );
            assert.equal(availability.credentialId, live.summary.id);
          }
        },
      );
    });

    await t.test("legacy TEST fallback stays closed in production", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          await createPaytrCredential(
            fixture,
            WexPayProviderCredentialMode.TEST,
          );
          await prisma.activationJourneyStep.update({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
            data: {
              status: ActivationJourneyStepStatus.SKIPPED,
              safeMetadataJson: { legacyBackfill: true },
            },
          });
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              source: ActivationJourneySource.LEGACY_BACKFILL,
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });
          const availability = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            {
              env: {
                ...enabledEnv,
                VERCEL_ENV: "production",
                NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN:
                  "https://www.wexon.dev",
              },
            },
          );
          assert.deepEqual(availability, {
            onlineCheckoutEnabled: false,
            provider: "PAYTR",
            reason: "PAYTR_TEST_MODE_PRODUCTION",
          });
        },
      );
    });

    await t.test("SELF_SERVE never receives legacy fallback", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          await createPaytrCredential(fixture);
          await prisma.activationJourneyStep.update({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
            data: { safeMetadataJson: { legacyBackfill: true } },
          });
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });
          const availability = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.deepEqual(availability, {
            onlineCheckoutEnabled: false,
            provider: null,
            reason: "SELECTION_INVALID",
          });
        },
      );
    });

    await t.test("explicit legacy MANUAL never falls through", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.GO_LIVE },
        async (fixture) => {
          await createPaytrCredential(fixture);
          await prisma.activationJourney.update({
            where: { id: fixture.journeyId },
            data: {
              source: ActivationJourneySource.LEGACY_BACKFILL,
              status: ActivationJourneyStatus.ACTIVE,
              completedAt: new Date(),
            },
          });
          const availability = await resolveWexPayPublicPaymentAvailability(
            fixture.organizationId,
            { env: enabledEnv },
          );
          assert.deepEqual(availability, {
            onlineCheckoutEnabled: false,
            provider: "MANUAL",
            reason: "MANUAL_SELECTED",
          });
        },
      );
    });
  });

  it("refreshes selected credential metadata atomically on rotation", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.GO_LIVE },
      async (fixture) => {
        const initial = await createPaytrCredential(fixture);
        const initialMetadata = {
          ...paytrStepMetadata(initial.summary),
          configCheckedAt: "2020-01-01T00:00:00.000Z",
        };
        await setPaymentMetadata(
          fixture,
          initialMetadata,
        );
        await prisma.activationJourney.update({
          where: { id: fixture.journeyId },
          data: {
            status: ActivationJourneyStatus.ACTIVE,
            completedAt: new Date(),
          },
        });
        const journeyBefore = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const stepBefore =
          await prisma.activationJourneyStep.findUniqueOrThrow({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
          });
        const metadataBefore =
          stepBefore.safeMetadataJson as Record<string, unknown>;

        const replacement = paytrInput();
        const rotated = await upsertWexPayProviderCredential(
          {
            organizationId: fixture.organizationId,
            userId: fixture.ownerId,
          },
          {
            provider: "paytr",
            displayName: "PayTR rotated",
            mode: WexPayProviderCredentialMode.TEST,
            config: {
              merchantId: replacement.merchantId,
              merchantKey: replacement.merchantKey,
              merchantSalt: replacement.merchantSalt,
            },
            primarySecret: replacement.merchantKey,
            isActive: true,
          },
        );
        assert.equal(rotated.id, initial.summary.id);
        assert.notEqual(
          rotated.keyFingerprint,
          initial.summary.keyFingerprint,
        );

        const journeyAfter = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const stepAfter =
          await prisma.activationJourneyStep.findUniqueOrThrow({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
          });
        const metadataAfter =
          stepAfter.safeMetadataJson as Record<string, unknown>;
        assert.equal(journeyAfter.version, journeyBefore.version + 1);
        assert.equal(stepAfter.status, stepBefore.status);
        assert.equal(stepAfter.attemptCount, stepBefore.attemptCount);
        assert.equal(metadataAfter.provider, metadataBefore.provider);
        assert.equal(metadataAfter.credentialId, metadataBefore.credentialId);
        assert.equal(metadataAfter.mode, metadataBefore.mode);
        assert.equal(metadataAfter.keyFingerprint, rotated.keyFingerprint);
        assert.notEqual(
          metadataAfter.configCheckedAt,
          metadataBefore.configCheckedAt,
        );
        assert.equal(metadataAfter.onlinePaymentApiEnabled, false);

        const plaintexts = [
          replacement.merchantId,
          replacement.merchantKey,
          replacement.merchantSalt,
        ];
        assertNoPlaintext(metadataAfter, plaintexts);
        const refreshAudit = await prisma.auditLog.findFirstOrThrow({
          where: {
            organizationId: fixture.organizationId,
            action: "activation.payment_provider.credential_refreshed",
          },
        });
        assertNoPlaintext(refreshAudit, plaintexts);
        assertAuditMetadataKeys(refreshAudit.metadataJson, [
          "source",
          "provider",
          "credentialId",
          "mode",
          "keyFingerprint",
          "configCheckedAt",
          "onlinePaymentApiEnabled",
        ]);

        const availability = await resolveWexPayPublicPaymentAvailability(
          fixture.organizationId,
          {
            env: {
              ...validationEnv,
              WEXPAY_PAYTR_ENABLE_API: "true",
            },
          },
        );
        assert.equal(availability.onlineCheckoutEnabled, true);
        if (availability.onlineCheckoutEnabled) {
          assert.equal(availability.credentialId, rotated.id);
          assert.equal(
            availability.keyFingerprint,
            rotated.keyFingerprint,
          );
        }
      },
    );
  });

  it("does not refresh activation metadata for an unrelated credential", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.GO_LIVE },
      async (fixture) => {
        const selected = await createPaytrCredential(fixture);
        await setPaymentMetadata(
          fixture,
          paytrStepMetadata(selected.summary),
        );
        await prisma.activationJourney.update({
          where: { id: fixture.journeyId },
          data: {
            status: ActivationJourneyStatus.ACTIVE,
            completedAt: new Date(),
          },
        });
        const journeyBefore = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const stepBefore =
          await prisma.activationJourneyStep.findUniqueOrThrow({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
          });

        await createPaytrCredential(
          fixture,
          WexPayProviderCredentialMode.LIVE,
        );

        const journeyAfter = await prisma.activationJourney.findUniqueOrThrow({
          where: { id: fixture.journeyId },
        });
        const stepAfter =
          await prisma.activationJourneyStep.findUniqueOrThrow({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.PAYMENT_PROVIDER,
              },
            },
          });
        assert.equal(journeyAfter.version, journeyBefore.version);
        assert.deepEqual(
          stepAfter.safeMetadataJson,
          stepBefore.safeMetadataJson,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: {
              organizationId: fixture.organizationId,
              action:
                "activation.payment_provider.credential_refreshed",
            },
          }),
          0,
        );
      },
    );
  });

  it("validates MANUAL and PayTR TEST locally with payment API disabled", async (t) => {
    const originalFetch = globalThis.fetch;
    let fetchCallCount = 0;
    globalThis.fetch = (async () => {
      fetchCallCount += 1;
      throw new Error("Network access is forbidden in PR-4 DB tests.");
    }) as typeof fetch;
    try {
      await t.test("MANUAL", async () => {
        await usingFixture(
          { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
          async (fixture) => {
            const saved = await saveActivationPaymentProviderStep({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 1,
              providerInput: { provider: "MANUAL", manualAcknowledged: true },
            });
            const validation = await runWexPayActivationValidation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: saved.version,
              env: validationEnv,
            });
            assert.equal(validation.report.failCount, 0);
            assertCheck(validation.report, "MANUAL_PROVIDER_WARNING", "WARNING");
          },
        );
      });

      await t.test("PayTR TEST", async () => {
        await usingFixture(
          { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
          async (fixture) => {
            const saved = await saveActivationPaymentProviderStep({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: 1,
              providerInput: paytrInput(),
            });
            const paymentStep = saved.steps.find(
              (step) => step.stepKey === ActivationStepKey.PAYMENT_PROVIDER,
            );
            const metadata = paymentStep?.safeMetadataJson as Record<string, unknown>;
            assert.equal(metadata.mode, "TEST");
            assert.equal(metadata.onlinePaymentApiEnabled, false);
            const validation = await runWexPayActivationValidation({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: saved.version,
              env: validationEnv,
            });
            assert.equal(validation.report.failCount, 0);
            assertCheck(validation.report, "PAYTR_API_DISABLED", "WARNING");
          },
        );
      });
      assert.equal(fetchCallCount, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("treats persisted PayTR API state as informational and keeps provider step closed", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const saved = await saveActivationPaymentProviderStep({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          providerInput: paytrInput(),
        });
        const currentEnv = {
          ...validationEnv,
          WEXPAY_PAYTR_ENABLE_API: "true",
        };
        const validation = await runWexPayActivationValidation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: saved.version,
          env: currentEnv,
        });
        assert.equal(validation.report.failCount, 0);
        assertCheck(
          validation.report,
          "PAYMENT_PROVIDER_SELECTED",
          "PASS",
        );
        assert.equal(
          validation.report.checks.some(
            (check) => check.key === "PAYTR_API_DISABLED",
          ),
          false,
        );
        const providerStep = validation.journey.steps.find(
          (step) => step.stepKey === ActivationStepKey.PAYMENT_PROVIDER,
        );
        assert.equal(
          providerStep?.status,
          ActivationJourneyStepStatus.COMPLETED,
        );

        await assert.rejects(
          () =>
            saveActivationPaymentProviderStep({
              organizationId: fixture.organizationId,
              actorUserId: fixture.ownerId,
              expectedVersion: validation.journey.version,
              providerInput: paytrInput(),
            }),
          (error: unknown) => isCode(error, "OUT_OF_ORDER"),
        );
      },
    );
  });

  it("warns but allows validation and go-live with production TEST mode", async () => {
    await usingFixture(
      { currentStep: ActivationStepKey.PAYMENT_PROVIDER },
      async (fixture) => {
        const saved = await saveActivationPaymentProviderStep({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: 1,
          providerInput: paytrInput(),
        });
        const productionEnv = {
          ...validationEnv,
          VERCEL_ENV: "production",
          NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN: "https://www.wexon.dev",
          WEXPAY_PAYTR_ENABLE_API: "true",
        };
        const validation = await runWexPayActivationValidation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: saved.version,
          env: productionEnv,
        });
        assert.equal(validation.report.failCount, 0);
        assertCheck(
          validation.report,
          "PAYTR_TEST_MODE_PRODUCTION",
          "WARNING",
        );
        assert.equal(validation.journey.status, ActivationJourneyStatus.READY);

        const activated = await goLiveWexPayActivation({
          organizationId: fixture.organizationId,
          actorUserId: fixture.ownerId,
          expectedVersion: validation.journey.version,
          confirmed: true,
          confirmationText: fixture.organizationSlug,
          env: productionEnv,
        });
        assert.equal(activated.activated, true);
        assertCheck(
          activated.report!,
          "PAYTR_TEST_MODE_PRODUCTION",
          "WARNING",
        );
        const availability = await resolveWexPayPublicPaymentAvailability(
          fixture.organizationId,
          { env: productionEnv },
        );
        assert.deepEqual(availability, {
          onlineCheckoutEnabled: false,
          provider: "PAYTR",
          reason: "PAYTR_TEST_MODE_PRODUCTION",
        });
      },
    );
  });

  it("fails duplicate, missing-chain, cross-tenant, and tenant-journey validation", async (t) => {
    await t.test("duplicate token constraint and duplicate metadata", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.VALIDATION },
        async (fixture) => {
          await assert.rejects(
            () =>
              prisma.tableQrToken.create({
                data: {
                  tableId: fixture.tableId,
                  tokenHash: `duplicate-${randomUUID()}`,
                  tokenPrefix: "duplicate",
                  status: "ACTIVE",
                },
              }),
            (error: unknown) =>
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              (error as { code: string }).code === "P2002",
          );
          await prisma.activationJourneyStep.update({
            where: {
              journeyId_stepKey: {
                journeyId: fixture.journeyId,
                stepKey: ActivationStepKey.TABLE_SETUP,
              },
            },
            data: {
              safeMetadataJson: {
                branchId: fixture.branchId,
                tableIds: [fixture.tableId, fixture.tableId],
                qrAck: true,
                awaitingQrAck: false,
              },
            },
          });
          const report = await validateWexPayActivationInTx(prisma, {
            organizationId: fixture.organizationId,
            journeyId: fixture.journeyId,
            env: validationEnv,
          });
          assertCheck(report, "NO_DUPLICATE_REFERENCES", "FAIL");
        },
      );
    });

    await t.test("missing active tenant token chain", async () => {
      await usingFixture(
        { currentStep: ActivationStepKey.VALIDATION },
        async (fixture) => {
          await prisma.tableQrToken.update({
            where: { id: fixture.tokenId },
            data: { status: "REVOKED", revokedAt: new Date() },
          });
          const report = await validateWexPayActivationInTx(prisma, {
            organizationId: fixture.organizationId,
            journeyId: fixture.journeyId,
            env: validationEnv,
          });
          assertCheck(report, "OPAQUE_QR_TOKENS", "FAIL");
          assertCheck(report, "ACTIVE_TENANT_TOKEN_CHAIN", "FAIL");
        },
      );
    });

    await t.test("cross-tenant references and journey mismatch", async () => {
      const fixture = await createFixture({ currentStep: ActivationStepKey.VALIDATION });
      const foreign = await createFixture({ currentStep: ActivationStepKey.VALIDATION });
      try {
        await prisma.activationJourneyStep.update({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.BRANCH_SETUP,
            },
          },
          data: {
            safeMetadataJson: {
              restaurantId: foreign.restaurantId,
              branchId: foreign.branchId,
            },
          },
        });
        await prisma.activationJourneyStep.update({
          where: {
            journeyId_stepKey: {
              journeyId: fixture.journeyId,
              stepKey: ActivationStepKey.TABLE_SETUP,
            },
          },
          data: {
            safeMetadataJson: {
              branchId: foreign.branchId,
              tableIds: [foreign.tableId],
              qrAck: true,
              awaitingQrAck: false,
            },
          },
        });
        const crossTenant = await validateWexPayActivationInTx(prisma, {
          organizationId: fixture.organizationId,
          journeyId: fixture.journeyId,
          env: validationEnv,
        });
        assertCheck(crossTenant, "ACTIVE_RESTAURANT", "FAIL");
        assertCheck(crossTenant, "ACTIVE_BRANCH", "FAIL");
        assertCheck(crossTenant, "ACTIVE_TABLES", "FAIL");

        const wrongJourneyTenant = await validateWexPayActivationInTx(prisma, {
          organizationId: foreign.organizationId,
          journeyId: fixture.journeyId,
          env: validationEnv,
        });
        assert.equal(wrongJourneyTenant.failCount, 1);
        assertCheck(wrongJourneyTenant, "TENANT_JOURNEY", "FAIL");
      } finally {
        await cleanupFixture(fixture);
        await cleanupFixture(foreign);
      }
    });
  });
});
