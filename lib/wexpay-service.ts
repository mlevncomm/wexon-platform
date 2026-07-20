import { randomUUID } from "crypto";
import { NotificationType, OrderStatus, PaymentStatus, MenuModifierSelectionType, type Prisma, ReceiptStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { assertEntitlementLimit, type CoreEntitlementMap } from "@/lib/wexon-core-access";
import { calculateTableAccount, closeTableBlockReason, filterTableSessionRecords, type TableAccountSnapshot } from "@/lib/wexpay-account";
import {
  assertBranchInOrg,
  assertCategoryInOrg,
  assertModifierGroupInOrg,
  assertModifierOptionInOrg,
  assertOrderInOrg,
  assertPaymentInOrg,
  assertProductInOrg,
  assertRestaurantInOrg,
  assertTableInOrg,
  countOrgBranches,
  countOrgProducts,
  countOrgTables,
  type TenantDb,
  WexPayAccessError,
} from "@/lib/wexpay-tenant";
import { type OrderItemInput, WexPayValidationError } from "@/lib/wexpay-validation";
import { priceOrderLine, sumPricedLinesSubtotal } from "@/lib/wexpay-order-pricing";
import { lockWexPayOrgBranchLimit, lockWexPayOrgTableLimit, lockWexPayTableAccount } from "@/lib/wexpay-locks";
import { resolveWexPayPaymentProvider, type WexPayPaymentProviderKey } from "@/lib/wexpay-payment-provider";
import { generatePaytrMerchantOid } from "@/lib/wexpay-paytr-adapter";

/**
 * Pure tenant-aware mutation service for the real WexPay operator app. Every
 * function:
 *  1. requires management capability,
 *  2. asserts tenant ownership through the organizationId chain,
 *  3. enforces entitlement limits where applicable,
 *  4. writes the domain record and its audit log inside one transaction.
 *
 * Both server actions and (Phase 2) production API routes call this service so
 * the rules are written exactly once.
 */

export type WexPayMutationActor =
  | { type: "customer_session"; userId: string; email: string; role: string }
  | { type: "admin_session"; email: string; role: string }
  | { type: "api_key"; apiKeyId: string; scopes: string[] };

export type WexPayMutationContext = {
  organizationId: string;
  actor: WexPayMutationActor;
  entitlementMap: CoreEntitlementMap;
  canManage: boolean;
  ipAddress?: string | null;
};

function assertManage(context: WexPayMutationContext) {
  if (!context.canManage) {
    throw new WexPayAccessError("Bu işlem için yetkiniz yok.", "role");
  }
}

function auditUserId(context: WexPayMutationContext) {
  return context.actor.type === "customer_session" ? context.actor.userId : null;
}

function auditActorMeta(context: WexPayMutationContext) {
  if (context.actor.type === "customer_session") {
    return {
      actorType: "customer_session",
      userId: context.actor.userId,
      email: context.actor.email,
      role: context.actor.role,
    };
  }
  if (context.actor.type === "admin_session") {
    return {
      actorType: "admin_session",
      admin_preview: true,
      email: context.actor.email,
      role: context.actor.role,
    };
  }
  return { actorType: "api_key", apiKeyId: context.actor.apiKeyId };
}

async function writeWexPayAudit(
  tx: TenantDb,
  context: WexPayMutationContext,
  input: { action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> },
) {
  return writeAuditLog(
    {
      action: input.action,
      organizationId: context.organizationId,
      userId: auditUserId(context),
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: context.ipAddress ?? null,
      source: "wexpay_app",
      metadata: { actor: auditActorMeta(context), ...(input.metadata ?? {}) },
    },
    tx,
  );
}

async function enforceEntitlementLimit(
  tx: TenantDb,
  context: WexPayMutationContext,
  key: string,
  currentCount: number,
) {
  const limit = assertEntitlementLimit(context.entitlementMap, key, currentCount);
  if (!limit.ok) {
    await writeWexPayAudit(tx, context, {
      action: "entitlement.limit_exceeded",
      entityType: "Entitlement",
      entityId: key,
      metadata: { key: limit.key, limit: limit.limit, current: limit.current },
    });
    throw new WexPayValidationError(limit.message);
  }
  return limit;
}

function isUniqueConflict(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function generateTableQrCode() {
  return `WXP-${randomUUID()}`;
}

function runInTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(work);
}

async function getTableAccountSnapshot(tx: TenantDb, tableId: string): Promise<TableAccountSnapshot> {
  const table = await tx.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      orders: { select: { status: true, subtotal: true, createdAt: true, receiptRequested: true } },
      payments: { select: { status: true, amount: true, receiptRequested: true, createdAt: true } },
      receiptRequests: { select: { status: true, createdAt: true } },
    },
  });
  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  const sessionOrders = filterTableSessionRecords(table.orders, table.lastClosedAt, table.orders);
  const sessionPayments = filterTableSessionRecords(table.payments, table.lastClosedAt, table.orders);
  const sessionReceiptRequests = filterTableSessionRecords(table.receiptRequests, table.lastClosedAt, table.orders);

  return calculateTableAccount({
    orders: sessionOrders,
    payments: sessionPayments,
    receiptRequests: sessionReceiptRequests,
  });
}

async function syncTableStatus(tx: TenantDb, tableId: string) {
  const account = await getTableAccountSnapshot(tx, tableId);
  await tx.restaurantTable.update({ where: { id: tableId }, data: { status: account.status } });
  return account;
}

async function recordReceiptRequest(
  tx: TenantDb,
  input: {
    tableId: string;
    branchId: string;
    tableLabel: string;
    orderId?: string | null;
    paymentId?: string | null;
    note?: string | null;
  },
) {
  await tx.receiptRequest.create({
    data: {
      tableId: input.tableId,
      orderId: input.orderId ?? null,
      paymentId: input.paymentId ?? null,
      status: ReceiptStatus.REQUESTED,
      note: input.note ?? null,
    },
  });

  if (input.orderId) {
    await tx.customerOrder.update({
      where: { id: input.orderId },
      data: { receiptRequested: true },
    });
  }

  if (input.paymentId) {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: { receiptRequested: true },
    });
  }

  await tx.businessNotification.create({
    data: {
      branchId: input.branchId,
      orderId: input.orderId ?? null,
      paymentId: input.paymentId ?? null,
      type: NotificationType.RECEIPT_REQUESTED,
      title: "Fiş talebi alındı",
      message: `${input.tableLabel} için fiş talebi oluşturuldu.`,
    },
  });
}

// ---------------------------------------------------------------------------
// Restaurant
// ---------------------------------------------------------------------------

export async function createRestaurant(
  context: WexPayMutationContext,
  input: { name: string; slug: string },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          slug: input.slug,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.restaurant.created",
        entityType: "Restaurant",
        entityId: restaurant.id,
        metadata: { name: restaurant.name, slug: restaurant.slug },
      });

      return restaurant;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu slug zaten kullanılıyor. Farklı bir ad/slug deneyin.");
    }
    throw error;
  }
}

export async function updateRestaurant(
  context: WexPayMutationContext,
  input: { restaurantId: string; name: string; isActive?: boolean },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    await assertRestaurantInOrg(tx, context.organizationId, input.restaurantId);

    const restaurant = await tx.restaurant.update({
      where: { id: input.restaurantId },
      data: {
        name: input.name,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.restaurant.updated",
      entityType: "Restaurant",
      entityId: restaurant.id,
      metadata: { name: restaurant.name, isActive: restaurant.isActive },
    });

    return restaurant;
  });
}

// ---------------------------------------------------------------------------
// Branch
// ---------------------------------------------------------------------------

export async function createBranch(
  context: WexPayMutationContext,
  input: { restaurantId: string; name: string; slug: string; address: string | null },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await lockWexPayOrgBranchLimit(tx, context.organizationId);
      await assertRestaurantInOrg(tx, context.organizationId, input.restaurantId);

      const currentBranches = await countOrgBranches(tx, context.organizationId);
      await enforceEntitlementLimit(tx, context, "branch_limit", currentBranches);

      const branch = await tx.branch.create({
        data: {
          restaurantId: input.restaurantId,
          name: input.name,
          slug: input.slug,
          address: input.address,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.branch.created",
        entityType: "Branch",
        entityId: branch.id,
        metadata: { restaurantId: input.restaurantId, name: branch.name, slug: branch.slug },
      });

      return branch;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu restoranda aynı slug ile bir şube zaten var.");
    }
    throw error;
  }
}

export async function updateBranch(
  context: WexPayMutationContext,
  input: { branchId: string; name: string; address: string | null; isActive?: boolean },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    await assertBranchInOrg(tx, context.organizationId, input.branchId);

    const branch = await tx.branch.update({
      where: { id: input.branchId },
      data: {
        name: input.name,
        address: input.address,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.branch.updated",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { name: branch.name, isActive: branch.isActive },
    });

    return branch;
  });
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export async function createTable(
  context: WexPayMutationContext,
  input: { branchId: string; label: string; seats: number },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      // Lock order: org table-limit only (see lib/wexpay-locks.ts).
      await lockWexPayOrgTableLimit(tx, context.organizationId);
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const currentTables = await countOrgTables(tx, context.organizationId);
      await enforceEntitlementLimit(tx, context, "table_limit", currentTables);

      const table = await tx.restaurantTable.create({
        data: {
          branchId: input.branchId,
          label: input.label,
          seats: input.seats,
          qrCode: generateTableQrCode(),
          status: TableStatus.EMPTY,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.table.created",
        entityType: "RestaurantTable",
        entityId: table.id,
        metadata: { branchId: input.branchId, label: table.label, seats: table.seats },
      });

      return table;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir masa zaten var.");
    }
    throw error;
  }
}

export async function createTablesBulk(
  context: WexPayMutationContext,
  input: { branchId: string; prefix: string; count: number; seats: number; startNumber: number },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      // Lock order: org table-limit only (shared with createTable — see lib/wexpay-locks.ts).
      await lockWexPayOrgTableLimit(tx, context.organizationId);
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const currentTables = await countOrgTables(tx, context.organizationId);
      await enforceEntitlementLimit(tx, context, "table_limit", currentTables + input.count - 1);

      const pad = Math.max(2, String(input.startNumber + input.count - 1).length);
      const created = [];

      for (let index = 0; index < input.count; index += 1) {
        const number = input.startNumber + index;
        const label = `${input.prefix} ${String(number).padStart(pad, "0")}`;
        const table = await tx.restaurantTable.create({
          data: {
            branchId: input.branchId,
            label,
            seats: input.seats,
            qrCode: generateTableQrCode(),
            status: TableStatus.EMPTY,
            isActive: true,
          },
        });
        created.push(table);
      }

      await writeWexPayAudit(tx, context, {
        action: "wexpay.table.bulk_created",
        entityType: "RestaurantTable",
        entityId: created[0]?.id ?? input.branchId,
        metadata: {
          branchId: input.branchId,
          count: created.length,
          prefix: input.prefix,
          startNumber: input.startNumber,
          seats: input.seats,
        },
      });

      return created;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir masa zaten var. Önek veya başlangıç numarasını değiştirin.");
    }
    throw error;
  }
}

export async function updateTable(
  context: WexPayMutationContext,
  input: { tableId: string; label: string; seats?: number; isActive?: boolean },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertTableInOrg(tx, context.organizationId, input.tableId);

      const table = await tx.restaurantTable.update({
        where: { id: input.tableId },
        data: {
          label: input.label,
          ...(input.seats === undefined ? {} : { seats: input.seats }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.table.updated",
        entityType: "RestaurantTable",
        entityId: table.id,
        metadata: { label: table.label, seats: table.seats, isActive: table.isActive },
      });

      return table;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir masa zaten var.");
    }
    throw error;
  }
}

export async function closeTable(context: WexPayMutationContext, input: { tableId: string }) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertTableInOrg(tx, context.organizationId, input.tableId);
    // Lock order: table account only (see lib/wexpay-locks.ts).
    await lockWexPayTableAccount(tx, existing.id);
    const account = await getTableAccountSnapshot(tx, existing.id);
    const blockReason = closeTableBlockReason(account);
    if (blockReason) {
      throw new WexPayValidationError(blockReason);
    }

    await tx.receiptRequest.updateMany({
      where: { tableId: existing.id, status: ReceiptStatus.REQUESTED },
      data: { status: ReceiptStatus.PRINTED, printedAt: new Date() },
    });

    await tx.payment.updateMany({
      where: { tableId: existing.id },
      data: { receiptRequested: false },
    });

    await tx.customerOrder.updateMany({
      where: { tableId: existing.id },
      data: { receiptRequested: false },
    });

    const closedAt = new Date();
    const table = await tx.restaurantTable.update({
      where: { id: existing.id },
      data: { status: TableStatus.EMPTY, lastClosedAt: closedAt },
    });

    await tx.businessNotification.create({
      data: {
        branchId: existing.branchId,
        type: NotificationType.TABLE_UPDATED,
        title: "Masa kapatıldı",
        message: `${existing.label} kapatıldı.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.table.closed",
      entityType: "RestaurantTable",
      entityId: table.id,
      metadata: {
        branchId: existing.branchId,
        label: existing.label,
        totalAmount: account.totalAmount,
        paidAmount: account.paidAmount,
      },
    });

    return table;
  });
}

export async function markReceiptPrinted(context: WexPayMutationContext, input: { tableId: string }) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertTableInOrg(tx, context.organizationId, input.tableId);
    const account = await getTableAccountSnapshot(tx, existing.id);

    if (!account.receiptRequested) {
      throw new WexPayValidationError("Bu masada açık fiş talebi bulunmuyor.");
    }

    const updatedRequests = await tx.receiptRequest.updateMany({
      where: { tableId: existing.id, status: ReceiptStatus.REQUESTED },
      data: { status: ReceiptStatus.PRINTED, printedAt: new Date() },
    });

    await tx.payment.updateMany({
      where: { tableId: existing.id, receiptRequested: true },
      data: { receiptRequested: false },
    });

    await tx.customerOrder.updateMany({
      where: { tableId: existing.id, receiptRequested: true },
      data: { receiptRequested: false },
    });

    await syncTableStatus(tx, existing.id);

    await tx.businessNotification.create({
      data: {
        branchId: existing.branchId,
        type: NotificationType.RECEIPT_REQUESTED,
        title: "Fiş yazdırıldı",
        message: `${existing.label} için fiş yazdırıldı olarak işaretlendi.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.receipt.printed",
      entityType: "RestaurantTable",
      entityId: existing.id,
      metadata: {
        branchId: existing.branchId,
        label: existing.label,
        requestCount: updatedRequests.count,
      },
    });

    return existing;
  });
}

// ---------------------------------------------------------------------------
// Menu category
// ---------------------------------------------------------------------------

export async function createCategory(
  context: WexPayMutationContext,
  input: { branchId: string; name: string },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const last = await tx.menuCategory.findFirst({
        where: { branchId: input.branchId },
        orderBy: { sortOrder: "desc" },
      });

      const category = await tx.menuCategory.create({
        data: {
          branchId: input.branchId,
          name: input.name,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.menu_category.created",
        entityType: "MenuCategory",
        entityId: category.id,
        metadata: { branchId: input.branchId, name: category.name },
      });

      return category;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir kategori zaten var.");
    }
    throw error;
  }
}

export async function updateCategory(
  context: WexPayMutationContext,
  input: { categoryId: string; name: string; sortOrder?: number; isActive?: boolean },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertCategoryInOrg(tx, context.organizationId, input.categoryId);

      const category = await tx.menuCategory.update({
        where: { id: input.categoryId },
        data: {
          name: input.name,
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.menu_category.updated",
        entityType: "MenuCategory",
        entityId: category.id,
        metadata: { name: category.name, isActive: category.isActive },
      });

      return category;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir kategori zaten var.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Menu product
// ---------------------------------------------------------------------------

export async function createProduct(
  context: WexPayMutationContext,
  input: {
    branchId: string;
    categoryId: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isPopular: boolean;
  },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    await assertBranchInOrg(tx, context.organizationId, input.branchId);

    const category = await tx.menuCategory.findFirst({
      where: { id: input.categoryId, branchId: input.branchId },
    });
    if (!category) {
      throw new WexPayValidationError("Seçilen kategori bu şubeye ait değil.");
    }

    const currentProducts = await countOrgProducts(tx, context.organizationId);
    await enforceEntitlementLimit(tx, context, "product_limit", currentProducts);

    const product = await tx.menuProduct.create({
      data: {
        branchId: input.branchId,
        categoryId: category.id,
        name: input.name,
        description: input.description,
        price: input.price,
        currency: "TRY",
        imageUrl: input.imageUrl,
        isPopular: input.isPopular,
        isActive: true,
        inStock: true,
      },
    });

    await tx.businessNotification.create({
      data: {
        branchId: input.branchId,
        type: NotificationType.MENU_UPDATED,
        title: "Yeni ürün eklendi",
        message: `${product.name} menüye eklendi.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.menu_product.created",
      entityType: "MenuProduct",
      entityId: product.id,
      metadata: { branchId: input.branchId, categoryId: category.id, name: product.name, price: input.price },
    });

    return product;
  });
}

export async function updateProduct(
  context: WexPayMutationContext,
  input: {
    productId: string;
    categoryId: string | null;
    name: string;
    description: string | null;
    price?: number;
    imageUrl: string | null;
    isActive?: boolean;
    inStock?: boolean;
    isPopular?: boolean;
  },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertProductInOrg(tx, context.organizationId, input.productId);

    if (input.categoryId) {
      const category = await tx.menuCategory.findFirst({
        where: { id: input.categoryId, branchId: existing.branchId },
      });
      if (!category) {
        throw new WexPayValidationError("Seçilen kategori bu şubeye ait değil.");
      }
    }

    const product = await tx.menuProduct.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.price === undefined ? {} : { price: input.price }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.inStock === undefined ? {} : { inStock: input.inStock }),
        ...(input.isPopular === undefined ? {} : { isPopular: input.isPopular }),
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.menu_product.updated",
      entityType: "MenuProduct",
      entityId: product.id,
      metadata: { name: product.name, isActive: product.isActive, inStock: product.inStock },
    });

    return product;
  });
}

// ---------------------------------------------------------------------------
// Modifier groups / options / product links
// ---------------------------------------------------------------------------

export async function createModifierGroup(
  context: WexPayMutationContext,
  input: {
    branchId: string;
    name: string;
    selectionType: "SINGLE" | "MULTI";
    minSelect: number;
    maxSelect: number;
  },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const last = await tx.menuModifierGroup.findFirst({
        where: { branchId: input.branchId },
        orderBy: { sortOrder: "desc" },
      });

      const group = await tx.menuModifierGroup.create({
        data: {
          branchId: input.branchId,
          name: input.name,
          selectionType:
            input.selectionType === "MULTI"
              ? MenuModifierSelectionType.MULTI
              : MenuModifierSelectionType.SINGLE,
          minSelect: input.minSelect,
          maxSelect: input.selectionType === "SINGLE" ? 1 : input.maxSelect,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.modifier_group.created",
        entityType: "MenuModifierGroup",
        entityId: group.id,
        metadata: {
          branchId: input.branchId,
          name: group.name,
          selectionType: group.selectionType,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
        },
      });

      return group;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir modifier grubu zaten var.");
    }
    throw error;
  }
}

export async function updateModifierGroup(
  context: WexPayMutationContext,
  input: {
    groupId: string;
    name: string;
    selectionType: "SINGLE" | "MULTI";
    minSelect: number;
    maxSelect: number;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertModifierGroupInOrg(tx, context.organizationId, input.groupId);

      const group = await tx.menuModifierGroup.update({
        where: { id: input.groupId },
        data: {
          name: input.name,
          selectionType:
            input.selectionType === "MULTI"
              ? MenuModifierSelectionType.MULTI
              : MenuModifierSelectionType.SINGLE,
          minSelect: input.minSelect,
          maxSelect: input.selectionType === "SINGLE" ? 1 : input.maxSelect,
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.modifier_group.updated",
        entityType: "MenuModifierGroup",
        entityId: group.id,
        metadata: {
          name: group.name,
          selectionType: group.selectionType,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isActive: group.isActive,
        },
      });

      return group;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu şubede aynı isimde bir modifier grubu zaten var.");
    }
    throw error;
  }
}

export async function createModifierOption(
  context: WexPayMutationContext,
  input: { groupId: string; name: string; priceDelta: number },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertModifierGroupInOrg(tx, context.organizationId, input.groupId);

      const last = await tx.menuModifierOption.findFirst({
        where: { groupId: input.groupId },
        orderBy: { sortOrder: "desc" },
      });

      const option = await tx.menuModifierOption.create({
        data: {
          groupId: input.groupId,
          name: input.name,
          priceDelta: input.priceDelta,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          isActive: true,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.modifier_option.created",
        entityType: "MenuModifierOption",
        entityId: option.id,
        metadata: { groupId: input.groupId, name: option.name, priceDelta: Number(option.priceDelta) },
      });

      return option;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu grupta aynı isimde bir seçenek zaten var.");
    }
    throw error;
  }
}

export async function updateModifierOption(
  context: WexPayMutationContext,
  input: {
    optionId: string;
    name: string;
    priceDelta: number;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertModifierOptionInOrg(tx, context.organizationId, input.optionId);

      const option = await tx.menuModifierOption.update({
        where: { id: input.optionId },
        data: {
          name: input.name,
          priceDelta: input.priceDelta,
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.modifier_option.updated",
        entityType: "MenuModifierOption",
        entityId: option.id,
        metadata: {
          name: option.name,
          priceDelta: Number(option.priceDelta),
          isActive: option.isActive,
        },
      });

      return option;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Bu grupta aynı isimde bir seçenek zaten var.");
    }
    throw error;
  }
}

export async function setProductModifierGroups(
  context: WexPayMutationContext,
  input: { productId: string; groupIds: string[] },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const product = await assertProductInOrg(tx, context.organizationId, input.productId);

    if (input.groupIds.length > 0) {
      const groups = await tx.menuModifierGroup.findMany({
        where: {
          id: { in: input.groupIds },
          branchId: product.branchId,
        },
        select: { id: true },
      });
      if (groups.length !== input.groupIds.length) {
        throw new WexPayValidationError("Seçilen modifier grupları bu şubeye ait değil.");
      }
    }

    await tx.menuProductModifierGroup.deleteMany({
      where: { productId: product.id, branchId: product.branchId },
    });

    if (input.groupIds.length > 0) {
      await tx.menuProductModifierGroup.createMany({
        data: input.groupIds.map((groupId, index) => ({
          branchId: product.branchId,
          productId: product.id,
          groupId,
          sortOrder: index,
          isActive: true,
        })),
      });
    }

    await writeWexPayAudit(tx, context, {
      action: "wexpay.product_modifier_links.updated",
      entityType: "MenuProduct",
      entityId: product.id,
      metadata: { groupIds: input.groupIds },
    });

    return { productId: product.id, groupIds: input.groupIds };
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function generateOrderNo() {
  return `WX-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

export type ResolvedOrderItems = {
  orderItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    modifiers: Array<{
      groupId: string;
      optionId: string;
      groupName: string;
      optionName: string;
      priceDelta: number;
      sortOrder: number;
    }>;
  }>;
  subtotal: number;
};

/**
 * Loads products + active modifier catalog for the branch, validates selections,
 * and computes server-side line totals + immutable modifier snapshots.
 * Client-provided totals / names / deltas are never trusted.
 */
export async function resolveOrderItems(
  tx: TenantDb,
  branchId: string,
  items: OrderItemInput[],
): Promise<ResolvedOrderItems> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.menuProduct.findMany({
    where: { id: { in: productIds }, branchId },
    include: {
      productModifierGroups: {
        where: { isActive: true },
        include: {
          group: {
            include: {
              options: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new WexPayValidationError("Seçilen ürün bu şubeye ait değil.");

    const priced = priceOrderLine({
      product: {
        id: product.id,
        branchId: product.branchId,
        name: product.name,
        price: product.price,
        isActive: product.isActive,
        inStock: product.inStock,
        productModifierGroups: product.productModifierGroups.map((link) => ({
          groupId: link.groupId,
          sortOrder: link.sortOrder,
          isActive: link.isActive,
          group: {
            id: link.group.id,
            branchId: link.group.branchId,
            name: link.group.name,
            selectionType: link.group.selectionType,
            minSelect: link.group.minSelect,
            maxSelect: link.group.maxSelect,
            sortOrder: link.group.sortOrder,
            isActive: link.group.isActive,
            options: link.group.options.map((option) => ({
              id: option.id,
              groupId: option.groupId,
              name: option.name,
              priceDelta: option.priceDelta,
              sortOrder: option.sortOrder,
              isActive: option.isActive,
            })),
          },
        })),
      },
      branchId,
      quantity: item.quantity,
      modifierOptionIds: item.modifierOptionIds,
    });

    return {
      productId: priced.productId,
      productName: priced.productName,
      quantity: priced.quantity,
      unitPrice: priced.unitPrice,
      totalPrice: priced.totalPrice,
      modifiers: priced.modifiers,
    };
  });

  return { orderItems, subtotal: sumPricedLinesSubtotal(orderItems) };
}

function orderItemsCreateInput(orderItems: ResolvedOrderItems["orderItems"]) {
  return orderItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    ...(item.modifiers.length > 0
      ? {
          modifiers: {
            create: item.modifiers.map((modifier) => ({
              groupId: modifier.groupId,
              optionId: modifier.optionId,
              groupName: modifier.groupName,
              optionName: modifier.optionName,
              priceDelta: modifier.priceDelta,
              sortOrder: modifier.sortOrder,
            })),
          },
        }
      : {}),
  }));
}

export async function createOrder(
  context: WexPayMutationContext,
  input: { branchId: string; tableId: string; note: string | null; items: OrderItemInput[] },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const table = await assertTableInOrg(tx, context.organizationId, input.tableId);
      if (table.branchId !== input.branchId) {
        throw new WexPayValidationError("Masa bu şubeye ait değil.");
      }

      const { orderItems, subtotal } = await resolveOrderItems(tx, input.branchId, input.items);

      const order = await tx.customerOrder.create({
        data: {
          orderNo: generateOrderNo(),
          branchId: input.branchId,
          tableId: table.id,
          status: OrderStatus.NEW,
          note: input.note,
          subtotal,
          items: { create: orderItemsCreateInput(orderItems) },
        },
        include: { table: true, items: { orderBy: { id: "asc" }, include: { modifiers: { orderBy: { sortOrder: "asc" } } } } },
      });

      await syncTableStatus(tx, table.id);

      await tx.businessNotification.create({
        data: {
          branchId: input.branchId,
          orderId: order.id,
          type: NotificationType.ORDER_CREATED,
          title: "Yeni sipariş alındı",
          message: `${table.label} için yeni sipariş oluşturuldu.`,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.order.created",
        entityType: "CustomerOrder",
        entityId: order.id,
        metadata: {
          branchId: input.branchId,
          tableId: table.id,
          orderNo: order.orderNo,
          itemCount: orderItems.length,
          subtotal,
        },
      });

      return order;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Sipariş numarası çakıştı, lütfen tekrar deneyin.");
    }
    throw error;
  }
}

export async function updateOrderStatus(
  context: WexPayMutationContext,
  input: { orderId: string; status: OrderStatus },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertOrderInOrg(tx, context.organizationId, input.orderId);
    const now = new Date();

    const order = await tx.customerOrder.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        servedAt: input.status === OrderStatus.SERVED ? existing.servedAt ?? now : existing.servedAt,
        cancelledAt: input.status === OrderStatus.CANCELLED ? existing.cancelledAt ?? now : existing.cancelledAt,
      },
      include: { table: true, items: { orderBy: { id: "asc" } } },
    });

    await syncTableStatus(tx, existing.tableId);

    await tx.businessNotification.create({
      data: {
        branchId: existing.branchId,
        orderId: order.id,
        type: NotificationType.ORDER_UPDATED,
        title: "Sipariş durumu güncellendi",
        message: `${order.orderNo} durumu ${input.status} olarak güncellendi.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.order.updated",
      entityType: "CustomerOrder",
      entityId: order.id,
      metadata: { before: existing.status, after: input.status },
    });

    return order;
  });
}

// ---------------------------------------------------------------------------
// Payments (operational WexPay payments — NOT Core BillingPayment)
// ---------------------------------------------------------------------------

export type CreatePaymentResult = {
  payment: PaymentWithRelations;
  externalCheckoutUrl: string | null;
};

type PaymentWithRelations = {
  id: string;
  branchId: string;
  tableId: string;
  orderId: string | null;
  amount: unknown;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  providerRef: string | null;
  paidAt: Date | null;
  receiptRequested: boolean;
  createdAt: Date;
  table: { id: string; label: string };
  order: { id: string; orderNo: string } | null;
};

export async function createPayment(
  context: WexPayMutationContext,
  input: {
    branchId: string;
    tableId: string;
    orderId: string | null;
    amount: number;
    status: PaymentStatus;
    provider: WexPayPaymentProviderKey;
    receiptRequested?: boolean;
  },
): Promise<CreatePaymentResult> {
  assertManage(context);

  const { key: providerKey, adapter } = await resolveWexPayPaymentProvider(input.provider);
  const receiptRequested = Boolean(input.receiptRequested);
  const wantsExternalCheckout = providerKey === "paytr";

  // Phase 1 — lock table, validate remaining, persist payment (PENDING for external PSP).
  // External PayTR HTTP must NOT run inside this transaction.
  const reserved = await runInTransaction(async (tx) => {
    await assertBranchInOrg(tx, context.organizationId, input.branchId);

    const table = await tx.restaurantTable.findFirst({
      where: { id: input.tableId, branchId: input.branchId },
    });
    if (!table) throw new WexPayValidationError("Masa bu şubeye ait değil.");

    // Lock order: table account only (see lib/wexpay-locks.ts).
    await lockWexPayTableAccount(tx, table.id);

    if (input.orderId) {
      const order = await tx.customerOrder.findFirst({
        where: { id: input.orderId, branchId: input.branchId, tableId: table.id },
      });
      if (!order) throw new WexPayValidationError("Sipariş bu masa ve şube ile eşleşmiyor.");
    }

    const isPaidLike = input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL;
    const currentAccount = await getTableAccountSnapshot(tx, table.id);
    const shouldValidateAgainstAccount =
      input.status === PaymentStatus.PAID ||
      input.status === PaymentStatus.PARTIAL ||
      input.status === PaymentStatus.PENDING ||
      wantsExternalCheckout;
    if (shouldValidateAgainstAccount && currentAccount.totalAmount <= 0) {
      throw new WexPayValidationError("Ödeme kaydı için açık adisyon bulunmuyor.");
    }
    if (shouldValidateAgainstAccount && input.amount > currentAccount.remainingAmount) {
      throw new WexPayValidationError("Ödeme tutarı kalan adisyondan büyük olamaz.");
    }

    if (wantsExternalCheckout) {
      const providerRef = generatePaytrMerchantOid();
      const payment = await tx.payment.create({
        data: {
          branchId: input.branchId,
          tableId: table.id,
          orderId: input.orderId,
          amount: input.amount,
          currency: "TRY",
          status: PaymentStatus.PENDING,
          provider: providerKey,
          providerRef,
          paidAt: null,
          receiptRequested,
        },
        include: { table: true, order: true },
      });

      if (receiptRequested) {
        await recordReceiptRequest(tx, {
          tableId: table.id,
          branchId: input.branchId,
          tableLabel: table.label,
          orderId: input.orderId,
          paymentId: payment.id,
          note: "Operasyon panelinden ödeme sırasında fiş talep edildi.",
        });
      }

      const account = await syncTableStatus(tx, table.id);

      await tx.businessNotification.create({
        data: {
          branchId: input.branchId,
          orderId: input.orderId,
          paymentId: payment.id,
          type: NotificationType.PAYMENT_RECEIVED,
          title: "Sanal POS ödemesi bekleniyor",
          message: `${table.label} için PayTR sanal POS ödemesi başlatıldı (${input.amount} TRY).`,
        },
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.payment.created",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          branchId: input.branchId,
          tableId: table.id,
          orderId: input.orderId,
          amount: input.amount,
          status: payment.status,
          provider: providerKey,
          providerRef,
          requiresExternalCheckout: true,
          remainingAmount: account.remainingAmount,
          externalCheckoutStarted: false,
        },
      });

      return {
        kind: "external" as const,
        payment,
        providerRef,
        tableLabel: table.label,
      };
    }

    const intent = await adapter.createPaymentIntent({
      organizationId: context.organizationId,
      branchId: input.branchId,
      tableId: table.id,
      orderId: input.orderId,
      amount: input.amount,
      currency: "TRY",
      clientIp: context.ipAddress,
    });

    if (intent.requiresExternalCheckout) {
      throw new WexPayValidationError("Bu sağlayıcı için harici checkout desteklenmiyor.");
    }

    const payment = await tx.payment.create({
      data: {
        branchId: input.branchId,
        tableId: table.id,
        orderId: input.orderId,
        amount: input.amount,
        currency: "TRY",
        status: input.status,
        provider: providerKey,
        providerRef: intent.providerRef,
        paidAt: isPaidLike ? new Date() : null,
        receiptRequested,
      },
      include: { table: true, order: true },
    });

    if (receiptRequested) {
      await recordReceiptRequest(tx, {
        tableId: table.id,
        branchId: input.branchId,
        tableLabel: table.label,
        orderId: input.orderId,
        paymentId: payment.id,
        note: "Operasyon panelinden ödeme sırasında fiş talep edildi.",
      });

      await writeWexPayAudit(tx, context, {
        action: "wexpay.receipt.requested",
        entityType: "ReceiptRequest",
        entityId: payment.id,
        metadata: {
          source: "operator_payment",
          branchId: input.branchId,
          tableId: table.id,
          paymentId: payment.id,
          orderId: input.orderId,
          amount: input.amount,
        },
      });
    }

    const account = await syncTableStatus(tx, table.id);

    await tx.businessNotification.create({
      data: {
        branchId: input.branchId,
        orderId: input.orderId,
        paymentId: payment.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Ödeme kaydedildi",
        message: `${table.label} için ${input.amount} tutarında ödeme kaydı oluşturuldu.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.payment.created",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        branchId: input.branchId,
        tableId: table.id,
        orderId: input.orderId,
        amount: input.amount,
        status: payment.status,
        provider: providerKey,
        providerRef: intent.providerRef,
        requiresExternalCheckout: false,
        remainingAmount: account.remainingAmount,
        externalCheckoutStarted: false,
      },
    });

    return { kind: "settled" as const, payment, externalCheckoutUrl: null as string | null };
  });

  if (reserved.kind === "settled") {
    return { payment: reserved.payment, externalCheckoutUrl: reserved.externalCheckoutUrl };
  }

  // Phase 2 — provider intent outside the lock/transaction.
  try {
    const intent = await adapter.createPaymentIntent({
      organizationId: context.organizationId,
      branchId: input.branchId,
      tableId: input.tableId,
      orderId: input.orderId,
      amount: input.amount,
      currency: "TRY",
      clientIp: context.ipAddress,
      existingProviderRef: reserved.providerRef,
    });

    if (!intent.externalCheckoutUrl) {
      throw new WexPayValidationError("PayTR ödeme oturumu oluşturulamadı. Lütfen tekrar deneyin.");
    }

    return { payment: reserved.payment, externalCheckoutUrl: intent.externalCheckoutUrl };
  } catch (error) {
    await runInTransaction(async (tx) => {
      await lockWexPayTableAccount(tx, input.tableId);
      await tx.payment.updateMany({
        where: {
          id: reserved.payment.id,
          status: PaymentStatus.PENDING,
          provider: providerKey,
        },
        data: { status: PaymentStatus.FAILED },
      });
      await syncTableStatus(tx, input.tableId);
      await writeWexPayAudit(tx, context, {
        action: "wexpay.payment.external_intent_failed",
        entityType: "Payment",
        entityId: reserved.payment.id,
        metadata: {
          provider: providerKey,
          providerRef: reserved.providerRef,
          tableId: input.tableId,
        },
      });
    });
    throw error;
  }
}

export async function settlePaymentFromProviderWebhook(
  input: {
    paymentId: string;
    organizationId: string;
    status: PaymentStatus;
    provider: WexPayPaymentProviderKey;
    providerRef: string;
    ipAddress?: string | null;
    webhookEventId: string;
  },
  tx: TenantDb = prisma,
) {
  const payment = await assertPaymentInOrg(tx, input.organizationId, input.paymentId);
  if (payment.provider !== input.provider || payment.providerRef !== input.providerRef) {
    throw new WexPayValidationError("Ödeme sağlayıcı referansı eşleşmiyor.");
  }

  // Lock order: table account only (see lib/wexpay-locks.ts). Re-read after lock.
  await lockWexPayTableAccount(tx, payment.tableId);
  const lockedPayment = await assertPaymentInOrg(tx, input.organizationId, input.paymentId);

  const terminalStatuses: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.REFUNDED];
  if (terminalStatuses.includes(lockedPayment.status)) {
    return { payment: lockedPayment, skipped: true as const };
  }

  if (input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL) {
    const account = await getTableAccountSnapshot(tx, lockedPayment.tableId);
    const amount = Number(lockedPayment.amount);
    const alreadySettled =
      lockedPayment.status === PaymentStatus.PAID || lockedPayment.status === PaymentStatus.PARTIAL;
    const nextPaid = account.paidAmount + (alreadySettled ? 0 : amount);
    if (account.totalAmount <= 0) {
      throw new WexPayValidationError("Ödeme kaydı için açık adisyon bulunmuyor.");
    }
    if (nextPaid > account.totalAmount + 0.001) {
      throw new WexPayValidationError("Ödeme tutarı kalan adisyondan büyük olamaz.");
    }
  }

  const isPaidLike = input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL;
  const updated = await tx.payment.update({
    where: { id: lockedPayment.id },
    data: {
      status: input.status,
      paidAt: isPaidLike ? new Date() : null,
    },
  });

  await syncTableStatus(tx, lockedPayment.tableId);

  await writeAuditLog(
    {
      action: "wexpay.payment.provider_settled",
      organizationId: input.organizationId,
      entityType: "Payment",
      entityId: lockedPayment.id,
      ipAddress: input.ipAddress ?? null,
      source: "wexpay_webhook",
      metadata: {
        provider: input.provider,
        providerRef: input.providerRef,
        status: input.status,
        webhookEventId: input.webhookEventId,
      },
    },
    tx,
  );

  return { payment: updated, skipped: false as const };
}

export async function regeneratePaytrCheckout(
  context: WexPayMutationContext,
  input: { paymentId: string },
): Promise<{ paymentId: string; externalCheckoutUrl: string; providerRef: string }> {
  assertManage(context);

  const existing = await assertPaymentInOrg(prisma, context.organizationId, input.paymentId);
  if (existing.provider !== "paytr" || existing.status !== PaymentStatus.PENDING) {
    throw new WexPayValidationError("Yalnızca bekleyen PayTR ödemeleri için checkout yenilenebilir.");
  }
  if (!existing.providerRef) {
    throw new WexPayValidationError("PayTR referansı bulunamadı.");
  }

  const { adapter } = await resolveWexPayPaymentProvider("paytr");
  const intent = await adapter.createPaymentIntent({
    organizationId: context.organizationId,
    branchId: existing.branchId,
    tableId: existing.tableId,
    orderId: existing.orderId,
    amount: Number(existing.amount),
    currency: "TRY",
    clientIp: context.ipAddress,
    existingProviderRef: existing.providerRef,
  });

  if (!intent.externalCheckoutUrl) {
    throw new WexPayValidationError("PayTR ödeme oturumu oluşturulamadı.");
  }

  await writeAuditLog({
    action: "wexpay.payment.paytr_checkout_regenerated",
    organizationId: context.organizationId,
    entityType: "Payment",
    entityId: existing.id,
    ipAddress: context.ipAddress ?? null,
    source: "wexpay_ui",
    metadata: {
      providerRef: existing.providerRef,
    },
  });

  return {
    paymentId: existing.id,
    externalCheckoutUrl: intent.externalCheckoutUrl,
    providerRef: existing.providerRef,
  };
}

export async function updatePayment(
  context: WexPayMutationContext,
  input: { paymentId: string; status: PaymentStatus },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertPaymentInOrg(tx, context.organizationId, input.paymentId);

    // Lock order: table account only (see lib/wexpay-locks.ts).
    await lockWexPayTableAccount(tx, existing.tableId);
    const locked = await assertPaymentInOrg(tx, context.organizationId, input.paymentId);

    if (
      locked.provider === "paytr" &&
      locked.status === PaymentStatus.PENDING &&
      input.status !== PaymentStatus.FAILED
    ) {
      throw new WexPayValidationError(
        "Bekleyen PayTR ödemesi yalnızca başarısız olarak işaretlenebilir veya webhook ile tamamlanır.",
      );
    }

    const isPaidLike = input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL;
    const wasPaidLike = locked.status === PaymentStatus.PAID || locked.status === PaymentStatus.PARTIAL;

    if (isPaidLike) {
      const currentAccount = await getTableAccountSnapshot(tx, locked.tableId);
      const availableAmount = currentAccount.remainingAmount + (wasPaidLike ? Number(locked.amount) : 0);
      if (currentAccount.totalAmount <= 0) {
        throw new WexPayValidationError("Ödeme kaydı için açık adisyon bulunmuyor.");
      }
      if (Number(locked.amount) > availableAmount) {
        throw new WexPayValidationError("Ödeme tutarı kalan adisyondan büyük olamaz.");
      }
    }

    const payment = await tx.payment.update({
      where: { id: locked.id },
      data: {
        status: input.status,
        paidAt: isPaidLike ? locked.paidAt ?? new Date() : null,
      },
      include: { table: true, order: true },
    });

    const account = await syncTableStatus(tx, locked.tableId);

    await tx.businessNotification.create({
      data: {
        branchId: locked.branchId,
        orderId: locked.orderId,
        paymentId: payment.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Ödeme durumu güncellendi",
        message: `${payment.table.label} için ödeme durumu ${input.status} olarak güncellendi.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action:
        locked.provider === "paytr" && input.status === PaymentStatus.FAILED
          ? "wexpay.payment.operator_failed"
          : "wexpay.payment.updated",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { before: locked.status, after: input.status, tableId: locked.tableId, remainingAmount: account.remainingAmount },
    });

    return payment;
  });
}

// ---------------------------------------------------------------------------
// Public QR order (no operator session). Tenant is resolved from the QR table
// by the caller; this still re-verifies the table belongs to the org/branch
// chain and computes the subtotal server-side. Audit is written as
// `wexpay.order.created` with metadata source `public_qr`.
// ---------------------------------------------------------------------------

export async function createPublicOrder(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  items: OrderItemInput[];
  note: string | null;
  receiptRequested?: boolean;
  ipAddress: string | null;
}) {
  try {
    return await runInTransaction(async (tx) => {
      const table = await tx.restaurantTable.findFirst({
        where: {
          id: input.tableId,
          branchId: input.branchId,
          isActive: true,
          branch: { restaurant: { organizationId: input.organizationId } },
        },
      });
      if (!table) throw new WexPayValidationError("Masa bulunamadı.");

      const { orderItems, subtotal } = await resolveOrderItems(tx, input.branchId, input.items);
      const receiptRequested = Boolean(input.receiptRequested);

      const order = await tx.customerOrder.create({
        data: {
          orderNo: generateOrderNo(),
          branchId: input.branchId,
          tableId: table.id,
          status: OrderStatus.NEW,
          note: input.note,
          subtotal,
          receiptRequested,
          items: { create: orderItemsCreateInput(orderItems) },
        },
        include: { table: true, items: { orderBy: { id: "asc" }, include: { modifiers: { orderBy: { sortOrder: "asc" } } } } },
      });

      if (receiptRequested) {
        await recordReceiptRequest(tx, {
          tableId: table.id,
          branchId: input.branchId,
          tableLabel: table.label,
          orderId: order.id,
          note: input.note ? `QR sipariş fiş talebi: ${input.note}` : "QR sipariş ekranından fiş talep edildi.",
        });

        await writeAuditLog(
          {
            action: "wexpay.receipt.requested",
            organizationId: input.organizationId,
            userId: null,
            entityType: "ReceiptRequest",
            entityId: order.id,
            ipAddress: input.ipAddress,
            source: "wexpay_public",
            metadata: {
              source: "public_qr",
              branchId: input.branchId,
              tableId: table.id,
              orderId: order.id,
              orderNo: order.orderNo,
            },
          },
          tx,
        );
      }

      await syncTableStatus(tx, table.id);

      await tx.businessNotification.create({
        data: {
          branchId: input.branchId,
          orderId: order.id,
          type: NotificationType.ORDER_CREATED,
          title: "QR sipariş alındı",
          message: `${table.label} için QR üzerinden sipariş oluşturuldu.`,
        },
      });

      await writeAuditLog(
        {
          action: "wexpay.order.created",
          organizationId: input.organizationId,
          userId: null,
          entityType: "CustomerOrder",
          entityId: order.id,
          ipAddress: input.ipAddress,
          source: "wexpay_public",
          metadata: {
            source: "public_qr",
            branchId: input.branchId,
            tableId: table.id,
            orderNo: order.orderNo,
            itemCount: orderItems.length,
            subtotal,
            receiptRequested,
          },
        },
        tx,
      );

      return order;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new WexPayValidationError("Sipariş numarası çakıştı, lütfen tekrar deneyin.");
    }
    throw error;
  }
}

export type PublicTableBillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderNo: string;
  status: string;
  modifiers: Array<{
    groupName: string;
    optionName: string;
    priceDelta: number;
    sortOrder: number;
  }>;
};

export async function getPublicTableBill(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
}) {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branchId: input.branchId,
      isActive: true,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
    include: {
      orders: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          subtotal: true,
          createdAt: true,
          receiptRequested: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              modifiers: {
                select: {
                  groupName: true,
                  optionName: true,
                  priceDelta: true,
                  sortOrder: true,
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        select: { status: true, amount: true, receiptRequested: true, createdAt: true },
      },
      receiptRequests: { select: { status: true, createdAt: true } },
    },
  });

  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  const sessionOrders = filterTableSessionRecords(table.orders, table.lastClosedAt, table.orders);
  const sessionPayments = filterTableSessionRecords(table.payments, table.lastClosedAt, table.orders);
  const sessionReceiptRequests = filterTableSessionRecords(table.receiptRequests, table.lastClosedAt, table.orders);
  const account = calculateTableAccount({
    orders: sessionOrders,
    payments: sessionPayments,
    receiptRequests: sessionReceiptRequests,
  });

  const lines: PublicTableBillLine[] = sessionOrders.flatMap((order) =>
    order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.totalPrice),
      orderNo: order.orderNo,
      status: String(order.status),
      modifiers: item.modifiers.map((modifier) => ({
        groupName: modifier.groupName,
        optionName: modifier.optionName,
        priceDelta: Number(modifier.priceDelta),
        sortOrder: modifier.sortOrder,
      })),
    })),
  );

  return {
    totalAmount: account.totalAmount,
    paidAmount: account.paidAmount,
    remainingAmount: account.remainingAmount,
    status: account.status,
    empty: lines.length === 0 && account.totalAmount === 0,
    lines,
  };
}

export async function createPublicTableAssistNotification(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  kind: "payment_request" | "waiter_call";
  reason?: string | null;
  note?: string | null;
  ipAddress: string | null;
}) {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branchId: input.branchId,
      isActive: true,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
  });
  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  const isPayment = input.kind === "payment_request";
  const title = isPayment
    ? `[ÖDEME TALEBİ] ${table.label}`
    : `[GARSON ÇAĞRISI] ${table.label}`;
  const reasonPart = input.reason?.trim() ? ` Sebep: ${input.reason.trim()}.` : "";
  const notePart = input.note?.trim() ? ` Not: ${input.note.trim()}` : "";
  const message = isPayment
    ? `${table.label} için müşteri ödeme talebi gönderdi.${reasonPart}${notePart}`
    : `${table.label} için garson çağrısı alındı.${reasonPart}${notePart}`;

  const notification = await prisma.businessNotification.create({
    data: {
      branchId: input.branchId,
      type: NotificationType.TABLE_UPDATED,
      title,
      message,
    },
  });

  await writeAuditLog({
    action: isPayment ? "wexpay.public.payment_request" : "wexpay.public.waiter_call",
    organizationId: input.organizationId,
    userId: null,
    entityType: "BusinessNotification",
    entityId: notification.id,
    ipAddress: input.ipAddress,
    source: "wexpay_public",
    metadata: {
      source: "public_qr",
      kind: input.kind,
      branchId: input.branchId,
      tableId: table.id,
      reason: input.reason ?? null,
    },
  });

  return { id: notification.id, title };
}
