import type { MembershipRole, Prisma, PrismaClient } from ".prisma/client";
import {
  type CoreEntitlementMap,
  type ProductAccessDenialReason,
  evaluateSubscriptionLifecycle,
  assertEntitlementLimit,
  assertStaffEntitlementLimit,
  type ProductAccessResult,
} from "@/lib/wexon-core-access";
import { SETTLED_ACTIVATION_FEE_STATUSES } from "@/lib/wexpay-activation-journey";

type DbClient = PrismaClient | Prisma.TransactionClient;

const ALLOWED_LICENSE_STATUSES = new Set(["ACTIVE", "TRIAL"]);

export class ActivationTxAccessError extends Error {
  readonly code: string;
  readonly reason?: ProductAccessDenialReason | "fee_unsettled" | "actor_forbidden";

  constructor(code: string, message: string, reason?: ActivationTxAccessError["reason"]) {
    super(message);
    this.name = "ActivationTxAccessError";
    this.code = code;
    this.reason = reason;
  }
}

type EntitlementRecord = {
  key: string;
  valueBool: boolean | null;
  valueInt: number | null;
  valueString: string | null;
};

function readCoreEntitlements(entitlements: EntitlementRecord[]): CoreEntitlementMap {
  return entitlements.reduce<CoreEntitlementMap>((acc, entitlement) => {
    acc[entitlement.key] =
      entitlement.valueInt ?? entitlement.valueString ?? entitlement.valueBool ?? null;
    return acc;
  }, {});
}

function choosePrimaryLicense<
  T extends { status: string; startsAt: Date; endsAt: Date | null; createdAt: Date },
>(licenses: T[], now: Date) {
  const statusRank = (status: string) => {
    if (status === "ACTIVE") return 0;
    if (status === "TRIAL") return 1;
    if (status === "PAST_DUE") return 2;
    if (status === "SUSPENDED") return 3;
    if (status === "EXPIRED") return 4;
    if (status === "CANCELLED") return 5;
    return 9;
  };
  return (
    [...licenses].sort((a, b) => {
      const aOk = a.startsAt <= now && (!a.endsAt || a.endsAt >= now);
      const bOk = b.startsAt <= now && (!b.endsAt || b.endsAt >= now);
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (statusRank(a.status) !== statusRank(b.status)) {
        return statusRank(a.status) - statusRank(b.status);
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] ?? null
  );
}

export type TxProductAccessOk = {
  allowed: true;
  organizationId: string;
  productId: string;
  entitlementMap: CoreEntitlementMap;
  licenseId: string;
  installationId: string;
};

export type TxProductAccessDenied = {
  allowed: false;
  reason: ProductAccessDenialReason | "fee_unsettled";
};

/**
 * Transaction-bound WexPay access + settled activation-fee gate.
 * Must use the same `tx` client — never call global prisma / evaluateProductAccess inside a TX.
 */
export async function assertWexPayAccessInTx(
  tx: DbClient,
  input: {
    organizationId: string;
    productKey?: string;
    requireFeeSettled?: boolean;
    at?: Date;
  },
): Promise<TxProductAccessOk> {
  const now = input.at ?? new Date();
  const productKey = input.productKey ?? "wexpay";

  const organization = await tx.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, isActive: true, isDemo: true },
  });
  if (!organization?.isActive || organization.isDemo) {
    throw new ActivationTxAccessError("NO_ACCESS", "Organizasyon erişimi kapalı.", "organization_inactive");
  }

  const product = await tx.product.findFirst({
    where: { key: productKey, isActive: true },
    select: { id: true },
  });
  if (!product) {
    throw new ActivationTxAccessError("NO_ACCESS", "Ürün bulunamadı.", "product_missing");
  }

  const licenses = await tx.license.findMany({
    where: { organizationId: input.organizationId, productId: product.id },
    include: {
      plan: {
        include: {
          entitlements: { where: { isActive: true }, orderBy: { key: "asc" } },
        },
      },
      subscription: true,
    },
  });
  const license = choosePrimaryLicense(licenses, now);
  if (!license) {
    throw new ActivationTxAccessError("NO_ACCESS", "Lisans bulunamadı.", "license_missing");
  }
  if (license.startsAt > now) {
    throw new ActivationTxAccessError("NO_ACCESS", "Lisans henüz başlamadı.", "license_not_started");
  }
  if (license.endsAt && license.endsAt < now) {
    throw new ActivationTxAccessError("NO_ACCESS", "Lisans süresi dolmuş.", "license_expired");
  }
  if (!ALLOWED_LICENSE_STATUSES.has(license.status)) {
    throw new ActivationTxAccessError("NO_ACCESS", "Lisans aktif değil.", "license_inactive");
  }

  const installation = await tx.appInstallation.findUnique({
    where: {
      organizationId_productId: {
        organizationId: input.organizationId,
        productId: product.id,
      },
    },
  });
  if (!installation) {
    throw new ActivationTxAccessError("NO_ACCESS", "Kurulum bulunamadı.", "installation_missing");
  }
  if (installation.status !== "ACTIVE") {
    throw new ActivationTxAccessError("NO_ACCESS", "Kurulum aktif değil.", "installation_inactive");
  }

  const lifecycle = evaluateSubscriptionLifecycle(license.subscription, now);
  if (!lifecycle.ok) {
    throw new ActivationTxAccessError("NO_ACCESS", "Abonelik erişimi kapalı.", lifecycle.reason);
  }

  if (input.requireFeeSettled !== false) {
    const fee = await tx.activationFeeLedger.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: product.id,
        },
      },
      select: { status: true },
    });
    if (!fee || !(SETTLED_ACTIVATION_FEE_STATUSES as readonly string[]).includes(fee.status)) {
      throw new ActivationTxAccessError("NO_ACCESS", "Aktivasyon ücreti henüz kapanmamış.", "fee_unsettled");
    }
  }

  const entitlementMap = readCoreEntitlements(license.plan.entitlements);
  return {
    allowed: true,
    organizationId: input.organizationId,
    productId: product.id,
    entitlementMap,
    licenseId: license.id,
    installationId: installation.id,
  };
}

export async function assertActorManageMembershipInTx(
  tx: DbClient,
  input: {
    organizationId: string;
    actorUserId: string;
    roles?: MembershipRole[];
  },
) {
  const actor = await tx.user.findFirst({
    where: { id: input.actorUserId, isActive: true },
    select: { id: true },
  });
  if (!actor) {
    throw new ActivationTxAccessError("ACTOR_INACTIVE", "Oturum kullanıcısı aktif değil.", "actor_forbidden");
  }

  const roles = input.roles ?? (["OWNER", "ADMIN", "MANAGER"] as MembershipRole[]);
  const membership = await tx.membership.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.actorUserId,
      status: "ACTIVE",
      role: { in: roles },
    },
    select: { id: true, role: true },
  });
  if (!membership) {
    throw new ActivationTxAccessError("FORBIDDEN", "Bu işlem için yetkiniz yok.", "actor_forbidden");
  }
  return membership;
}

/** Build a ProductAccessResult-shaped object for staff limit helpers from TX access. */
export function txAccessToStaffAccessShape(access: TxProductAccessOk): ProductAccessResult {
  return {
    allowed: true,
    reason: null,
    organization: null as never,
    product: null as never,
    license: null as never,
    installation: null as never,
    subscription: null,
    billingState: "ok",
    entitlementMap: access.entitlementMap,
  };
}

export function assertCanonicalLimitInTx(
  entitlementMap: CoreEntitlementMap,
  key: string,
  currentCount: number,
) {
  const result = assertEntitlementLimit(entitlementMap, key, currentCount);
  if (!result.ok) {
    throw new ActivationTxAccessError("LIMIT", result.message);
  }
  return result;
}

export function assertCanonicalStaffLimitInTx(
  access: TxProductAccessOk,
  currentCount: number,
) {
  const result = assertStaffEntitlementLimit(txAccessToStaffAccessShape(access), currentCount);
  if (!result.ok) {
    throw new ActivationTxAccessError("STAFF_LIMIT", result.message);
  }
  return result;
}
