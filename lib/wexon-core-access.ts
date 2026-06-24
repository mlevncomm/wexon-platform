import { prisma } from "@/lib/prisma";

export type CoreEntitlementValue = boolean | number | string | null;
export type CoreEntitlementMap = Record<string, CoreEntitlementValue>;

export type ProductAccessDenialReason =
  | "organization_missing"
  | "organization_inactive"
  | "product_missing"
  | "product_inactive"
  | "license_missing"
  | "license_not_started"
  | "license_expired"
  | "license_inactive"
  | "installation_missing"
  | "installation_inactive";

type ProductAccessInput = {
  organizationId: string;
  productKey: string;
  at?: Date;
};

type EntitlementRecord = {
  key: string;
  valueBool: boolean | null;
  valueInt: number | null;
  valueString: string | null;
};

const allowedLicenseStatuses = new Set(["ACTIVE", "TRIAL"]);

function readCoreEntitlements(entitlements: EntitlementRecord[]): CoreEntitlementMap {
  return entitlements.reduce<CoreEntitlementMap>((accumulator, entitlement) => {
    accumulator[entitlement.key] =
      entitlement.valueInt ?? entitlement.valueString ?? entitlement.valueBool ?? null;
    return accumulator;
  }, {});
}

function choosePrimaryLicense<T extends { status: string; startsAt: Date; endsAt: Date | null; createdAt: Date }>(
  licenses: T[],
  now: Date,
) {
  const statusRank = (status: string) => {
    if (status === "ACTIVE") return 0;
    if (status === "TRIAL") return 1;
    if (status === "PAST_DUE") return 2;
    if (status === "SUSPENDED") return 3;
    if (status === "EXPIRED") return 4;
    if (status === "CANCELLED") return 5;
    return 9;
  };

  return [...licenses].sort((first, second) => {
    const firstCurrentlyValid = first.startsAt <= now && (!first.endsAt || first.endsAt >= now);
    const secondCurrentlyValid = second.startsAt <= now && (!second.endsAt || second.endsAt >= now);

    if (firstCurrentlyValid !== secondCurrentlyValid) return firstCurrentlyValid ? -1 : 1;
    if (statusRank(first.status) !== statusRank(second.status)) {
      return statusRank(first.status) - statusRank(second.status);
    }
    return second.createdAt.getTime() - first.createdAt.getTime();
  })[0] ?? null;
}

function getBillingState(subscription: { status: string; currentPeriodEnd: Date | null } | null, now: Date) {
  if (!subscription) return "none";
  if (subscription.status === "PAST_DUE") return "past_due";
  if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") return "closed";
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) return "period_ended";
  return "ok";
}

export async function evaluateProductAccess({ organizationId, productKey, at }: ProductAccessInput) {
  const now = at ?? new Date();
  const [organization, product] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.product.findUnique({ where: { key: productKey } }),
  ]);

  if (!organization) {
    return {
      allowed: false as const,
      reason: "organization_missing" as ProductAccessDenialReason,
      organization: null,
      product,
      license: null,
      installation: null,
      subscription: null,
      billingState: "none",
      entitlementMap: {},
    };
  }

  if (!organization.isActive) {
    return {
      allowed: false as const,
      reason: "organization_inactive" as ProductAccessDenialReason,
      organization,
      product,
      license: null,
      installation: null,
      subscription: null,
      billingState: "none",
      entitlementMap: {},
    };
  }

  if (!product) {
    return {
      allowed: false as const,
      reason: "product_missing" as ProductAccessDenialReason,
      organization,
      product: null,
      license: null,
      installation: null,
      subscription: null,
      billingState: "none",
      entitlementMap: {},
    };
  }

  if (!product.isActive || product.status !== "ACTIVE") {
    return {
      allowed: false as const,
      reason: "product_inactive" as ProductAccessDenialReason,
      organization,
      product,
      license: null,
      installation: null,
      subscription: null,
      billingState: "none",
      entitlementMap: {},
    };
  }

  const [licenses, installation] = await Promise.all([
    prisma.license.findMany({
      where: { organizationId, productId: product.id },
      include: {
        plan: {
          include: {
            entitlements: {
              orderBy: { key: "asc" },
            },
          },
        },
        subscription: true,
        product: true,
      },
    }),
    prisma.appInstallation.findUnique({
      where: { organizationId_productId: { organizationId, productId: product.id } },
      include: { product: true },
    }),
  ]);
  const license = choosePrimaryLicense(licenses, now);
  const subscription = license?.subscription ?? null;
  const billingState = getBillingState(subscription, now);

  if (!license) {
    return {
      allowed: false as const,
      reason: "license_missing" as ProductAccessDenialReason,
      organization,
      product,
      license: null,
      installation,
      subscription,
      billingState,
      entitlementMap: {},
    };
  }

  const entitlementMap = readCoreEntitlements(license.plan.entitlements);

  if (license.startsAt > now) {
    return {
      allowed: false as const,
      reason: "license_not_started" as ProductAccessDenialReason,
      organization,
      product,
      license,
      installation,
      subscription,
      billingState,
      entitlementMap,
    };
  }

  if (license.endsAt && license.endsAt < now) {
    return {
      allowed: false as const,
      reason: "license_expired" as ProductAccessDenialReason,
      organization,
      product,
      license,
      installation,
      subscription,
      billingState,
      entitlementMap,
    };
  }

  if (!allowedLicenseStatuses.has(license.status)) {
    return {
      allowed: false as const,
      reason: "license_inactive" as ProductAccessDenialReason,
      organization,
      product,
      license,
      installation,
      subscription,
      billingState,
      entitlementMap,
    };
  }

  if (!installation) {
    return {
      allowed: false as const,
      reason: "installation_missing" as ProductAccessDenialReason,
      organization,
      product,
      license,
      installation: null,
      subscription,
      billingState,
      entitlementMap,
    };
  }

  if (installation.status !== "ACTIVE") {
    return {
      allowed: false as const,
      reason: "installation_inactive" as ProductAccessDenialReason,
      organization,
      product,
      license,
      installation,
      subscription,
      billingState,
      entitlementMap,
    };
  }

  return {
    allowed: true as const,
    reason: null,
    organization,
    product,
    license,
    installation,
    subscription,
    billingState,
    entitlementMap,
  };
}

export function coreEntitlementNumber(entitlements: CoreEntitlementMap, key: string) {
  return Number(entitlements[key] ?? 0);
}

export type ProductAccessResult = Awaited<ReturnType<typeof evaluateProductAccess>>;
export type AllowedProductAccess = Extract<ProductAccessResult, { allowed: true }>;

const denialHttpStatus: Record<ProductAccessDenialReason, number> = {
  organization_missing: 404,
  organization_inactive: 403,
  product_missing: 404,
  product_inactive: 403,
  license_missing: 403,
  license_not_started: 403,
  license_expired: 403,
  license_inactive: 403,
  installation_missing: 403,
  installation_inactive: 403,
};

const denialMessages: Record<ProductAccessDenialReason, string> = {
  organization_missing: "Organizasyon bulunamadı.",
  organization_inactive: "Organizasyon aktif değil.",
  product_missing: "Ürün bulunamadı.",
  product_inactive: "Ürün şu anda kullanıma kapalı.",
  license_missing: "Bu ürün için aktif bir lisans bulunamadı.",
  license_not_started: "Lisans henüz başlamadı.",
  license_expired: "Lisans süresi doldu.",
  license_inactive: "Lisans aktif değil.",
  installation_missing: "Ürün kurulumu tamamlanmamış.",
  installation_inactive: "Ürün kurulumu aktif değil.",
};

export function coreAccessDenialStatus(reason: ProductAccessDenialReason) {
  return denialHttpStatus[reason] ?? 403;
}

export function coreAccessDenialMessage(reason: ProductAccessDenialReason) {
  return denialMessages[reason] ?? "Bu ürüne erişim yetkiniz yok.";
}

export type RequireProductAccessResult =
  | ({ ok: true } & AllowedProductAccess)
  | {
      ok: false;
      reason: ProductAccessDenialReason;
      status: number;
      message: string;
      access: Extract<ProductAccessResult, { allowed: false }>;
    };

/**
 * Single shared Core decision helper. Every surface (dashboard, admin, demo,
 * production product API) must resolve the final access decision through this
 * function instead of re-implementing license/installation/entitlement checks.
 */
export async function requireProductAccess(input: ProductAccessInput): Promise<RequireProductAccessResult> {
  const access = await evaluateProductAccess(input);

  if (!access.allowed) {
    return {
      ok: false,
      reason: access.reason,
      status: coreAccessDenialStatus(access.reason),
      message: coreAccessDenialMessage(access.reason),
      access,
    };
  }

  return { ok: true, ...access };
}

export type EntitlementLimitResult =
  | { ok: true; limit: number; current: number; unlimited: boolean }
  | { ok: false; limit: number; current: number; key: string; message: string };

/**
 * Server-side entitlement limit assertion. A limit of 0 (or missing) is treated
 * as unlimited so products without an explicit cap are not accidentally blocked.
 */
export function assertEntitlementLimit(
  entitlements: CoreEntitlementMap,
  key: string,
  currentCount: number,
): EntitlementLimitResult {
  const limit = coreEntitlementNumber(entitlements, key);
  const unlimited = !Number.isFinite(limit) || limit <= 0;

  if (unlimited || currentCount < limit) {
    return { ok: true, limit, current: currentCount, unlimited };
  }

  return {
    ok: false,
    limit,
    current: currentCount,
    key,
    message: `Plan limitiniz (${limit}) dolduğu için bu işlem tamamlanamadı.`,
  };
}

/**
 * Staff limits require an active WexPay license context. Without Core access,
 * an empty entitlement map must not be treated as unlimited.
 */
export function assertStaffEntitlementLimit(
  access: ProductAccessResult,
  currentCount: number,
): EntitlementLimitResult {
  if (!access.allowed) {
    return {
      ok: false,
      limit: 0,
      current: currentCount,
      key: "staff_limit",
      message: "Personel eklemek için aktif bir WexPay lisansı ve kurulum gereklidir.",
    };
  }

  return assertEntitlementLimit(access.entitlementMap, "staff_limit", currentCount);
}

export function isEntitlementEnabled(entitlements: CoreEntitlementMap, key: string) {
  const value = entitlements[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim().length > 0 && value !== "none" && value !== "false";
  return false;
}
