import type { Prisma } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/wexon-admin-auth";
import { getCustomerSession } from "@/lib/wexon-customer-auth";
import { resolvePlatformOrganizationSelector } from "@/lib/wexon-organization-context";
import { canAccessWexPay, canManageWexPay, canOperateCashierWexPay, canOperateKitchenWexPay, canConfigureWexPaySettings } from "@/lib/wexpay-auth";
import {
  type CoreEntitlementMap,
  type ProductAccessDenialReason,
  requireProductAccess,
} from "@/lib/wexon-core-access";

/**
 * Tenant context layer for the REAL WexPay operator app.
 *
 * Hard rules enforced here:
 * - Tenant (organizationId) is resolved ONLY from the authenticated session.
 *   There is no fixed demo slug, no fixed branch slug, and no global fallback.
 * - The final access decision is always delegated to Wexon Core via
 *   `requireProductAccess`.
 * - Restaurants with a null `organizationId` are never part of any tenant and
 *   are excluded from every query and ownership check.
 */

const WEXPAY_PRODUCT_KEY = "wexpay";

export type WexPaySessionActor =
  | {
      type: "customer_session";
      userId: string;
      email: string;
      role: string;
    }
  | {
      type: "admin_session";
      email: string;
      role: "ADMIN";
    };

export type WexPaySessionContext = {
  organizationId: string;
  actor: WexPaySessionActor;
  role: string;
  canManage: boolean;
  canOperateKitchen: boolean;
  canOperateCashier: boolean;
  canConfigureSettings: boolean;
  entitlementMap: CoreEntitlementMap;
};

export type WexPayContextDenialReason =
  | "unauthenticated"
  | "missing_membership"
  | "role"
  | ProductAccessDenialReason;

export type ResolveWexPaySessionResult =
  | ({ ok: true } & WexPaySessionContext)
  | { ok: false; reason: WexPayContextDenialReason; message: string };

/**
 * Domain error thrown by service mutations when tenant ownership or access
 * fails. Server actions and API routes translate this into a user-facing
 * message / HTTP status.
 */
export class WexPayAccessError extends Error {
  reason: WexPayContextDenialReason | "forbidden_ownership";

  constructor(message: string, reason: WexPayContextDenialReason | "forbidden_ownership") {
    super(message);
    this.name = "WexPayAccessError";
    this.reason = reason;
  }
}

/**
 * Resolve the WexPay tenant context from the customer session. Uses the
 * session user's primary ACTIVE membership organization (no org switcher in
 * the MVP) and then defers the access decision to Core.
 */
export async function resolveWexPaySessionContext(
  options: {
    manage?: boolean;
    kitchen?: boolean;
    cashier?: boolean;
    settings?: boolean;
    organizationId?: string;
  } = {},
): Promise<ResolveWexPaySessionResult> {
  const selector = await resolvePlatformOrganizationSelector(
    options.organizationId ? { organizationId: options.organizationId } : undefined,
  );
  const organizationId = selector?.organizationId ?? options.organizationId;

  const adminSession = await getAdminSession();
  if (adminSession && organizationId) {
    const decision = await requireProductAccess({
      organizationId,
      productKey: WEXPAY_PRODUCT_KEY,
    });
    if (!decision.ok) {
      return { ok: false, reason: decision.reason, message: decision.message };
    }

    if (decision.organization.isDemo && (options.manage || options.kitchen || options.cashier || options.settings)) {
      return {
        ok: false,
        reason: "role",
        message: "Demo tenant üzerinde değişiklik yapılamaz. Önizleme salt okunurdur.",
      };
    }

    return {
      ok: true,
      organizationId,
      actor: { type: "admin_session", email: adminSession.email, role: "ADMIN" },
      role: "ADMIN",
      canManage: true,
      canOperateKitchen: true,
      canOperateCashier: true,
      canConfigureSettings: true,
      entitlementMap: decision.entitlementMap,
    };
  }

  const session = await getCustomerSession();
  if (!session) {
    return { ok: false, reason: "unauthenticated", message: "Kimlik doğrulaması gerekli." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !user.isActive || user.memberships.length === 0) {
    return { ok: false, reason: "missing_membership", message: "Aktif üyelik bulunamadı." };
  }

  const membership = organizationId
    ? user.memberships.find((item) => item.organizationId === organizationId)
    : user.memberships[0];

  if (!membership) {
    return { ok: false, reason: "missing_membership", message: "Bu organizasyona erişiminiz yok." };
  }

  if (!canAccessWexPay(membership.role)) {
    return { ok: false, reason: "role", message: "WexPay erişim yetkiniz yok." };
  }

  const canManage = canManageWexPay(membership.role);
  const canOperateKitchen = canOperateKitchenWexPay(membership.role);
  const canOperateCashier = canOperateCashierWexPay(membership.role);
  const canConfigureSettings = canConfigureWexPaySettings(membership.role);

  if (options.manage && !canManage) {
    return { ok: false, reason: "role", message: "Bu işlem için yetkiniz yok." };
  }
  if (options.kitchen && !canOperateKitchen) {
    return { ok: false, reason: "role", message: "Mutfak işlemi için yetkiniz yok." };
  }
  if (options.cashier && !canOperateCashier) {
    return { ok: false, reason: "role", message: "Kasa işlemi için yetkiniz yok." };
  }
  if (options.settings && !canConfigureSettings) {
    return { ok: false, reason: "role", message: "Ayarları yalnızca sahip veya yönetici değiştirebilir." };
  }

  const decision = await requireProductAccess({
    organizationId: membership.organizationId,
    productKey: WEXPAY_PRODUCT_KEY,
  });

  if (!decision.ok) {
    return { ok: false, reason: decision.reason, message: decision.message };
  }

  if (decision.organization.isDemo) {
    return {
      ok: false,
      reason: "role",
      message: "Gercek WexPay app demo tenant ile kullanilamaz. Lutfen isDemo=false bir musteri organizasyonu secin.",
    };
  }

  return {
    ok: true,
    organizationId: membership.organizationId,
    actor: {
      type: "customer_session",
      userId: user.id,
      email: user.email,
      role: membership.role,
    },
    role: membership.role,
    canManage,
    canOperateKitchen,
    canOperateCashier,
    canConfigureSettings,
    entitlementMap: decision.entitlementMap,
  };
}

/**
 * Prisma client surface that works on both the root client and a transaction
 * client, so ownership asserts can run inside or outside a `$transaction`.
 */
export type TenantDb = Prisma.TransactionClient | typeof prisma;

/**
 * Ownership asserts. Each verifies the row belongs to the caller's org through
 * the chain organizationId -> Restaurant -> Branch -> (Table|Category|Product).
 * They throw `WexPayAccessError` instead of returning so mutations can never
 * proceed on a row outside the tenant. Null-org restaurants are excluded.
 */
export async function assertRestaurantInOrg(db: TenantDb, organizationId: string, restaurantId: string) {
  const restaurant = await db.restaurant.findFirst({
    where: { id: restaurantId, organizationId },
  });
  if (!restaurant) {
    throw new WexPayAccessError("Restoran bulunamadı.", "forbidden_ownership");
  }
  return restaurant;
}

export async function assertBranchInOrg(db: TenantDb, organizationId: string, branchId: string) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, restaurant: { organizationId } },
    include: { restaurant: true },
  });
  if (!branch) {
    throw new WexPayAccessError("Şube bulunamadı.", "forbidden_ownership");
  }
  return branch;
}

export async function assertTableInOrg(db: TenantDb, organizationId: string, tableId: string) {
  const table = await db.restaurantTable.findFirst({
    where: { id: tableId, branch: { restaurant: { organizationId } } },
    include: { branch: true },
  });
  if (!table) {
    throw new WexPayAccessError("Masa bulunamadı.", "forbidden_ownership");
  }
  return table;
}

export async function assertCategoryInOrg(db: TenantDb, organizationId: string, categoryId: string) {
  const category = await db.menuCategory.findFirst({
    where: { id: categoryId, branch: { restaurant: { organizationId } } },
    include: { branch: true },
  });
  if (!category) {
    throw new WexPayAccessError("Kategori bulunamadı.", "forbidden_ownership");
  }
  return category;
}

export async function assertProductInOrg(db: TenantDb, organizationId: string, productId: string) {
  const product = await db.menuProduct.findFirst({
    where: { id: productId, branch: { restaurant: { organizationId } } },
    include: { branch: true, category: true },
  });
  if (!product) {
    throw new WexPayAccessError("Ürün bulunamadı.", "forbidden_ownership");
  }
  return product;
}

export async function assertModifierGroupInOrg(db: TenantDb, organizationId: string, groupId: string) {
  const group = await db.menuModifierGroup.findFirst({
    where: { id: groupId, branch: { restaurant: { organizationId } } },
    include: { branch: true },
  });
  if (!group) {
    throw new WexPayAccessError("Modifier grubu bulunamadı.", "forbidden_ownership");
  }
  return group;
}

export async function assertModifierOptionInOrg(db: TenantDb, organizationId: string, optionId: string) {
  const option = await db.menuModifierOption.findFirst({
    where: { id: optionId, group: { branch: { restaurant: { organizationId } } } },
    include: { group: true },
  });
  if (!option) {
    throw new WexPayAccessError("Modifier seçeneği bulunamadı.", "forbidden_ownership");
  }
  return option;
}

export async function assertOrderInOrg(db: TenantDb, organizationId: string, orderId: string) {
  const order = await db.customerOrder.findFirst({
    where: { id: orderId, branch: { restaurant: { organizationId } } },
    include: { branch: true, table: true },
  });
  if (!order) {
    throw new WexPayAccessError("Sipariş bulunamadı.", "forbidden_ownership");
  }
  return order;
}

export async function assertPaymentInOrg(db: TenantDb, organizationId: string, paymentId: string) {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, branch: { restaurant: { organizationId } } },
    include: { branch: true, table: true, order: true },
  });
  if (!payment) {
    throw new WexPayAccessError("Ödeme bulunamadı.", "forbidden_ownership");
  }
  return payment;
}

/** Tenant-scoped count helpers used for entitlement enforcement. */
export function countOrgBranches(db: TenantDb, organizationId: string) {
  return db.branch.count({ where: { restaurant: { organizationId } } });
}

export function countOrgTables(db: TenantDb, organizationId: string) {
  return db.restaurantTable.count({ where: { branch: { restaurant: { organizationId } } } });
}

export function countOrgProducts(db: TenantDb, organizationId: string) {
  return db.menuProduct.count({ where: { branch: { restaurant: { organizationId } } } });
}
