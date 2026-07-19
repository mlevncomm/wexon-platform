import { randomUUID } from "node:crypto";
import {
  ActivationStepKey,
  ActivationJourneyStepStatus,
  TableStatus,
  type Prisma,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { evaluateProductAccess } from "@/lib/wexon-core-access";
import {
  assertJourneyWritableForActor,
  completeActivationStepInTx,
  maskTaxNoForAudit,
} from "@/lib/wexpay-activation-journey";
import { lockWexPayOrgBranchLimit, lockWexPayOrgTableLimit } from "@/lib/wexpay-locks";
import {
  issueTableQrToken,
  rotateTableQrToken,
  type IssueTableQrTokenResult,
} from "@/lib/wexpay-table-qr-token";

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

  return prisma.$transaction(async (tx) => {
    const access = await evaluateProductAccess({
      organizationId: input.organizationId,
      productKey: "wexpay",
    });
    if (!access.allowed) {
      throw new ActivationWizardError("NO_ACCESS", "WexPay erişimi gerekli.");
    }

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
  });
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

  return prisma.$transaction(async (tx) => {
    await lockWexPayOrgBranchLimit(tx, input.organizationId);

    const access = await evaluateProductAccess({
      organizationId: input.organizationId,
      productKey: "wexpay",
    });
    if (!access.allowed) {
      throw new ActivationWizardError("NO_ACCESS", "WexPay erişimi gerekli.");
    }

    let restaurantId = input.existingRestaurantId?.trim() || null;
    let branchId = input.existingBranchId?.trim() || null;

    if (branchId) {
      const existing = await tx.branch.findFirst({
        where: {
          id: branchId,
          restaurant: { organizationId: input.organizationId },
        },
        select: { id: true, restaurantId: true },
      });
      if (!existing) {
        throw new ActivationWizardError("CROSS_TENANT", "Şube bulunamadı.");
      }
      restaurantId = existing.restaurantId;
      await tx.branch.update({
        where: { id: existing.id },
        data: { name: branchName, address: branchAddress, isActive: true },
      });
    } else {
      if (restaurantId) {
        const restaurant = await tx.restaurant.findFirst({
          where: { id: restaurantId, organizationId: input.organizationId },
          select: { id: true },
        });
        if (!restaurant) {
          throw new ActivationWizardError("CROSS_TENANT", "Restoran bulunamadı.");
        }
      } else {
        // Idempotent: reuse sole restaurant if name matches, else create.
        const existingRestaurant = await tx.restaurant.findFirst({
          where: { organizationId: input.organizationId, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (existingRestaurant) {
          restaurantId = existingRestaurant.id;
          await tx.restaurant.update({
            where: { id: existingRestaurant.id },
            data: { name: restaurantName },
          });
        } else {
          let slug = slugify(restaurantName);
          if (!slug) slug = `restoran-${Date.now().toString(36)}`;
          const collision = await tx.restaurant.findFirst({ where: { slug } });
          if (collision) slug = `${slug}-${Date.now().toString(36)}`;
          const created = await tx.restaurant.create({
            data: {
              organizationId: input.organizationId,
              name: restaurantName,
              slug,
              isActive: true,
            },
          });
          restaurantId = created.id;
        }
      }

      const branchCount = await tx.branch.count({
        where: { restaurant: { organizationId: input.organizationId } },
      });
      // Reuse entitlement helper via raw map if available; otherwise soft check through product access.
      const branchLimit = access.entitlementMap.branch_limit;
      if (typeof branchLimit === "number" && branchLimit >= 0 && branchCount >= branchLimit) {
        throw new ActivationWizardError("BRANCH_LIMIT", "Şube limitinize ulaştınız.");
      }

      const existingBranch = await tx.branch.findFirst({
        where: { restaurantId: restaurantId!, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (existingBranch) {
        branchId = existingBranch.id;
        await tx.branch.update({
          where: { id: existingBranch.id },
          data: { name: branchName, address: branchAddress },
        });
      } else {
        const branchSlug = slugify(branchName) || "sube";
        const createdBranch = await tx.branch.create({
          data: {
            restaurantId: restaurantId!,
            name: branchName,
            slug: branchSlug,
            address: branchAddress,
            isActive: true,
          },
        });
        branchId = createdBranch.id;
      }
    }

    await writeAuditLog(
      {
        action: "activation.branch_setup.saved",
        organizationId: input.organizationId,
        userId: input.actorUserId,
        entityType: "Branch",
        entityId: branchId!,
        source: "activation_wizard",
        metadata: { restaurantId, branchId },
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
  });
}

export type WizardIssuedQr = {
  tableId: string;
  label: string;
  seats: number;
  plaintext: string;
  publicPath: string;
  tokenPrefix: string;
};

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

  const branch = await prisma.branch.findFirst({
    where: {
      id: input.branchId,
      restaurant: { organizationId: input.organizationId },
    },
    select: { id: true },
  });
  if (!branch) {
    throw new ActivationWizardError("CROSS_TENANT", "Şube bulunamadı.");
  }

  // Create tables under lock (no plaintext tokens in DB).
  const tables = await prisma.$transaction(async (tx) => {
    await lockWexPayOrgTableLimit(tx, input.organizationId);
    const access = await evaluateProductAccess({
      organizationId: input.organizationId,
      productKey: "wexpay",
    });
    if (!access.allowed) {
      throw new ActivationWizardError("NO_ACCESS", "WexPay erişimi gerekli.");
    }

    const currentTables = await tx.restaurantTable.count({
      where: { branch: { restaurant: { organizationId: input.organizationId } } },
    });
    const tableLimit = access.entitlementMap.table_limit;
    if (typeof tableLimit === "number" && tableLimit >= 0 && currentTables + count > tableLimit) {
      throw new ActivationWizardError("TABLE_LIMIT", "Masa limitinize ulaştınız.");
    }

    const created = [];
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
      created.push(table);
    }
    return created;
  });

  const qrs: WizardIssuedQr[] = [];
  for (const table of tables) {
    const issued: IssueTableQrTokenResult = await issueTableQrToken({
      tableId: table.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
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

  // Do NOT complete TABLE_SETUP yet — user must acknowledge QR pack.
  await prisma.activationJourneyStep.update({
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
        tableIds: tables.map((t) => t.id),
        count: tables.length,
        awaitingQrAck: true,
      } as Prisma.InputJsonValue,
    },
  });

  return { qrs, journeyVersion: journey.version };
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

  const tables = await prisma.restaurantTable.findMany({
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

  for (const table of tables) {
    const active = await prisma.tableQrToken.findFirst({
      where: { tableId: table.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!active) {
      throw new ActivationWizardError("MISSING_QR", "Her masa için güvenli QR gerekli.");
    }
  }

  return prisma.$transaction(async (tx) => {
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
      safeMetadata: { branchId: input.branchId, tableCount: tables.length, qrAck: true },
    });
  });
}

export async function rotateWizardTableQr(input: {
  organizationId: string;
  actorUserId: string;
  tableId: string;
}): Promise<WizardIssuedQr> {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
  });
  if (!table) {
    throw new ActivationWizardError("CROSS_TENANT", "Masa bulunamadı.");
  }

  const issued = await rotateTableQrToken({
    tableId: table.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });

  return {
    tableId: table.id,
    label: table.label,
    seats: table.seats,
    plaintext: issued.plaintext,
    publicPath: issued.publicPath,
    tokenPrefix: issued.token.tokenPrefix,
  };
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

  if (!input.skip) {
    const openOrSent = await prisma.staffInvite.count({
      where: {
        organizationId: input.organizationId,
        OR: [
          { acceptedAt: { not: null } },
          { revokedAt: null, expiresAt: { gt: new Date() } },
        ],
      },
    });
    if (openOrSent < 1) {
      throw new ActivationWizardError(
        "NO_INVITES",
        "Devam etmek için en az bir davet gönderin veya adımı şimdilik atlayın.",
      );
    }
  }

  return prisma.$transaction(async (tx) =>
    completeActivationStepInTx(tx, {
      journeyId: journey.id,
      expectedVersion: input.expectedVersion,
      stepKey: ActivationStepKey.STAFF_INVITE,
      advanceTo: ActivationStepKey.MENU_IMPORT,
      markStatus: input.skip
        ? ActivationJourneyStepStatus.SKIPPED
        : ActivationJourneyStepStatus.COMPLETED,
      safeMetadata: { skipped: Boolean(input.skip) },
    }),
  );
}
