import { randomUUID } from "node:crypto";
import {
  ActivationStepKey,
  ActivationJourneyStepStatus,
  MembershipRole,
  MembershipStatus,
  StaffInviteDeliveryStatus,
  TableStatus,
  type Prisma,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import {
  assertJourneyWritableForActor,
  assertWizardStepMutableInTx,
  completeActivationStepInTx,
  maskTaxNoForAudit,
  ActivationJourneyError,
} from "@/lib/wexpay-activation-journey";
import {
  ActivationTxAccessError,
  assertActorManageMembershipInTx,
  assertCanonicalLimitInTx,
  assertWexPayAccessInTx,
} from "@/lib/wexpay-activation-tx-access";
import { lockWexPayOrgBranchLimit, lockWexPayOrgTableLimit } from "@/lib/wexpay-locks";
import {
  generateSecureTableQrTokenMaterial,
  issueTableQrTokenInTx,
  rotateTableQrTokenInTx,
  type IssueTableQrTokenResult,
} from "@/lib/wexpay-table-qr-token";

const WIZARD_ACTOR_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
];

function generateLegacyTableQrCode() {
  return `WXP-${randomUUID()}`;
}

export class ActivationWizardError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ActivationWizardError";
    this.code = code;
  }
}

function mapTxAccessError(error: unknown): never {
  if (error instanceof ActivationTxAccessError) {
    throw new ActivationWizardError(error.code, error.message);
  }
  if (error instanceof ActivationJourneyError) {
    throw error;
  }
  throw error;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clampText(value: string, max: number) {
  return value.trim().slice(0, max);
}

function optionalEmail(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new ActivationWizardError("INVALID_EMAIL", "Geçerli bir e-posta girin.");
  }
  return v.toLowerCase().slice(0, 120);
}

function readTableIdsFromMetadata(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const tableIds = (raw as { tableIds?: unknown }).tableIds;
  if (!Array.isArray(tableIds)) return [];
  return tableIds.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function saveBusinessProfileStep(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  name: string;
  legalName?: string | null;
  taxNo?: string | null;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
}) {
  const name = clampText(input.name, 120);
  if (name.length < 2) {
    throw new ActivationWizardError("NAME", "İşletme adı en az 2 karakter olmalıdır.");
  }

  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Gate BEFORE domain mutation — completed/past step must not rewrite Organization.
        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.BUSINESS_PROFILE,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        await tx.organization.update({
          where: { id: input.organizationId },
          data: {
            name,
            legalName: clampText(input.legalName ?? "", 160) || null,
            taxNo: clampText(input.taxNo ?? "", 32) || null,
            phone: clampText(input.phone ?? "", 32) || null,
            email: optionalEmail(input.email),
            country: clampText(input.country ?? "TR", 2).toUpperCase() || "TR",
          },
        });

        await writeAuditLog(
          {
            action: "activation.business_profile.saved",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "Organization",
            entityId: input.organizationId,
            source: "activation_wizard",
            metadata: {
              name,
              taxNoMasked: maskTaxNoForAudit(input.taxNo),
              hasLegalName: Boolean(input.legalName?.trim()),
              hasPhone: Boolean(input.phone?.trim()),
              hasEmail: Boolean(input.email?.trim()),
            },
          },
          tx,
        );

        return completeActivationStepInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.BUSINESS_PROFILE,
          advanceTo: ActivationStepKey.BRANCH_SETUP,
          safeMetadata: { saved: true },
        });
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

export async function saveBranchSetupStep(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  restaurantName: string;
  branchName: string;
  branchAddress: string;
  existingRestaurantId?: string | null;
  existingBranchId?: string | null;
}) {
  const restaurantName = clampText(input.restaurantName, 120);
  const branchName = clampText(input.branchName, 120);
  const branchAddress = clampText(input.branchAddress, 240);
  if (restaurantName.length < 2) {
    throw new ActivationWizardError("RESTAURANT_NAME", "Restoran adı zorunludur.");
  }
  if (branchName.length < 2) {
    throw new ActivationWizardError("BRANCH_NAME", "Şube adı zorunludur.");
  }
  if (branchAddress.length < 3) {
    throw new ActivationWizardError("BRANCH_ADDRESS", "Şube adresi zorunludur.");
  }

  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  const explicitRestaurantId = input.existingRestaurantId?.trim() || null;
  const explicitBranchId = input.existingBranchId?.trim() || null;

  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockWexPayOrgBranchLimit(tx, input.organizationId);

        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.BRANCH_SETUP,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        const access = await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        let restaurantId: string;
        let branchId: string;

        if (explicitBranchId) {
          const existing = await tx.branch.findFirst({
            where: {
              id: explicitBranchId,
              restaurant: { organizationId: input.organizationId },
            },
            select: { id: true, restaurantId: true },
          });
          if (!existing) {
            throw new ActivationWizardError("CROSS_TENANT", "Şube bulunamadı.");
          }
          restaurantId = existing.restaurantId;
          branchId = existing.id;
          await tx.branch.update({
            where: { id: existing.id },
            data: { name: branchName, address: branchAddress, isActive: true },
          });
          if (explicitRestaurantId && explicitRestaurantId !== restaurantId) {
            throw new ActivationWizardError("CROSS_TENANT", "Restoran/şube eşleşmesi geçersiz.");
          }
          await tx.restaurant.update({
            where: { id: restaurantId },
            data: { name: restaurantName, isActive: true },
          });
        } else if (explicitRestaurantId) {
          const restaurant = await tx.restaurant.findFirst({
            where: { id: explicitRestaurantId, organizationId: input.organizationId },
            select: { id: true },
          });
          if (!restaurant) {
            throw new ActivationWizardError("CROSS_TENANT", "Restoran bulunamadı.");
          }
          restaurantId = restaurant.id;
          await tx.restaurant.update({
            where: { id: restaurantId },
            data: { name: restaurantName, isActive: true },
          });

          const branchCount = await tx.branch.count({
            where: { restaurant: { organizationId: input.organizationId } },
          });
          assertCanonicalLimitInTx(access.entitlementMap, "branch_limit", branchCount);

          const branchSlug = slugify(branchName) || "sube";
          const createdBranch = await tx.branch.create({
            data: {
              restaurantId,
              name: branchName,
              slug: `${branchSlug}-${Date.now().toString(36)}`,
              address: branchAddress,
              isActive: true,
            },
          });
          branchId = createdBranch.id;
        } else {
          // Create path only — never rename an arbitrary "first" restaurant/branch.
          const restaurantCount = await tx.restaurant.count({
            where: { organizationId: input.organizationId },
          });
          // branch_limit gates new branches; restaurant create is unconstrained by branch_limit itself.
          const branchCount = await tx.branch.count({
            where: { restaurant: { organizationId: input.organizationId } },
          });
          assertCanonicalLimitInTx(access.entitlementMap, "branch_limit", branchCount);

          let slug = slugify(restaurantName);
          if (!slug) slug = `restoran-${Date.now().toString(36)}`;
          const collision = await tx.restaurant.findFirst({ where: { slug } });
          if (collision) slug = `${slug}-${Date.now().toString(36)}`;

          const createdRestaurant = await tx.restaurant.create({
            data: {
              organizationId: input.organizationId,
              name: restaurantName,
              slug,
              isActive: true,
            },
          });
          restaurantId = createdRestaurant.id;

          const branchSlug = slugify(branchName) || "sube";
          const createdBranch = await tx.branch.create({
            data: {
              restaurantId,
              name: branchName,
              slug: `${branchSlug}-${Date.now().toString(36)}`,
              address: branchAddress,
              isActive: true,
            },
          });
          branchId = createdBranch.id;

          void restaurantCount;
        }

        await writeAuditLog(
          {
            action: "activation.branch_setup.saved",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "Branch",
            entityId: branchId,
            source: "activation_wizard",
            metadata: { restaurantId, branchId, explicit: Boolean(explicitBranchId || explicitRestaurantId) },
          },
          tx,
        );

        return completeActivationStepInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.BRANCH_SETUP,
          advanceTo: ActivationStepKey.TABLE_SETUP,
          safeMetadata: { restaurantId, branchId },
        });
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

export type WizardIssuedQr = {
  tableId: string;
  label: string;
  seats: number;
  plaintext: string;
  publicPath: string;
  tokenPrefix: string;
};

/**
 * Atomic table + opaque QR pack.
 * Materials generated in memory; hashes written in the same TX as tables/journey/audit.
 * Double-submit with awaiting pack recovers/rotates the same tables instead of creating more.
 */
export async function createTablesWithOpaqueQr(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  branchId: string;
  count: number;
  prefix: string;
  seats: number;
  startNumber?: number;
}): Promise<{ qrs: WizardIssuedQr[]; journeyVersion: number }> {
  const count = Math.floor(input.count);
  const seats = Math.floor(input.seats);
  const prefix = clampText(input.prefix || "Masa", 40);
  const startNumber = Math.max(1, Math.floor(input.startNumber ?? 1));
  if (count < 1 || count > 50) {
    throw new ActivationWizardError("COUNT", "Masa adedi 1–50 arasında olmalıdır.");
  }
  if (seats < 1 || seats > 50) {
    throw new ActivationWizardError("SEATS", "Koltuk sayısı geçersiz.");
  }

  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  const tableStep = journey.steps.find((s) => s.stepKey === ActivationStepKey.TABLE_SETUP);
  const existingTableIds = readTableIdsFromMetadata(tableStep?.safeMetadataJson);
  const awaitingAck =
    Boolean(
      tableStep?.safeMetadataJson &&
        typeof tableStep.safeMetadataJson === "object" &&
        (tableStep.safeMetadataJson as { awaitingQrAck?: boolean }).awaitingQrAck,
    ) && existingTableIds.length > 0;

  // Recovery / idempotent path: rotate tokens for the same tables.
  if (awaitingAck) {
    return recoverWizardTableQrPack({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      expectedVersion: input.expectedVersion,
      tableIds: existingTableIds,
    });
  }

  // Pre-generate opaque materials in memory (never persist plaintext).
  const materials = Array.from({ length: count }, () => generateSecureTableQrTokenMaterial());

  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockWexPayOrgTableLimit(tx, input.organizationId);

        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.TABLE_SETUP,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        const access = await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        const branch = await tx.branch.findFirst({
          where: {
            id: input.branchId,
            restaurant: { organizationId: input.organizationId },
          },
          select: { id: true },
        });
        if (!branch) {
          throw new ActivationWizardError("CROSS_TENANT", "Şube bulunamadı.");
        }

        const bumped = await tx.activationJourney.updateMany({
          where: {
            id: journey.id,
            version: input.expectedVersion,
            currentStep: ActivationStepKey.TABLE_SETUP,
          },
          data: { version: { increment: 1 }, updatedAt: new Date() },
        });
        if (bumped.count !== 1) {
          throw new ActivationWizardError(
            "VERSION_CONFLICT",
            "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
          );
        }

        const currentTables = await tx.restaurantTable.count({
          where: { branch: { restaurant: { organizationId: input.organizationId } } },
        });
        assertCanonicalLimitInTx(access.entitlementMap, "table_limit", currentTables + count - 1);

        const qrs: WizardIssuedQr[] = [];
        const tableIds: string[] = [];

        for (let i = 0; i < count; i++) {
          const label = `${prefix} ${startNumber + i}`.trim();
          const table = await tx.restaurantTable.create({
            data: {
              branchId: input.branchId,
              label,
              seats,
              qrCode: generateLegacyTableQrCode(),
              status: TableStatus.EMPTY,
              isActive: true,
            },
          });
          tableIds.push(table.id);

          const issued = await issueTableQrTokenInTx(tx, {
            tableId: table.id,
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            material: materials[i]!,
          });

          qrs.push({
            tableId: table.id,
            label: table.label,
            seats: table.seats,
            plaintext: issued.plaintext,
            publicPath: issued.publicPath,
            tokenPrefix: issued.token.tokenPrefix,
          });
        }

        await tx.activationJourneyStep.update({
          where: {
            journeyId_stepKey: {
              journeyId: journey.id,
              stepKey: ActivationStepKey.TABLE_SETUP,
            },
          },
          data: {
            status: ActivationJourneyStepStatus.IN_PROGRESS,
            attemptCount: { increment: 1 },
            safeMetadataJson: {
              branchId: input.branchId,
              tableIds,
              count: tableIds.length,
              awaitingQrAck: true,
            } as Prisma.InputJsonValue,
          },
        });

        await writeAuditLog(
          {
            action: "activation.table_setup.pack_created",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "Branch",
            entityId: input.branchId,
            source: "activation_wizard",
            metadata: { tableCount: tableIds.length, tableIds },
          },
          tx,
        );

        return { qrs, journeyVersion: input.expectedVersion + 1 };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

export async function recoverWizardTableQrPack(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  tableIds?: string[];
}): Promise<{ qrs: WizardIssuedQr[]; journeyVersion: number }> {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  const tableStep = journey.steps.find((s) => s.stepKey === ActivationStepKey.TABLE_SETUP);
  const tableIds =
    input.tableIds && input.tableIds.length > 0
      ? input.tableIds
      : readTableIdsFromMetadata(tableStep?.safeMetadataJson);

  if (tableIds.length < 1) {
    throw new ActivationWizardError("NO_TABLES", "Kurtarılacak masa paketi yok.");
  }

  const materials = tableIds.map(() => generateSecureTableQrTokenMaterial());

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.TABLE_SETUP,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        const bumped = await tx.activationJourney.updateMany({
          where: {
            id: journey.id,
            version: input.expectedVersion,
            currentStep: ActivationStepKey.TABLE_SETUP,
          },
          data: { version: { increment: 1 }, updatedAt: new Date() },
        });
        if (bumped.count !== 1) {
          throw new ActivationWizardError(
            "VERSION_CONFLICT",
            "Kurulum başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
          );
        }

        const qrs: WizardIssuedQr[] = [];
        for (let i = 0; i < tableIds.length; i++) {
          const tableId = tableIds[i]!;
          const table = await tx.restaurantTable.findFirst({
            where: {
              id: tableId,
              branch: { restaurant: { organizationId: input.organizationId } },
            },
          });
          if (!table) {
            throw new ActivationWizardError("CROSS_TENANT", "Masa bulunamadı.");
          }

          const issued = await rotateTableQrTokenInTx(tx, {
            tableId: table.id,
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            material: materials[i],
          });

          qrs.push({
            tableId: table.id,
            label: table.label,
            seats: table.seats,
            plaintext: issued.plaintext,
            publicPath: issued.publicPath,
            tokenPrefix: issued.token.tokenPrefix,
          });
        }

        await writeAuditLog(
          {
            action: "activation.table_setup.qr_recovered",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "ActivationJourney",
            entityId: journey.id,
            source: "activation_wizard",
            metadata: { tableCount: tableIds.length, tableIds },
          },
          tx,
        );

        return { qrs, journeyVersion: input.expectedVersion + 1 };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

export async function acknowledgeTableQrPack(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  branchId: string;
}) {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  const tableStep = journey.steps.find((s) => s.stepKey === ActivationStepKey.TABLE_SETUP);
  const metadataTableIds = readTableIdsFromMetadata(tableStep?.safeMetadataJson);

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.TABLE_SETUP,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        const branch = await tx.branch.findFirst({
          where: {
            id: input.branchId,
            restaurant: { organizationId: input.organizationId },
          },
          select: { id: true },
        });
        if (!branch) {
          throw new ActivationWizardError("CROSS_TENANT", "Şube bulunamadı.");
        }

        const tables =
          metadataTableIds.length > 0
            ? await tx.restaurantTable.findMany({
                where: {
                  id: { in: metadataTableIds },
                  branchId: input.branchId,
                  branch: { restaurant: { organizationId: input.organizationId } },
                  isActive: true,
                },
                select: { id: true },
              })
            : await tx.restaurantTable.findMany({
                where: {
                  branchId: input.branchId,
                  branch: { restaurant: { organizationId: input.organizationId } },
                  isActive: true,
                },
                select: { id: true },
              });

        if (tables.length < 1) {
          throw new ActivationWizardError("NO_TABLES", "Önce masa oluşturun.");
        }
        if (metadataTableIds.length > 0 && tables.length !== metadataTableIds.length) {
          throw new ActivationWizardError("CROSS_TENANT", "Masa sahipliği doğrulanamadı.");
        }

        for (const table of tables) {
          const active = await tx.tableQrToken.findFirst({
            where: { tableId: table.id, status: "ACTIVE" },
            select: { id: true },
          });
          if (!active) {
            throw new ActivationWizardError("MISSING_QR", "Her masa için güvenli QR gerekli.");
          }
        }

        await writeAuditLog(
          {
            action: "activation.table_setup.qr_acknowledged",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "Branch",
            entityId: input.branchId,
            source: "activation_wizard",
            metadata: { tableCount: tables.length },
          },
          tx,
        );

        return completeActivationStepInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.TABLE_SETUP,
          advanceTo: ActivationStepKey.STAFF_INVITE,
          safeMetadata: {
            branchId: input.branchId,
            tableIds: tables.map((t) => t.id),
            tableCount: tables.length,
            qrAck: true,
            awaitingQrAck: false,
          },
        });
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

export async function rotateWizardTableQr(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  tableId: string;
}): Promise<WizardIssuedQr> {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  const material = generateSecureTableQrTokenMaterial();
  try {
    return await prisma.$transaction(async (tx) => {
      await assertWizardStepMutableInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.TABLE_SETUP,
      });
      await assertActorManageMembershipInTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        roles: WIZARD_ACTOR_ROLES,
      });
      await assertWexPayAccessInTx(tx, {
        organizationId: input.organizationId,
        productKey: "wexpay",
      });

      const tableStep = await tx.activationJourneyStep.findUnique({
        where: {
          journeyId_stepKey: {
            journeyId: journey.id,
            stepKey: ActivationStepKey.TABLE_SETUP,
          },
        },
        select: { safeMetadataJson: true },
      });
      const packTableIds = readTableIdsFromMetadata(tableStep?.safeMetadataJson);
      if (!packTableIds.includes(input.tableId)) {
        throw new ActivationWizardError(
          "CROSS_TENANT",
          "Masa bu kurulum paketine ait değil.",
        );
      }

      const table = await tx.restaurantTable.findFirst({
        where: {
          id: input.tableId,
          branch: { restaurant: { organizationId: input.organizationId } },
        },
      });
      if (!table) {
        throw new ActivationWizardError("CROSS_TENANT", "Masa bulunamadı.");
      }

      const issued: IssueTableQrTokenResult = await rotateTableQrTokenInTx(tx, {
        tableId: table.id,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        material,
      });

      return {
        tableId: table.id,
        label: table.label,
        seats: table.seats,
        plaintext: issued.plaintext,
        publicPath: issued.publicPath,
        tokenPrefix: issued.token.tokenPrefix,
      };
    });
  } catch (error) {
    mapTxAccessError(error);
  }
}

export async function completeStaffInviteWizardStep(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  skip?: boolean;
}) {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.STAFF_INVITE,
        });
        await assertActorManageMembershipInTx(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          roles: WIZARD_ACTOR_ROLES,
        });
        await assertWexPayAccessInTx(tx, {
          organizationId: input.organizationId,
          productKey: "wexpay",
        });

        const activeStaffCount = await tx.membership.count({
          where: {
            organizationId: input.organizationId,
            status: MembershipStatus.ACTIVE,
            role: { not: MembershipRole.OWNER },
          },
        });

        const qualifyingInvites = await tx.staffInvite.count({
          where: {
            organizationId: input.organizationId,
            OR: [
              { acceptedAt: { not: null } },
              {
                revokedAt: null,
                expiresAt: { gt: new Date() },
                deliveryStatus: StaffInviteDeliveryStatus.SENT,
              },
            ],
          },
        });

        if (input.skip) {
          // Explicit owner-only continue — staff_limit=-1 does NOT imply skip.
          if (activeStaffCount > 0) {
            throw new ActivationWizardError(
              "SKIP_FORBIDDEN",
              "Aktif personel varken bu adım atlanamaz; tamamlayın.",
            );
          }
          return completeActivationStepInTx(tx, {
            journeyId: journey.id,
            expectedVersion: input.expectedVersion,
            stepKey: ActivationStepKey.STAFF_INVITE,
            advanceTo: ActivationStepKey.MENU_IMPORT,
            markStatus: ActivationJourneyStepStatus.SKIPPED,
            safeMetadata: { skipped: true, reason: "OWNER_ONLY" },
          });
        }

        if (activeStaffCount < 1 && qualifyingInvites < 1) {
          throw new ActivationWizardError(
            "NO_INVITES",
            "Devam etmek için aktif personel, kabul edilmiş davet veya SENT davet gerekir; ya da personel eklemeden devam edin.",
          );
        }

        return completeActivationStepInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.STAFF_INVITE,
          advanceTo: ActivationStepKey.MENU_IMPORT,
          markStatus: ActivationJourneyStepStatus.COMPLETED,
          safeMetadata: {
            skipped: false,
            activeStaffCount,
            qualifyingInvites,
          },
        });
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}
