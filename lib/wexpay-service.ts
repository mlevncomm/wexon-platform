import { randomUUID } from "crypto";
import { NotificationType, OrderStatus, PaymentStatus, type Prisma, ReceiptStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { assertEntitlementLimit, type CoreEntitlementMap } from "@/lib/wexon-core-access";
import { calculateTableAccount, filterTableSessionRecords, type TableAccountSnapshot } from "@/lib/wexpay-account";
import {
  assertBranchInOrg,
  assertCategoryInOrg,
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
      await assertRestaurantInOrg(tx, context.organizationId, input.restaurantId);

      const currentBranches = await countOrgBranches(tx, context.organizationId);
      const limit = assertEntitlementLimit(context.entitlementMap, "branch_limit", currentBranches);
      if (!limit.ok) {
        throw new WexPayValidationError(limit.message);
      }

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
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const currentTables = await countOrgTables(tx, context.organizationId);
      const limit = assertEntitlementLimit(context.entitlementMap, "table_limit", currentTables);
      if (!limit.ok) {
        throw new WexPayValidationError(limit.message);
      }

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
    const account = await getTableAccountSnapshot(tx, existing.id);

    if (account.hasOpenOrders) {
      throw new WexPayValidationError("Aktif sipariş varken masa kapatılamaz. Önce siparişleri servis edin veya iptal edin.");
    }
    if (account.remainingAmount > 0) {
      throw new WexPayValidationError("Kalan ödeme varken masa kapatılamaz. Önce adisyonu kapatın.");
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
    const limit = assertEntitlementLimit(context.entitlementMap, "product_limit", currentProducts);
    if (!limit.ok) {
      throw new WexPayValidationError(limit.message);
    }

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
  }>;
  subtotal: number;
};

/**
 * Loads the requested products scoped to the branch, validates that each
 * belongs to that branch and is active/in-stock, and computes server-side line
 * totals + subtotal. Client-provided totals are never trusted.
 */
export async function resolveOrderItems(
  tx: TenantDb,
  branchId: string,
  items: OrderItemInput[],
): Promise<ResolvedOrderItems> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.menuProduct.findMany({ where: { id: { in: productIds }, branchId } });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new WexPayValidationError("Seçilen ürün bu şubeye ait değil.");
    if (!product.isActive) throw new WexPayValidationError(`${product.name} pasif olduğu için siparişe eklenemez.`);
    if (!product.inStock) throw new WexPayValidationError(`${product.name} stokta olmadığı için siparişe eklenemez.`);

    const unitPrice = Number(product.price);
    const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;
    return { productId: product.id, productName: product.name, quantity: item.quantity, unitPrice, totalPrice };
  });

  const subtotal = Math.round(orderItems.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
  return { orderItems, subtotal };
}

export async function createOrder(
  context: WexPayMutationContext,
  input: { branchId: string; tableId: string; note: string | null; items: OrderItemInput[] },
) {
  assertManage(context);

  try {
    return await runInTransaction(async (tx) => {
      await assertBranchInOrg(tx, context.organizationId, input.branchId);

      const table = await tx.restaurantTable.findFirst({
        where: { id: input.tableId, branchId: input.branchId },
      });
      if (!table) throw new WexPayValidationError("Masa bu şubeye ait değil.");

      const { orderItems, subtotal } = await resolveOrderItems(tx, input.branchId, input.items);

      const order = await tx.customerOrder.create({
        data: {
          orderNo: generateOrderNo(),
          branchId: input.branchId,
          tableId: table.id,
          status: OrderStatus.NEW,
          note: input.note,
          subtotal,
          items: { create: orderItems },
        },
        include: { table: true, items: { orderBy: { id: "asc" } } },
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

export async function createPayment(
  context: WexPayMutationContext,
  input: {
    branchId: string;
    tableId: string;
    orderId: string | null;
    amount: number;
    status: PaymentStatus;
    provider: string | null;
  },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    await assertBranchInOrg(tx, context.organizationId, input.branchId);

    const table = await tx.restaurantTable.findFirst({
      where: { id: input.tableId, branchId: input.branchId },
    });
    if (!table) throw new WexPayValidationError("Masa bu şubeye ait değil.");

    if (input.orderId) {
      const order = await tx.customerOrder.findFirst({
        where: { id: input.orderId, branchId: input.branchId, tableId: table.id },
      });
      if (!order) throw new WexPayValidationError("Sipariş bu masa ve şube ile eşleşmiyor.");
    }

    const isPaidLike = input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL;
    const currentAccount = await getTableAccountSnapshot(tx, table.id);
    const shouldValidateAgainstAccount =
      input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL || input.status === PaymentStatus.PENDING;
    if (shouldValidateAgainstAccount && currentAccount.totalAmount <= 0) {
      throw new WexPayValidationError("Ödeme kaydı için açık adisyon bulunmuyor.");
    }
    if (shouldValidateAgainstAccount && input.amount > currentAccount.remainingAmount) {
      throw new WexPayValidationError("Ödeme tutarı kalan adisyondan büyük olamaz.");
    }

    const payment = await tx.payment.create({
      data: {
        branchId: input.branchId,
        tableId: table.id,
        orderId: input.orderId,
        amount: input.amount,
        currency: "TRY",
        status: input.status,
        provider: input.provider ?? "manual",
        paidAt: isPaidLike ? new Date() : null,
      },
      include: { table: true, order: true },
    });

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
        status: input.status,
        remainingAmount: account.remainingAmount,
      },
    });

    return payment;
  });
}

export async function updatePayment(
  context: WexPayMutationContext,
  input: { paymentId: string; status: PaymentStatus },
) {
  assertManage(context);

  return runInTransaction(async (tx) => {
    const existing = await assertPaymentInOrg(tx, context.organizationId, input.paymentId);
    const isPaidLike = input.status === PaymentStatus.PAID || input.status === PaymentStatus.PARTIAL;
    const wasPaidLike = existing.status === PaymentStatus.PAID || existing.status === PaymentStatus.PARTIAL;

    if (isPaidLike) {
      const currentAccount = await getTableAccountSnapshot(tx, existing.tableId);
      const availableAmount = currentAccount.remainingAmount + (wasPaidLike ? Number(existing.amount) : 0);
      if (currentAccount.totalAmount <= 0) {
        throw new WexPayValidationError("Ödeme kaydı için açık adisyon bulunmuyor.");
      }
      if (Number(existing.amount) > availableAmount) {
        throw new WexPayValidationError("Ödeme tutarı kalan adisyondan büyük olamaz.");
      }
    }

    const payment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        paidAt: isPaidLike ? existing.paidAt ?? new Date() : null,
      },
      include: { table: true, order: true },
    });

    const account = await syncTableStatus(tx, existing.tableId);

    await tx.businessNotification.create({
      data: {
        branchId: existing.branchId,
        orderId: existing.orderId,
        paymentId: payment.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Ödeme durumu güncellendi",
        message: `${payment.table.label} için ödeme durumu ${input.status} olarak güncellendi.`,
      },
    });

    await writeWexPayAudit(tx, context, {
      action: "wexpay.payment.updated",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { before: existing.status, after: input.status, tableId: existing.tableId, remainingAmount: account.remainingAmount },
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
          items: { create: orderItems },
        },
        include: { table: true, items: { orderBy: { id: "asc" } } },
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
