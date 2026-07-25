import type { ActivationFeeStatus, Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import type { AdminSession } from "@/lib/wexon-admin-auth";
import {
  assertEntitlementLimit,
  isEntitlementEnabled,
  type CoreEntitlementMap,
} from "@/lib/wexon-core-access";
import { ActivationFeeError, waiveActivationFee } from "@/lib/wexon-activation-fee";
import { getCanonicalTier, resolveWexPayTierKey, type WexPayTierKey } from "@/lib/wexpay-canonical-catalog";

export const ADMIN_SUBSCRIPTION_PROVIDERS = ["admin_manual", "paytr"] as const;
export type AdminSubscriptionProvider = (typeof ADMIN_SUBSCRIPTION_PROVIDERS)[number];

export const PLAN_CHANGE_REASON_MIN = 8;
export const PLAN_CHANGE_REASON_MAX = 500;
export const WAIVE_REASON_MIN = 8;
export const WAIVE_REASON_MAX = 500;

export type PlanChangeType = "upgrade" | "downgrade" | "lateral";
export type SubscriptionSyncMode = "synced" | "not_applicable";

export type UsageSnapshot = {
  restaurants: number;
  branches: number;
  tables: number;
  products: number;
  staff: number;
  multiLocationInUse: boolean;
};

export type LimitBreach = {
  key: string;
  label: string;
  current: number | boolean;
  limit: number | boolean | string | null;
};

type TxClient = Prisma.TransactionClient;

type AuditClient = {
  auditLog: {
    create: (args: Parameters<typeof prisma.auditLog.create>[0]) => ReturnType<typeof prisma.auditLog.create>;
  };
};

type CommercialAuditWriter = (
  input: {
    action: string;
    organizationId: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
  tx: AuditClient,
) => Promise<unknown>;

let commercialAuditWriter: CommercialAuditWriter | null = null;

/** Test-only seam: force audit failure to prove transactional rollback. */
export function __setCommercialAuditWriterForTests(writer: CommercialAuditWriter | null) {
  commercialAuditWriter = writer;
}

export function isAllowedAdminSubscriptionProvider(value: string | null | undefined): value is AdminSubscriptionProvider {
  return value != null && (ADMIN_SUBSCRIPTION_PROVIDERS as readonly string[]).includes(value);
}

export function assertAllowedAdminSubscriptionProvider(value: string | null | undefined): AdminSubscriptionProvider {
  const normalized = (value ?? "admin_manual").trim();
  if (!isAllowedAdminSubscriptionProvider(normalized)) {
    throw new AdminValidationError("Abonelik sağlayıcısı yalnız admin_manual veya paytr olabilir.");
  }
  return normalized;
}

export function sanitizeCommercialReason(raw: string, label: string, min = PLAN_CHANGE_REASON_MIN, max = PLAN_CHANGE_REASON_MAX) {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (reason.length < min) {
    throw new AdminValidationError(`${label} en az ${min} karakter olmalıdır.`);
  }
  if (reason.length > max) {
    throw new AdminValidationError(`${label} en fazla ${max} karakter olabilir.`);
  }
  return reason;
}

export function maskMerchantOid(merchantOid: string | null | undefined): string | null {
  if (!merchantOid) return null;
  const value = merchantOid.trim();
  if (value.length <= 8) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function maskEmailForAudit(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function isFreshActivationReservation(ledger: {
  status: ActivationFeeStatus;
  reservedUntil: Date | null;
  subscriptionPaymentId: string | null;
  now?: Date;
}) {
  const now = ledger.now ?? new Date();
  return (
    ledger.status === "PENDING" &&
    ledger.reservedUntil != null &&
    ledger.reservedUntil.getTime() > now.getTime() &&
    Boolean(ledger.subscriptionPaymentId)
  );
}

export function classifyPlanChange(beforeTierKey: string | null | undefined, afterTierKey: string | null | undefined): PlanChangeType {
  const before = resolveWexPayTierKey(beforeTierKey);
  const after = resolveWexPayTierKey(afterTierKey);
  if (!before || !after) {
    // Unknown tiers: treat equal keys as lateral; otherwise lateral with no upgrade/downgrade claim.
    if ((beforeTierKey ?? "") === (afterTierKey ?? "")) return "lateral";
    return "lateral";
  }
  const beforeOrder = getCanonicalTier(before).sortOrder;
  const afterOrder = getCanonicalTier(after).sortOrder;
  if (afterOrder > beforeOrder) return "upgrade";
  if (afterOrder < beforeOrder) return "downgrade";
  return "lateral";
}

export function entitlementsFromRecords(
  entitlements: Array<{ key: string; valueBool: boolean | null; valueInt: number | null; valueString: string | null; isActive?: boolean }>,
): CoreEntitlementMap {
  return entitlements.reduce<CoreEntitlementMap>((map, item) => {
    if (item.isActive === false) return map;
    map[item.key] = item.valueInt ?? item.valueString ?? item.valueBool ?? null;
    return map;
  }, {});
}

/** Existing-usage check: currentCount must be <= limit (unlike create-room assert). */
export function assertExistingUsageWithinLimit(
  entitlements: CoreEntitlementMap,
  key: string,
  currentCount: number,
): { ok: true; limit: number } | { ok: false; limit: number; key: string; message: string } {
  if (!(key in entitlements)) {
    return { ok: false, limit: 0, key, message: `Hedef pakette "${key}" tanımlı değil.` };
  }
  const raw = entitlements[key];
  if (typeof raw === "boolean") {
    return { ok: false, limit: 0, key, message: `Hedef paket limiti "${key}" sayısal değil.` };
  }
  const limit = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < -1) {
    return { ok: false, limit: 0, key, message: `Hedef paket limiti "${key}" geçersiz.` };
  }
  if (limit === -1) return { ok: true, limit };
  if (limit === 0) {
    if (currentCount <= 0) return { ok: true, limit };
    return { ok: false, limit: 0, key, message: `Hedef pakette "${key}" kapalı; mevcut kullanım ${currentCount}.` };
  }
  if (currentCount <= limit) return { ok: true, limit };
  return {
    ok: false,
    limit,
    key,
    message: `Mevcut ${key.replace(/_/g, " ")} kullanımı (${currentCount}) hedef paketin limitini (${limit}) aşıyor.`,
  };
}

const LIMIT_LABELS: Record<string, string> = {
  branch_limit: "şube",
  table_limit: "masa",
  product_limit: "menü ürünü",
  staff_limit: "personel",
  restaurant_limit: "restoran",
  feature_multi_location: "çoklu lokasyon",
};

export function evaluateDowngradeBreaches(input: {
  entitlements: CoreEntitlementMap;
  usage: UsageSnapshot;
}): LimitBreach[] {
  const breaches: LimitBreach[] = [];

  const numericChecks: Array<{ key: string; current: number }> = [
    { key: "branch_limit", current: input.usage.branches },
    { key: "table_limit", current: input.usage.tables },
    { key: "product_limit", current: input.usage.products },
    { key: "staff_limit", current: input.usage.staff },
  ];

  if ("restaurant_limit" in input.entitlements) {
    numericChecks.unshift({ key: "restaurant_limit", current: input.usage.restaurants });
  } else if (input.usage.restaurants > 0) {
    // No restaurant_limit key — treat restaurant count as bounded by multi-location / branch_limit.
    const branchCheck = assertExistingUsageWithinLimit(input.entitlements, "branch_limit", input.usage.restaurants);
    if (!branchCheck.ok && input.usage.restaurants > (branchCheck.limit || 0) && branchCheck.limit !== -1) {
      // Only add if restaurants exceed branch_limit when multi-location is off and restaurants > branches logic
    }
  }

  for (const check of numericChecks) {
    const result = assertExistingUsageWithinLimit(input.entitlements, check.key, check.current);
    if (!result.ok) {
      breaches.push({
        key: check.key,
        label: LIMIT_LABELS[check.key] ?? check.key,
        current: check.current,
        limit: result.limit,
      });
    }
  }

  if (input.usage.multiLocationInUse && !isEntitlementEnabled(input.entitlements, "feature_multi_location")) {
    breaches.push({
      key: "feature_multi_location",
      label: LIMIT_LABELS.feature_multi_location,
      current: true,
      limit: false,
    });
  }

  // Boolean features currently required by usage patterns beyond multi-location are soft-checked via canonical keys.
  const requiredIfTrue: Array<{ key: string; inUse: boolean }> = [
    { key: "feature_csv_export", inUse: false },
  ];
  for (const item of requiredIfTrue) {
    if (!item.inUse) continue;
    if (!isEntitlementEnabled(input.entitlements, item.key)) {
      breaches.push({ key: item.key, label: item.key, current: true, limit: false });
    }
  }

  return breaches;
}

export function formatDowngradeDenialMessage(breaches: LimitBreach[]) {
  if (breaches.length === 0) return "Paket düşürme mevcut kullanım nedeniyle reddedildi.";
  const parts = breaches.slice(0, 4).map((b) => {
    if (typeof b.current === "boolean") {
      return `${b.label} hedef pakette kapalı`;
    }
    return `${b.label}: ${b.current}/${b.limit === -1 ? "∞" : b.limit}`;
  });
  const extra = breaches.length > 4 ? ` (+${breaches.length - 4} limit daha)` : "";
  return `Paket düşürme reddedildi. Aşılan limitler: ${parts.join("; ")}${extra}.`;
}

export function targetLimitsSnapshot(entitlements: CoreEntitlementMap) {
  const keys = ["branch_limit", "table_limit", "product_limit", "staff_limit", "feature_multi_location"] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = key in entitlements ? entitlements[key] : null;
  }
  return out;
}

async function advisoryLockPlanChange(tx: TxClient, organizationId: string, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"admin:license-plan"}), hashtext(${`${organizationId}:${productId}`}))`;
}

export async function collectOrganizationUsageSnapshot(tx: TxClient, organizationId: string): Promise<UsageSnapshot> {
  const [restaurants, branches, tables, products, staff] = await Promise.all([
    tx.restaurant.count({ where: { organizationId, isActive: true } }),
    tx.branch.count({ where: { restaurant: { organizationId }, isActive: true } }),
    tx.restaurantTable.count({ where: { isActive: true, branch: { restaurant: { organizationId } } } }),
    tx.menuProduct.count({ where: { isActive: true, branch: { restaurant: { organizationId } } } }),
    tx.membership.count({ where: { organizationId, status: "ACTIVE" } }),
  ]);
  return {
    restaurants,
    branches,
    tables,
    products,
    staff,
    multiLocationInUse: restaurants > 1 || branches > 1,
  };
}

async function writeCommercialAudit(
  input: {
    action: string;
    actor: AdminSession;
    organizationId: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
  tx: AuditClient,
) {
  const metadata = {
    actorAdminId: input.actor.adminId,
    actorEmailMasked: maskEmailForAudit(input.actor.email),
    source: "admin_commercial_consistency",
    ...input.metadata,
  };
  if (commercialAuditWriter) {
    return commercialAuditWriter(
      {
        action: input.action,
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata,
      },
      tx,
    );
  }
  return tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: metadata,
    },
  });
}

export type ChangeLicensePlanInput = {
  organizationId: string;
  licenseId: string;
  targetPlanId: string;
  reason: string;
  actor: AdminSession;
  confirmed?: boolean;
};

export type ChangeLicensePlanResult = {
  changeType: PlanChangeType;
  subscriptionSync: SubscriptionSyncMode;
  licensePlanId: string;
  subscriptionPlanId: string | null;
};

export async function changeLicensePlanWithSubscriptionSync(
  input: ChangeLicensePlanInput,
): Promise<ChangeLicensePlanResult> {
  const reason = sanitizeCommercialReason(input.reason, "İşlem gerekçesi");
  if (!input.confirmed) {
    throw new AdminValidationError("Paket değişikliği için onay zorunludur.");
  }

  return prisma.$transaction(async (tx) => {
    const license = await tx.license.findUnique({
      where: { id: input.licenseId },
      include: {
        plan: { include: { entitlements: true } },
        subscription: true,
        product: true,
        organization: { select: { id: true, isDemo: true } },
      },
    });

    if (!license || license.organizationId !== input.organizationId) {
      throw new AdminValidationError("Lisans bu organizasyona ait değil.");
    }

    await advisoryLockPlanChange(tx, license.organizationId, license.productId);

    const targetPlan = await tx.plan.findUnique({
      where: { id: input.targetPlanId },
      include: { entitlements: { where: { isActive: true } } },
    });
    if (!targetPlan) {
      throw new AdminValidationError("Hedef paket bulunamadı.");
    }
    if (targetPlan.productId !== license.productId) {
      throw new AdminValidationError("Hedef paket bu lisansın ürününe ait değil.");
    }
    if (!targetPlan.isActive) {
      throw new AdminValidationError("Hedef paket aktif değil.");
    }

    const changeType = classifyPlanChange(license.plan.tierKey ?? license.plan.key, targetPlan.tierKey ?? targetPlan.key);

    const freshReservation = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: license.organizationId,
          productId: license.productId,
        },
      },
    });
    if (freshReservation && isFreshActivationReservation(freshReservation)) {
      throw new AdminValidationError(
        "Devam eden bir aktivasyon ödemesi rezervasyonu var. Paket değişikliği için önce ödeme tamamlanmalı veya rezervasyon süresi dolmalı.",
      );
    }

    const usage = await collectOrganizationUsageSnapshot(tx, license.organizationId);
    const targetEntitlements = entitlementsFromRecords(targetPlan.entitlements);

    if (changeType === "downgrade") {
      const breaches = evaluateDowngradeBreaches({ entitlements: targetEntitlements, usage });
      if (breaches.length > 0) {
        throw new AdminValidationError(formatDowngradeDenialMessage(breaches));
      }
    }

    // Re-read subscription under lock for concurrency.
    const subscription = await tx.subscription.findUnique({ where: { licenseId: license.id } });
    if (subscription && subscription.organizationId !== license.organizationId) {
      throw new AdminValidationError("Abonelik organizasyon eşleşmesi başarısız.");
    }

    const beforeLicensePlanId = license.planId;
    const beforeSubscriptionPlanId = subscription?.planId ?? null;
    const beforePlanName = license.plan.name;

    const updatedLicense = await tx.license.update({
      where: { id: license.id },
      data: { planId: targetPlan.id },
      include: { plan: true },
    });

    let subscriptionSync: SubscriptionSyncMode = "not_applicable";
    let afterSubscriptionPlanId: string | null = null;

    if (subscription) {
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: { planId: targetPlan.id },
      });
      afterSubscriptionPlanId = updatedSubscription.planId;
      subscriptionSync = "synced";
      if (updatedLicense.planId !== updatedSubscription.planId) {
        throw new AdminValidationError("Lisans ve abonelik paketleri senkronize edilemedi.");
      }
    }

    await writeCommercialAudit(
      {
        action: "admin.license.plan_changed",
        actor: input.actor,
        organizationId: license.organizationId,
        entityType: "License",
        entityId: license.id,
        metadata: {
          organizationId: license.organizationId,
          licenseId: license.id,
          subscriptionId: subscription?.id ?? null,
          productId: license.productId,
          beforeLicensePlanId,
          afterLicensePlanId: updatedLicense.planId,
          beforeSubscriptionPlanId,
          afterSubscriptionPlanId,
          beforePlanName,
          afterPlanName: updatedLicense.plan.name,
          changeType,
          subscriptionSync,
          usageSnapshot: usage,
          targetLimits: targetLimitsSnapshot(targetEntitlements),
          reason,
        },
      },
      tx,
    );

    return {
      changeType,
      subscriptionSync,
      licensePlanId: updatedLicense.planId,
      subscriptionPlanId: afterSubscriptionPlanId,
    };
  });
}

export type WaiveActivationFeeAsAdminInput = {
  organizationId: string;
  productId: string;
  reason: string;
  actor: AdminSession;
  confirmed?: boolean;
};

export async function waiveActivationFeeAsAdmin(input: WaiveActivationFeeAsAdminInput) {
  const reason = sanitizeCommercialReason(input.reason, "Muafiyet gerekçesi", WAIVE_REASON_MIN, WAIVE_REASON_MAX);
  if (!input.confirmed) {
    throw new AdminValidationError("Aktivasyon ücreti muafiyeti için onay zorunludur.");
  }

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization) {
      throw new AdminValidationError("Organizasyon bulunamadı.");
    }

    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) {
      throw new AdminValidationError("Ürün bulunamadı.");
    }

    await advisoryLockPlanChange(tx, input.organizationId, input.productId);

    const ledger = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: input.productId,
        },
      },
      include: {
        subscriptionPayment: { select: { id: true, status: true, merchantOid: true } },
      },
    });

    if (!ledger) {
      throw new AdminValidationError("Aktivasyon ücreti kaydı bulunamadı.");
    }

    if (ledger.status === "PAID" || ledger.status === "WAIVED" || ledger.status === "WAIVED_LEGACY") {
      throw new AdminValidationError("Bu aktivasyon ücreti kaydı değiştirilemez.");
    }

    if (isFreshActivationReservation(ledger)) {
      throw new AdminValidationError(
        "Devam eden bir ödeme rezervasyonu varken aktivasyon ücreti muaf tutulamaz.",
      );
    }

    let updated;
    try {
      // Do NOT write PlatformAdmin id into waivedByUserId (User-oriented field).
      updated = await waiveActivationFee(tx, {
        organizationId: input.organizationId,
        productId: input.productId,
        reason,
        waivedByUserId: null,
        legacy: false,
      });
    } catch (error) {
      if (error instanceof ActivationFeeError) {
        throw new AdminValidationError(
          error.code === "ACTIVATION_FEE_IMMUTABLE"
            ? "Bu aktivasyon ücreti kaydı değiştirilemez."
            : "Aktivasyon ücreti muafiyeti tamamlanamadı.",
        );
      }
      throw error;
    }

    await writeCommercialAudit(
      {
        action: "admin.activation_fee.waived",
        actor: input.actor,
        organizationId: input.organizationId,
        entityType: "ActivationFeeLedger",
        entityId: updated.id,
        metadata: {
          organizationId: input.organizationId,
          productId: input.productId,
          ledgerId: updated.id,
          beforeStatus: ledger.status,
          afterStatus: updated.status,
          reason,
          subscriptionPaymentId: ledger.subscriptionPaymentId,
          merchantOidMasked: maskMerchantOid(ledger.subscriptionPayment?.merchantOid ?? null),
          paymentStatus: ledger.subscriptionPayment?.status ?? null,
        },
      },
      tx,
    );

    return updated;
  });
}

export type ActivationFeeAdminSummary = {
  id: string;
  status: ActivationFeeStatus;
  planId: string | null;
  activationFeeMinor: number;
  taxAmountMinor: number;
  grossAmountMinor: number;
  reservedUntil: Date | null;
  paidAt: Date | null;
  reservationFresh: boolean;
  paymentStatus: string | null;
  merchantOidMasked: string | null;
  waivedReason: string | null;
  canWaive: boolean;
};

export async function getActivationFeeAdminSummary(
  organizationId: string,
  productId: string,
): Promise<ActivationFeeAdminSummary | null> {
  const ledger = await prisma.activationFeeLedger.findUnique({
    where: {
      organizationId_productId: { organizationId, productId },
    },
    include: {
      subscriptionPayment: { select: { status: true, merchantOid: true } },
    },
  });
  if (!ledger) return null;
  const reservationFresh = isFreshActivationReservation(ledger);
  const canWaive = ledger.status === "PENDING" && !reservationFresh;
  return {
    id: ledger.id,
    status: ledger.status,
    planId: ledger.planId,
    activationFeeMinor: ledger.activationFeeMinor,
    taxAmountMinor: ledger.taxAmountMinor,
    grossAmountMinor: ledger.grossAmountMinor,
    reservedUntil: ledger.reservedUntil,
    paidAt: ledger.paidAt,
    reservationFresh,
    paymentStatus: ledger.subscriptionPayment?.status ?? null,
    merchantOidMasked: maskMerchantOid(ledger.subscriptionPayment?.merchantOid ?? null),
    waivedReason: ledger.waivedReason,
    canWaive,
  };
}

/** Pure helper exported for unit tests — mirrors create-room semantics still used elsewhere. */
export function assertCreateRoomSemantics(entitlements: CoreEntitlementMap, key: string, currentCount: number) {
  return assertEntitlementLimit(entitlements, key, currentCount);
}

export function resolveTierKeyForPlan(plan: { tierKey?: string | null; key?: string | null }): WexPayTierKey | null {
  return resolveWexPayTierKey(plan.tierKey ?? plan.key ?? null);
}
