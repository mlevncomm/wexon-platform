import {
  ActivationJourneyStepStatus,
  ActivationStepKey,
  MenuImportJobStatus,
  MenuModifierSelectionType,
  MembershipRole,
  type Prisma,
} from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { coreEntitlementNumber } from "@/lib/wexon-core-access";
import {
  assertJourneyWritableForActor,
  assertWizardStepMutableInTx,
  completeActivationStepInTx,
  ActivationJourneyError,
} from "@/lib/wexpay-activation-journey";
import {
  ActivationTxAccessError,
  assertActorManageMembershipInTx,
  assertCanonicalLimitInTx,
  assertWexPayAccessInTx,
} from "@/lib/wexpay-activation-tx-access";
import { lockWexPayOrgProductLimit, lockWexPayMenuImportJob } from "@/lib/wexpay-locks";
import { countOrgProducts } from "@/lib/wexpay-tenant";
import {
  parseMenuImportFile,
  productKey,
  type MenuImportDryRunPreview,
  type MenuImportParseResult,
  type NormalizedMenuImportRow,
  MenuImportParseError,
} from "@/lib/wexpay-menu-import-parse";

const WIZARD_ACTOR_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
];

export const MENU_IMPORT_APPLY_CHUNK = 50;

const AUDIT_META_ALLOWLIST = new Set([
  "jobId",
  "branchId",
  "journeyId",
  "checksum",
  "totalRows",
  "validRows",
  "errorRows",
  "appliedRows",
  "applyCursor",
  "categoriesCreated",
  "productsCreated",
  "productsUpdated",
  "modifierGroups",
  "modifierOptions",
  "productLimit",
  "productsUsed",
  "productsAfter",
  "forceReimport",
  "reason",
  "status",
  "byteSize",
  "contentType",
  "warningCount",
  "chunkSize",
  "resumed",
]);

function safeAuditMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!AUDIT_META_ALLOWLIST.has(k)) continue;
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }
  return out;
}

export class MenuImportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MenuImportError";
    this.code = code;
  }
}

function mapTxAccessError(error: unknown): never {
  if (error instanceof ActivationTxAccessError) {
    throw new MenuImportError(error.code, error.message);
  }
  if (error instanceof ActivationJourneyError) {
    throw error;
  }
  if (error instanceof MenuImportParseError || error instanceof MenuImportError) {
    throw error;
  }
  throw error;
}

function asStaging(json: unknown): NormalizedMenuImportRow[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is NormalizedMenuImportRow =>
      !!r &&
      typeof r === "object" &&
      typeof (r as NormalizedMenuImportRow).rowNumber === "number" &&
      typeof (r as NormalizedMenuImportRow).category === "string" &&
      typeof (r as NormalizedMenuImportRow).productName === "string",
  );
}

async function assertBranchInOrgJourney(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; branchId: string; journeyId: string },
) {
  const branch = await tx.branch.findFirst({
    where: {
      id: input.branchId,
      isActive: true,
      restaurant: { organizationId: input.organizationId, isActive: true },
    },
    select: { id: true },
  });
  if (!branch) {
    throw new MenuImportError("CROSS_TENANT", "Şube bu organizasyona ait değil.");
  }

  const branchStep = await tx.activationJourneyStep.findUnique({
    where: {
      journeyId_stepKey: { journeyId: input.journeyId, stepKey: ActivationStepKey.BRANCH_SETUP },
    },
    select: { safeMetadataJson: true },
  });
  const meta =
    branchStep?.safeMetadataJson && typeof branchStep.safeMetadataJson === "object"
      ? (branchStep.safeMetadataJson as { branchId?: string })
      : {};
  if (meta.branchId && meta.branchId !== input.branchId) {
    throw new MenuImportError("BRANCH_MISMATCH", "Şube bu yolculuğa ait değil.");
  }
}

function computeDryRunPreview(
  rows: NormalizedMenuImportRow[],
  existing: {
    categories: Set<string>;
    products: Map<string, string>; // key -> productId
    modifierGroups: Set<string>;
    modifierOptions: Set<string>; // group::option
  },
  limits: { productLimit: number | null; productsUsed: number },
  errorCount: number,
  warningCount: number,
): MenuImportDryRunPreview {
  const catsNew = new Set<string>();
  const productsCreate = new Set<string>();
  const productsUpdate = new Set<string>();
  const modGroups = new Set<string>();
  const modOptions = new Set<string>();

  for (const row of rows) {
    const catKey = row.category.trim().toLocaleLowerCase("tr-TR");
    if (!existing.categories.has(catKey)) catsNew.add(catKey);

    const pk = productKey(row.category, row.productName);
    if (existing.products.has(pk) || productsCreate.has(pk)) {
      if (existing.products.has(pk)) productsUpdate.add(pk);
      else {
        /* already counted as create in this batch */
      }
    } else {
      productsCreate.add(pk);
    }

    if (row.modifierGroup) {
      const gk = row.modifierGroup.trim().toLocaleLowerCase("tr-TR");
      if (!existing.modifierGroups.has(gk)) modGroups.add(gk);
      if (row.modifierOption) {
        const ok = `${gk}::${row.modifierOption.trim().toLocaleLowerCase("tr-TR")}`;
        if (!existing.modifierOptions.has(ok)) modOptions.add(ok);
      }
    }
  }

  // Recompute create vs update more carefully for products seen only in staging
  productsCreate.clear();
  productsUpdate.clear();
  const seen = new Set<string>();
  for (const row of rows) {
    const pk = productKey(row.category, row.productName);
    if (seen.has(pk)) continue;
    seen.add(pk);
    if (existing.products.has(pk)) productsUpdate.add(pk);
    else productsCreate.add(pk);
  }

  const productsAfter = limits.productsUsed + productsCreate.size;
  const wouldExceed =
    limits.productLimit != null && limits.productLimit >= 0 && productsAfter > limits.productLimit;

  return {
    totalRows: rows.length,
    categoriesToCreate: catsNew.size,
    productsToCreate: productsCreate.size,
    productsToUpdate: productsUpdate.size,
    modifierGroups: modGroups.size,
    modifierOptions: modOptions.size,
    warningCount,
    errorCount,
    productLimit: limits.productLimit,
    productsUsed: limits.productsUsed,
    productsAfter,
    remainingAfter:
      limits.productLimit == null || limits.productLimit < 0
        ? null
        : Math.max(0, limits.productLimit - productsAfter),
    wouldExceedLimit: wouldExceed,
  };
}

export type MenuImportJobView = {
  id: string;
  status: MenuImportJobStatus;
  checksum: string;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningCount: number;
  appliedRows: number;
  applyCursor: number;
  version: number;
  forceReimport: boolean;
  lastErrorCode: string | null;
  preview: MenuImportDryRunPreview | null;
  duplicateChecksumWarning: boolean;
  priorAppliedJobId: string | null;
  dryRunAt: string | null;
  applyStartedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  rowErrors: Array<{
    rowNumber: number;
    errorCode: string;
    message: string;
  }>;
};

function toJobView(
  job: {
    id: string;
    status: MenuImportJobStatus;
    checksum: string;
    originalFileName: string;
    contentType: string;
    byteSize: number;
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningCount: number;
    appliedRows: number;
    applyCursor: number;
    version: number;
    forceReimport: boolean;
    lastErrorCode: string | null;
    previewJson: unknown;
    dryRunAt: Date | null;
    applyStartedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
    rowErrors?: Array<{ rowNumber: number; errorCode: string; message: string }>;
  },
  extra?: { duplicateChecksumWarning?: boolean; priorAppliedJobId?: string | null },
): MenuImportJobView {
  return {
    id: job.id,
    status: job.status,
    checksum: job.checksum,
    originalFileName: job.originalFileName,
    contentType: job.contentType,
    byteSize: job.byteSize,
    totalRows: job.totalRows,
    validRows: job.validRows,
    errorRows: job.errorRows,
    warningCount: job.warningCount,
    appliedRows: job.appliedRows,
    applyCursor: job.applyCursor,
    version: job.version,
    forceReimport: job.forceReimport,
    lastErrorCode: job.lastErrorCode,
    preview: (job.previewJson as MenuImportDryRunPreview | null) ?? null,
    duplicateChecksumWarning: extra?.duplicateChecksumWarning ?? false,
    priorAppliedJobId: extra?.priorAppliedJobId ?? null,
    dryRunAt: job.dryRunAt?.toISOString() ?? null,
    applyStartedAt: job.applyStartedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failedAt: job.failedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    rowErrors: (job.rowErrors ?? []).map((e) => ({
      rowNumber: e.rowNumber,
      errorCode: e.errorCode,
      message: e.message,
    })),
  };
}

export async function getActiveMenuImportJobView(input: {
  organizationId: string;
  journeyId: string;
}): Promise<MenuImportJobView | null> {
  const job = await prisma.menuImportJob.findFirst({
    where: {
      organizationId: input.organizationId,
      journeyId: input.journeyId,
      status: {
        in: [
          MenuImportJobStatus.UPLOADED,
          MenuImportJobStatus.DRY_RUN,
          MenuImportJobStatus.APPLYING,
          MenuImportJobStatus.FAILED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      rowErrors: {
        orderBy: { rowNumber: "asc" },
        take: 100,
        select: { rowNumber: true, errorCode: true, message: true },
      },
    },
  });
  if (!job) {
    const applied = await prisma.menuImportJob.findFirst({
      where: {
        organizationId: input.organizationId,
        journeyId: input.journeyId,
        status: MenuImportJobStatus.APPLIED,
      },
      orderBy: { completedAt: "desc" },
      include: {
        rowErrors: {
          orderBy: { rowNumber: "asc" },
          take: 20,
          select: { rowNumber: true, errorCode: true, message: true },
        },
      },
    });
    return applied ? toJobView(applied) : null;
  }
  return toJobView(job);
}

async function loadExistingMenuMaps(tx: Prisma.TransactionClient, branchId: string) {
  const [categories, products, groups] = await Promise.all([
    tx.menuCategory.findMany({
      where: { branchId },
      select: { id: true, name: true },
    }),
    tx.menuProduct.findMany({
      where: { branchId },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    tx.menuModifierGroup.findMany({
      where: { branchId },
      select: {
        id: true,
        name: true,
        selectionType: true,
        minSelect: true,
        maxSelect: true,
        options: { select: { id: true, name: true, priceDelta: true } },
      },
    }),
  ]);

  const categorySet = new Set(categories.map((c) => c.name.trim().toLocaleLowerCase("tr-TR")));
  const productMap = new Map<string, string>();
  for (const p of products) {
    productMap.set(productKey(p.category.name, p.name), p.id);
  }
  const groupSet = new Set(groups.map((g) => g.name.trim().toLocaleLowerCase("tr-TR")));
  const optionSet = new Set<string>();
  const optionByKey = new Map<string, { id: string; priceDelta: unknown }>();
  for (const g of groups) {
    const gk = g.name.trim().toLocaleLowerCase("tr-TR");
    for (const o of g.options) {
      const ok = `${gk}::${o.name.trim().toLocaleLowerCase("tr-TR")}`;
      optionSet.add(ok);
      optionByKey.set(ok, o);
    }
  }

  return {
    categories: categorySet,
    categoryByName: new Map(categories.map((c) => [c.name.trim().toLocaleLowerCase("tr-TR"), c])),
    products: productMap,
    productById: new Map(products.map((p) => [p.id, p])),
    modifierGroups: groupSet,
    groupByName: new Map(groups.map((g) => [g.name.trim().toLocaleLowerCase("tr-TR"), g])),
    modifierOptions: optionSet,
    optionByKey,
  };
}

/**
 * Upload → parse → dry-run staging. Does NOT write MenuCategory/Product/Modifier domain rows.
 */
export async function uploadAndDryRunMenuImport(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  branchId: string;
  buffer: Buffer;
  originalFileName: string;
  forceReimport?: boolean;
}): Promise<MenuImportJobView> {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  let parsed: MenuImportParseResult;
  try {
    parsed = await parseMenuImportFile({
      buffer: input.buffer,
      originalFileName: input.originalFileName,
    });
  } catch (error) {
    if (error instanceof MenuImportParseError) {
      throw new MenuImportError(error.code, error.message);
    }
    throw error;
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        await assertWizardStepMutableInTx(tx, {
          journeyId: journey.id,
          expectedVersion: input.expectedVersion,
          stepKey: ActivationStepKey.MENU_IMPORT,
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
        await assertBranchInOrgJourney(tx, {
          organizationId: input.organizationId,
          branchId: input.branchId,
          journeyId: journey.id,
        });

        const priorApplied = await tx.menuImportJob.findFirst({
          where: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            checksum: parsed.checksum,
            status: MenuImportJobStatus.APPLIED,
          },
          select: { id: true },
          orderBy: { completedAt: "desc" },
        });

        const duplicateChecksumWarning = Boolean(priorApplied) && !input.forceReimport;

        const existing = await loadExistingMenuMaps(tx, input.branchId);
        const productsUsed = await countOrgProducts(tx, input.organizationId);
        const productLimit = coreEntitlementNumber(access.entitlementMap, "product_limit");

        const preview = computeDryRunPreview(
          parsed.rows,
          existing,
          {
            productLimit: productLimit ?? null,
            productsUsed,
          },
          parsed.errorRows,
          parsed.warnings.length,
        );

        // Cancel any prior open job for this journey (replace staging).
        await tx.menuImportJob.updateMany({
          where: {
            journeyId: journey.id,
            status: {
              in: [
                MenuImportJobStatus.UPLOADED,
                MenuImportJobStatus.DRY_RUN,
                MenuImportJobStatus.FAILED,
              ],
            },
          },
          data: {
            status: MenuImportJobStatus.CANCELLED,
            cancelledAt: new Date(),
            lastErrorCode: "SUPERSEDED",
          },
        });

        const job = await tx.menuImportJob.create({
          data: {
            organizationId: input.organizationId,
            journeyId: journey.id,
            branchId: input.branchId,
            createdByUserId: input.actorUserId,
            status: MenuImportJobStatus.DRY_RUN,
            checksum: parsed.checksum,
            originalFileName: parsed.originalFileName,
            contentType: parsed.contentType,
            byteSize: parsed.byteSize,
            normalizedStagingJson: parsed.rows,
            totalRows: parsed.totalRows,
            validRows: parsed.validRows,
            errorRows: parsed.errorRows,
            warningCount: parsed.warnings.length,
            previewJson: preview,
            forceReimport: Boolean(input.forceReimport),
            dryRunAt: new Date(),
            rowErrors: {
              create: parsed.errors.slice(0, 500).map((e) => ({
                rowNumber: e.rowNumber,
                errorCode: e.errorCode,
                message: e.message.slice(0, 300),
                safeContextJson: e.safeContextJson ?? undefined,
              })),
            },
          },
          include: {
            rowErrors: {
              orderBy: { rowNumber: "asc" },
              take: 100,
              select: { rowNumber: true, errorCode: true, message: true },
            },
          },
        });

        await writeAuditLog(
          {
            action: "activation.menu_import.dry_run",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "MenuImportJob",
            entityId: job.id,
            source: "activation_wizard",
            metadata: safeAuditMeta({
              jobId: job.id,
              branchId: input.branchId,
              journeyId: journey.id,
              checksum: parsed.checksum,
              totalRows: parsed.totalRows,
              validRows: parsed.validRows,
              errorRows: parsed.errorRows,
              warningCount: parsed.warnings.length,
              productsToCreate: preview.productsToCreate,
              productsToUpdate: preview.productsToUpdate,
              productLimit: preview.productLimit ?? -1,
              productsUsed: preview.productsUsed,
              forceReimport: Boolean(input.forceReimport),
              byteSize: parsed.byteSize,
              contentType: parsed.contentType,
            }),
          },
          tx,
        );

        return toJobView(job, {
          duplicateChecksumWarning,
          priorAppliedJobId: priorApplied?.id ?? null,
        });
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    mapTxAccessError(error);
  }
}

/**
 * Apply one chunk (~50 staging rows). Safe to call repeatedly for resume.
 * Does not advance journey until all valid rows applied.
 */
export async function applyMenuImportChunk(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  jobId: string;
  jobExpectedVersion: number;
  confirmApply: boolean;
  forceReimport?: boolean;
}): Promise<{ job: MenuImportJobView; done: boolean; journeyVersion?: number }> {
  if (!input.confirmApply) {
    throw new MenuImportError("CONFIRM_REQUIRED", "Uygulamak için onay gerekli.");
  }

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
          stepKey: ActivationStepKey.MENU_IMPORT,
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

        await lockWexPayMenuImportJob(tx, input.jobId);
        await lockWexPayOrgProductLimit(tx, input.organizationId);

        const job = await tx.menuImportJob.findFirst({
          where: { id: input.jobId, organizationId: input.organizationId, journeyId: journey.id },
        });
        if (!job) {
          throw new MenuImportError("JOB_NOT_FOUND", "İçe aktarma işi bulunamadı.");
        }
        if (job.version !== input.jobExpectedVersion) {
          throw new MenuImportError("STALE_JOB", "İş güncel değil; sayfayı yenileyin.");
        }
        if (job.status === MenuImportJobStatus.CANCELLED) {
          throw new MenuImportError("JOB_CANCELLED", "İptal edilen iş uygulanamaz.");
        }
        if (job.status === MenuImportJobStatus.APPLIED) {
          return {
            job: toJobView(job),
            done: true,
            journeyVersion: undefined,
          };
        }
        if (
          job.status !== MenuImportJobStatus.DRY_RUN &&
          job.status !== MenuImportJobStatus.APPLYING &&
          job.status !== MenuImportJobStatus.FAILED
        ) {
          throw new MenuImportError("JOB_STATUS", "Bu iş uygulanamaz durumda.");
        }

        await assertBranchInOrgJourney(tx, {
          organizationId: input.organizationId,
          branchId: job.branchId,
          journeyId: journey.id,
        });

        if (job.errorRows > 0 && job.validRows < 1) {
          throw new MenuImportError("HAS_ERRORS", "Geçerli satır yok; dosyayı düzeltin.");
        }

        const priorApplied = await tx.menuImportJob.findFirst({
          where: {
            organizationId: input.organizationId,
            branchId: job.branchId,
            checksum: job.checksum,
            status: MenuImportJobStatus.APPLIED,
            id: { not: job.id },
          },
          select: { id: true },
        });
        if (priorApplied && !job.forceReimport && !input.forceReimport) {
          throw new MenuImportError(
            "DUPLICATE_CHECKSUM",
            "Aynı dosya daha önce uygulandı. Yeniden içe aktarmak için onaylayın.",
          );
        }

        const staging = asStaging(job.normalizedStagingJson);
        const cursor = job.applyCursor;
        if (cursor >= staging.length) {
          // Nothing left — finalize
          return finalizeApplied(tx, {
            job,
            journeyId: journey.id,
            expectedVersion: input.expectedVersion,
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            resumed: job.status === MenuImportJobStatus.FAILED || job.applyCursor > 0,
          });
        }

        const chunk = staging.slice(cursor, cursor + MENU_IMPORT_APPLY_CHUNK);
        const maps = await loadExistingMenuMaps(tx, job.branchId);

        let appliedInChunk = 0;
        let productsCreated = 0;
        let productsUpdated = 0;
        let categoriesCreated = 0;
        let modifierGroups = 0;
        let modifierOptions = 0;

        for (const row of chunk) {
          const catKey = row.category.trim().toLocaleLowerCase("tr-TR");
          let category = maps.categoryByName.get(catKey);
          if (!category) {
            const last = await tx.menuCategory.findFirst({
              where: { branchId: job.branchId },
              orderBy: { sortOrder: "desc" },
              select: { sortOrder: true },
            });
            category = await tx.menuCategory.create({
              data: {
                branchId: job.branchId,
                name: row.category,
                sortOrder: (last?.sortOrder ?? -1) + 1,
                isActive: true,
              },
            });
            maps.categoryByName.set(catKey, category);
            maps.categories.add(catKey);
            categoriesCreated += 1;
          }

          const pk = productKey(row.category, row.productName);
          let productId = maps.products.get(pk);
          if (productId) {
            await tx.menuProduct.update({
              where: { id: productId },
              data: {
                categoryId: category.id,
                description: row.description,
                price: row.price,
                currency: "TRY",
                isActive: row.isActive,
                inStock: row.inStock,
              },
            });
            productsUpdated += 1;
          } else {
            const used = await countOrgProducts(tx, input.organizationId);
            assertCanonicalLimitInTx(access.entitlementMap, "product_limit", used);

            const last = await tx.menuProduct.findFirst({
              where: { branchId: job.branchId },
              orderBy: { sortOrder: "desc" },
              select: { sortOrder: true },
            });
            const created = await tx.menuProduct.create({
              data: {
                branchId: job.branchId,
                categoryId: category.id,
                name: row.productName,
                description: row.description,
                price: row.price,
                currency: "TRY",
                isActive: row.isActive,
                inStock: row.inStock,
                sortOrder: (last?.sortOrder ?? -1) + 1,
              },
            });
            productId = created.id;
            maps.products.set(pk, productId);
            productsCreated += 1;
          }

          if (row.modifierGroup) {
            const gk = row.modifierGroup.trim().toLocaleLowerCase("tr-TR");
            let group = maps.groupByName.get(gk);
            const selectionType =
              row.selectionType === "MULTI"
                ? MenuModifierSelectionType.MULTI
                : row.selectionType === "SINGLE"
                  ? MenuModifierSelectionType.SINGLE
                  : null;
            const minSelect = row.minSelect;
            const maxSelect = row.maxSelect;

            if (!group) {
              const createdType = selectionType ?? MenuModifierSelectionType.SINGLE;
              const createdMin = minSelect ?? 0;
              const createdMax =
                maxSelect ?? (createdType === MenuModifierSelectionType.SINGLE ? 1 : 1);
              group = await tx.menuModifierGroup.create({
                data: {
                  branchId: job.branchId,
                  name: row.modifierGroup,
                  selectionType: createdType,
                  minSelect: createdMin,
                  maxSelect: createdMax,
                },
                include: {
                  options: { select: { id: true, name: true, priceDelta: true } },
                },
              });
              maps.groupByName.set(gk, group);
              maps.modifierGroups.add(gk);
              modifierGroups += 1;
            } else if (selectionType != null || minSelect != null || maxSelect != null) {
              const nextType = selectionType ?? group.selectionType;
              const nextMin = minSelect ?? group.minSelect;
              const nextMax =
                maxSelect ??
                (nextType === MenuModifierSelectionType.SINGLE ? 1 : group.maxSelect);
              group = await tx.menuModifierGroup.update({
                where: { id: group.id },
                data: {
                  selectionType: nextType,
                  minSelect: nextMin,
                  maxSelect: nextMax,
                },
                include: {
                  options: { select: { id: true, name: true, priceDelta: true } },
                },
              });
              maps.groupByName.set(gk, group);
              modifierGroups += 1;
            }

            const existingLink = await tx.menuProductModifierGroup.findUnique({
              where: { productId_groupId: { productId, groupId: group.id } },
              select: { id: true },
            });
            if (!existingLink) {
              await tx.menuProductModifierGroup.create({
                data: {
                  branchId: job.branchId,
                  productId,
                  groupId: group.id,
                },
              });
            }

            if (row.modifierOption) {
              const ok = `${gk}::${row.modifierOption.trim().toLocaleLowerCase("tr-TR")}`;
              const existingOpt = maps.optionByKey.get(ok);
              const priceDelta = row.modifierPriceDelta ?? "0.00";
              if (!existingOpt) {
                const created = await tx.menuModifierOption.create({
                  data: {
                    groupId: group.id,
                    name: row.modifierOption,
                    priceDelta,
                  },
                });
                maps.modifierOptions.add(ok);
                maps.optionByKey.set(ok, created);
                modifierOptions += 1;
              } else {
                await tx.menuModifierOption.update({
                  where: { id: existingOpt.id },
                  data: { priceDelta },
                });
                maps.optionByKey.set(ok, { ...existingOpt, priceDelta });
                modifierOptions += 1;
              }
            }
          }

          appliedInChunk += 1;
        }

        const newCursor = cursor + appliedInChunk;
        const newApplied = job.appliedRows + appliedInChunk;
        const done = newCursor >= staging.length;

        if (done) {
          return finalizeApplied(tx, {
            job: {
              ...job,
              appliedRows: newApplied,
              applyCursor: newCursor,
              forceReimport: job.forceReimport || Boolean(input.forceReimport),
            },
            journeyId: journey.id,
            expectedVersion: input.expectedVersion,
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            resumed: cursor > 0 || job.status === MenuImportJobStatus.FAILED,
            stats: {
              categoriesCreated,
              productsCreated,
              productsUpdated,
              modifierGroups,
              modifierOptions,
            },
          });
        }

        const updated = await tx.menuImportJob.update({
          where: { id: job.id },
          data: {
            status: MenuImportJobStatus.APPLYING,
            appliedRows: newApplied,
            applyCursor: newCursor,
            version: { increment: 1 },
            applyStartedAt: job.applyStartedAt ?? new Date(),
            lastErrorCode: null,
            forceReimport: job.forceReimport || Boolean(input.forceReimport),
            failedAt: null,
          },
          include: {
            rowErrors: {
              orderBy: { rowNumber: "asc" },
              take: 50,
              select: { rowNumber: true, errorCode: true, message: true },
            },
          },
        });

        await writeAuditLog(
          {
            action: "activation.menu_import.apply_chunk",
            organizationId: input.organizationId,
            userId: input.actorUserId,
            entityType: "MenuImportJob",
            entityId: job.id,
            source: "activation_wizard",
            metadata: safeAuditMeta({
              jobId: job.id,
              applyCursor: newCursor,
              appliedRows: newApplied,
              chunkSize: appliedInChunk,
              categoriesCreated,
              productsCreated,
              productsUpdated,
              modifierGroups,
              modifierOptions,
              resumed: cursor > 0,
            }),
          },
          tx,
        );

        return { job: toJobView(updated), done: false };
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    // Chunk TX rolled back domain writes; persist FAILED + prior cursor in a new TX.
    const code =
      error instanceof ActivationTxAccessError
        ? error.code
        : error instanceof MenuImportError
          ? error.code
          : error instanceof ActivationJourneyError
            ? error.code
            : "APPLY_FAILED";
    if (
      code !== "STALE_JOB" &&
      code !== "JOB_CANCELLED" &&
      code !== "JOB_NOT_FOUND" &&
      code !== "DUPLICATE_CHECKSUM" &&
      code !== "CONFIRM_REQUIRED" &&
      code !== "STALE"
    ) {
      await prisma.menuImportJob
        .updateMany({
          where: {
            id: input.jobId,
            organizationId: input.organizationId,
            status: {
              in: [
                MenuImportJobStatus.DRY_RUN,
                MenuImportJobStatus.APPLYING,
                MenuImportJobStatus.FAILED,
              ],
            },
          },
          data: {
            status: MenuImportJobStatus.FAILED,
            failedAt: new Date(),
            lastErrorCode: code.slice(0, 64),
            version: { increment: 1 },
          },
        })
        .catch(() => undefined);
    }
    mapTxAccessError(error);
  }
}

async function finalizeApplied(
  tx: Prisma.TransactionClient,
  input: {
    job: {
      id: string;
      branchId: string;
      checksum: string;
      appliedRows: number;
      applyCursor: number;
      forceReimport: boolean;
      totalRows: number;
      validRows: number;
      version: number;
    };
    journeyId: string;
    expectedVersion: number;
    organizationId: string;
    actorUserId: string;
    resumed: boolean;
    stats?: {
      categoriesCreated: number;
      productsCreated: number;
      productsUpdated: number;
      modifierGroups: number;
      modifierOptions: number;
    };
  },
) {
  const completed = await completeActivationStepInTx(tx, {
    journeyId: input.journeyId,
    expectedVersion: input.expectedVersion,
    stepKey: ActivationStepKey.MENU_IMPORT,
    advanceTo: ActivationStepKey.PAYMENT_PROVIDER,
    markStatus: ActivationJourneyStepStatus.COMPLETED,
    safeMetadata: {
      jobId: input.job.id,
      branchId: input.job.branchId,
      appliedRows: input.job.appliedRows,
      checksum: input.job.checksum.slice(0, 16),
    },
  });

  const updated = await tx.menuImportJob.update({
    where: { id: input.job.id },
    data: {
      status: MenuImportJobStatus.APPLIED,
      appliedRows: input.job.appliedRows,
      applyCursor: input.job.applyCursor,
      version: { increment: 1 },
      completedAt: new Date(),
      failedAt: null,
      lastErrorCode: null,
      forceReimport: input.job.forceReimport,
    },
    include: {
      rowErrors: {
        orderBy: { rowNumber: "asc" },
        take: 20,
        select: { rowNumber: true, errorCode: true, message: true },
      },
    },
  });

  await writeAuditLog(
    {
      action: "activation.menu_import.applied",
      organizationId: input.organizationId,
      userId: input.actorUserId,
      entityType: "MenuImportJob",
      entityId: input.job.id,
      source: "activation_wizard",
      metadata: safeAuditMeta({
        jobId: input.job.id,
        branchId: input.job.branchId,
        checksum: input.job.checksum,
        appliedRows: input.job.appliedRows,
        totalRows: input.job.totalRows,
        validRows: input.job.validRows,
        resumed: input.resumed,
        categoriesCreated: input.stats?.categoriesCreated ?? 0,
        productsCreated: input.stats?.productsCreated ?? 0,
        productsUpdated: input.stats?.productsUpdated ?? 0,
        modifierGroups: input.stats?.modifierGroups ?? 0,
        modifierOptions: input.stats?.modifierOptions ?? 0,
        status: "APPLIED",
      }),
    },
    tx,
  );

  return {
    job: toJobView(updated),
    done: true,
    journeyVersion: completed.version,
  };
}

/** @deprecated Unbounded multi-chunk apply removed — use applyMenuImportChunk per request. */
export async function applyMenuImportUntilDone(): Promise<never> {
  throw new MenuImportError(
    "APPLY_UNBOUNDED_REMOVED",
    "Tek istekte tüm satırlar uygulanmaz; applyMenuImportChunk kullanın.",
  );
}

export async function cancelMenuImportJob(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  jobId: string;
  jobExpectedVersion: number;
}): Promise<MenuImportJobView> {
  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      await assertWizardStepMutableInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.MENU_IMPORT,
      });
      await assertActorManageMembershipInTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        roles: WIZARD_ACTOR_ROLES,
      });
      await lockWexPayMenuImportJob(tx, input.jobId);

      const job = await tx.menuImportJob.findFirst({
        where: { id: input.jobId, organizationId: input.organizationId, journeyId: journey.id },
      });
      if (!job) throw new MenuImportError("JOB_NOT_FOUND", "İş bulunamadı.");
      if (job.version !== input.jobExpectedVersion) {
        throw new MenuImportError("STALE_JOB", "İş güncel değil.");
      }
      if (job.status === MenuImportJobStatus.APPLIED) {
        throw new MenuImportError("ALREADY_APPLIED", "Uygulanmış iş iptal edilemez.");
      }
      if (job.status === MenuImportJobStatus.CANCELLED) {
        return toJobView(job);
      }

      const updated = await tx.menuImportJob.update({
        where: { id: job.id },
        data: {
          status: MenuImportJobStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
          lastErrorCode: "CANCELLED",
        },
        include: {
          rowErrors: {
            take: 20,
            select: { rowNumber: true, errorCode: true, message: true },
          },
        },
      });

      await writeAuditLog(
        {
          action: "activation.menu_import.cancelled",
          organizationId: input.organizationId,
          userId: input.actorUserId,
          entityType: "MenuImportJob",
          entityId: job.id,
          source: "activation_wizard",
          metadata: safeAuditMeta({
            jobId: job.id,
            reason: "user_cancel",
            appliedRows: job.appliedRows,
          }),
        },
        tx,
      );

      return toJobView(updated);
    });
  } catch (error) {
    mapTxAccessError(error);
  }
}

/** Explicit empty-start: skip MENU_IMPORT with confirmation. */
export async function skipMenuImportEmptyStart(input: {
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  confirmEmpty: boolean;
}) {
  if (!input.confirmEmpty) {
    throw new MenuImportError("CONFIRM_REQUIRED", "Boş menüyle devam için onay gerekli.");
  }

  const journey = await assertJourneyWritableForActor({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    expectedVersion: input.expectedVersion,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      await assertWizardStepMutableInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.MENU_IMPORT,
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

      await writeAuditLog(
        {
          action: "activation.menu_import.empty_start",
          organizationId: input.organizationId,
          userId: input.actorUserId,
          entityType: "ActivationJourney",
          entityId: journey.id,
          source: "activation_wizard",
          metadata: safeAuditMeta({
            reason: "explicit_user_empty_start",
            journeyId: journey.id,
          }),
        },
        tx,
      );

      return completeActivationStepInTx(tx, {
        journeyId: journey.id,
        expectedVersion: input.expectedVersion,
        stepKey: ActivationStepKey.MENU_IMPORT,
        advanceTo: ActivationStepKey.PAYMENT_PROVIDER,
        markStatus: ActivationJourneyStepStatus.SKIPPED,
        safeMetadata: {
          skipped: true,
          reason: "EXPLICIT_EMPTY_START",
        },
      });
    });
  } catch (error) {
    mapTxAccessError(error);
  }
}
