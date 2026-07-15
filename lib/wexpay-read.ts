import { OrderStatus, PaymentStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { coreEntitlementNumber, type CoreEntitlementMap, evaluateProductAccess } from "@/lib/wexon-core-access";
import { filterChargeableOrders, filterOperationalOrders, resolveOperationalTableSession } from "@/lib/wexpay-account";

/**
 * Tenant-scoped read queries for the real WexPay operator UI.
 *
 * Every query is filtered through the organizationId ownership chain
 * (organizationId -> Restaurant -> Branch -> ...). Restaurants with a null
 * organizationId are never returned. There is no demo slug or global fallback.
 */

export async function listOrgRestaurants(organizationId: string) {
  return prisma.restaurant.findMany({
    where: { organizationId },
    include: { _count: { select: { branches: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function listOrgBranches(organizationId: string, restaurantId?: string) {
  return prisma.branch.findMany({
    where: {
      restaurant: { organizationId },
      ...(restaurantId ? { restaurantId } : {}),
    },
    include: {
      restaurant: { select: { id: true, name: true } },
      _count: { select: { tables: true, products: true, categories: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listBranchTables(organizationId: string, branchId: string) {
  return prisma.restaurantTable.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    orderBy: { label: "asc" },
  });
}

export async function listBranchCategories(organizationId: string, branchId: string) {
  return prisma.menuCategory.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listBranchProducts(organizationId: string, branchId: string) {
  return prisma.menuProduct.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
}

/**
 * Resolve the active branch for a branch-scoped screen: prefer the requested
 * branch (verified in-org), else the org's first branch. Returns null if the
 * org has no branches.
 */
export async function resolveActiveBranch(organizationId: string, requestedBranchId?: string) {
  if (requestedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedBranchId, restaurant: { organizationId } },
      include: { restaurant: { select: { id: true, name: true } } },
    });
    if (branch) return branch;
  }

  return prisma.branch.findFirst({
    where: { restaurant: { organizationId } },
    include: { restaurant: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveActiveRestaurant(organizationId: string, requestedRestaurantId?: string) {
  if (requestedRestaurantId) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: requestedRestaurantId, organizationId },
    });
    if (restaurant) return restaurant;
  }

  return prisma.restaurant.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Orders & payments (Phase 2) — all org-chain filtered, null-org excluded.
// ---------------------------------------------------------------------------

const orderListInclude = {
  table: { select: { id: true, label: true } },
  items: { orderBy: { id: "asc" as const } },
  _count: { select: { payments: true } },
};

export async function listBranchOrders(organizationId: string, branchId: string) {
  return prisma.customerOrder.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export type KitchenOrderRow = OperationsOrder & {
  tableLabel: string;
};

const KITCHEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.SERVED];

export async function listBranchKitchenOrders(
  organizationId: string,
  branchId: string,
): Promise<KitchenOrderRow[]> {
  const orders = await prisma.customerOrder.findMany({
    where: {
      branchId,
      status: { in: KITCHEN_ORDER_STATUSES },
      branch: { restaurant: { organizationId } },
    },
    include: {
      table: { select: { label: true } },
      items: { orderBy: { id: "asc" } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const statusRank: Record<string, number> = { NEW: 0, PREPARING: 1, SERVED: 2 };

  return orders
    .map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      note: order.note,
      subtotal: Number(order.subtotal),
      createdAt: order.createdAt.toISOString(),
      tableLabel: order.table.label,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.totalPrice),
      })),
    }))
    .sort((left, right) => {
      const leftRank = statusRank[left.status] ?? 99;
      const rightRank = statusRank[right.status] ?? 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
}

export async function listOrgOrders(organizationId: string) {
  return prisma.customerOrder.findMany({
    where: { branch: { restaurant: { organizationId } } },
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getOrderDetail(organizationId: string, orderId: string) {
  return prisma.customerOrder.findFirst({
    where: { id: orderId, branch: { restaurant: { organizationId } } },
    include: {
      table: { select: { id: true, label: true } },
      branch: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

const paymentListInclude = {
  table: { select: { id: true, label: true } },
  order: { select: { id: true, orderNo: true } },
};

export async function listBranchPayments(organizationId: string, branchId: string) {
  return prisma.payment.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    include: paymentListInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listOrgPayments(organizationId: string) {
  return prisma.payment.findMany({
    where: { branch: { restaurant: { organizationId } } },
    include: paymentListInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/** Active tables of a branch (for order/payment create selectors). */
export async function listBranchActiveTables(organizationId: string, branchId: string) {
  return prisma.restaurantTable.findMany({
    where: { branchId, branch: { restaurant: { organizationId } }, isActive: true },
    orderBy: { label: "asc" },
  });
}

/** Active, in-stock products of a branch (for the order line-item builder). */
export async function listBranchOrderableProducts(organizationId: string, branchId: string) {
  return prisma.menuProduct.findMany({
    where: { branchId, branch: { restaurant: { organizationId } }, isActive: true, inStock: true },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Public QR resolution (Phase 2B scaffold). Resolves the owning tenant from a
// table qrCode and gates the public menu through Core access. No demo slug or
// global fallback; null-org or inactive chains return null/closed.
// ---------------------------------------------------------------------------

export type PublicTableResolution = {
  table: { id: string; label: string; status: string };
  branch: { id: string; name: string };
  restaurant: { id: string; name: string };
  organizationId: string;
  allowed: boolean;
};

export async function resolvePublicTableByQr(qrCode: string): Promise<PublicTableResolution | null> {
  const table = await prisma.restaurantTable.findUnique({
    where: { qrCode },
    include: { branch: { include: { restaurant: { include: { organization: true } } } } },
  });

  if (!table || !table.isActive) return null;
  const branch = table.branch;
  if (!branch.isActive) return null;
  const restaurant = branch.restaurant;
  if (!restaurant.isActive || !restaurant.organizationId) return null;
  if (!restaurant.organization || restaurant.organization.isDemo || !restaurant.organization.isActive) return null;

  const access = await evaluateProductAccess({
    organizationId: restaurant.organizationId,
    productKey: "wexpay",
  });

  return {
    table: { id: table.id, label: table.label, status: table.status },
    branch: { id: branch.id, name: branch.name },
    restaurant: { id: restaurant.id, name: restaurant.name },
    organizationId: restaurant.organizationId,
    allowed: access.allowed,
  };
}

/** Public-safe menu (active categories + active in-stock products) for a branch. */
export async function getPublicBranchMenu(organizationId: string, branchId: string) {
  return prisma.menuCategory.findMany({
    where: { branchId, isActive: true, branch: { restaurant: { organizationId } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isActive: true, inStock: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          imageUrl: true,
          isPopular: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Operations center (real-time restaurant operations board). All queries are
// org-chain filtered (organizationId -> restaurant -> branch -> table/order/
// payment). No demo slug, no global fallback.
// ---------------------------------------------------------------------------

export type OperationsOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OperationsOrder = {
  id: string;
  orderNo: string;
  status: string;
  note: string | null;
  subtotal: number;
  createdAt: string;
  items: OperationsOrderItem[];
};

export type OperationsPayment = {
  id: string;
  amount: number;
  status: string;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
};

export type OperationsTable = {
  id: string;
  label: string;
  seats: number;
  status: string;
  qrCode: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  receiptRequested: boolean;
  orderCount: number;
  /** NEW/PREPARING — kitchen-open waves */
  activeOrders: OperationsOrder[];
  /** NEW/PREPARING/SERVED session bill waves (CANCELLED excluded) */
  billOrders: OperationsOrder[];
  payments: OperationsPayment[];
  orderHistory: OperationsOrder[];
};

type TableOrderRecord = {
  id: string;
  orderNo: string;
  status: string;
  note: string | null;
  subtotal: number | { toString(): string };
  createdAt: Date;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number | { toString(): string };
    totalPrice: number | { toString(): string };
  }>;
};

function mapTableOrders(orders: TableOrderRecord[]): OperationsOrder[] {
  return orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    note: order.note,
    subtotal: Number(order.subtotal),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.totalPrice),
    })),
  }));
}

export type OperationsNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type OperationsTopProduct = {
  productId: string;
  name: string;
  quantity: number;
  total: number;
};

export type OperationsOverview = {
  tables: OperationsTable[];
  notifications: OperationsNotification[];
  topProducts: OperationsTopProduct[];
  metrics: {
    dailyPaidTotal: number;
    dailyPaymentCount: number;
    activeTableCount: number;
    openOrderCount: number;
    kitchenServedCount: number;
    receiptRequestCount: number;
    averageTicket: number;
    unreadNotificationCount: number;
  };
};

const OPEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.NEW, OrderStatus.PREPARING];
const OPERATIONAL_TABLE_STATUSES = ["OCCUPIED", "PAYMENT_PENDING", "PARTIALLY_PAID", "RECEIPT_REQUESTED"];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function listBranchTableOperations(
  organizationId: string,
  branchId: string,
): Promise<OperationsTable[]> {
  const tables = await prisma.restaurantTable.findMany({
    where: { branchId, isActive: true, branch: { restaurant: { organizationId } } },
    include: {
      orders: {
        include: { items: { orderBy: { id: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      payments: { orderBy: { createdAt: "desc" } },
      receiptRequests: { where: { status: "REQUESTED" } },
    },
    orderBy: { label: "asc" },
  });

  return tables.map((table) => {
    const orderHistory = mapTableOrders(table.orders);
    const isOperationallyEmpty = table.status === TableStatus.EMPTY || table.status === TableStatus.CLOSED;
    if (isOperationallyEmpty) {
      return {
        id: table.id,
        label: table.label,
        seats: table.seats,
        status: TableStatus.EMPTY,
        qrCode: table.qrCode,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        receiptRequested: false,
        orderCount: 0,
        activeOrders: [],
        billOrders: [],
        payments: [],
        orderHistory,
      };
    }

    const session = resolveOperationalTableSession({
      lastClosedAt: table.lastClosedAt,
      orders: table.orders,
      payments: table.payments,
      receiptRequests: table.receiptRequests,
    });
    const operationalOrders = filterOperationalOrders(session.orders);
    const billOrders = filterChargeableOrders(session.orders).slice().sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const account = session.account;

    return {
      id: table.id,
      label: table.label,
      seats: table.seats,
      status: account.status,
      qrCode: table.qrCode,
      totalAmount: account.totalAmount,
      paidAmount: account.paidAmount,
      remainingAmount: account.remainingAmount,
      receiptRequested: account.receiptRequested,
      orderCount: billOrders.length,
      activeOrders: mapTableOrders(operationalOrders),
      billOrders: mapTableOrders(billOrders),
      orderHistory,
      payments: session.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        status: payment.status,
        provider: payment.provider,
        providerRef: payment.providerRef,
        createdAt: payment.createdAt.toISOString(),
      })),
    };
  });
}

export async function listBranchNotifications(
  organizationId: string,
  branchId: string,
  take = 8,
): Promise<OperationsNotification[]> {
  const notifications = await prisma.businessNotification.findMany({
    where: { branchId, branch: { restaurant: { organizationId } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  }));
}

export async function getTopSellingProducts(
  organizationId: string,
  branchId: string,
  limit = 5,
): Promise<OperationsTopProduct[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        branchId,
        status: { not: "CANCELLED" },
        branch: { restaurant: { organizationId } },
      },
    },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const products = await prisma.menuProduct.findMany({
    where: { id: { in: grouped.map((row) => row.productId) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(products.map((product) => [product.id, product.name]));

  return grouped.map((row) => ({
    productId: row.productId,
    name: nameMap.get(row.productId) ?? "Silinmiş ürün",
    quantity: row._sum.quantity ?? 0,
    total: Number(row._sum.totalPrice ?? 0),
  }));
}

export async function getDailyPaymentSummary(organizationId: string, branchId: string) {
  const result = await prisma.payment.aggregate({
    where: {
      branchId,
      status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
      createdAt: { gte: startOfToday() },
      branch: { restaurant: { organizationId } },
    },
    _sum: { amount: true },
    _count: true,
  });

  return {
    dailyPaidTotal: Number(result._sum.amount ?? 0),
    dailyPaymentCount: result._count,
  };
}

export async function getTableOperationsDetail(organizationId: string, tableId: string) {
  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, branch: { restaurant: { organizationId } } },
    include: {
      orders: { where: { status: { not: "CANCELLED" } }, include: { items: { orderBy: { id: "asc" } } }, orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      receiptRequests: { where: { status: "REQUESTED" } },
    },
  });
  return table;
}

export async function getWexPayOperationsOverview(
  organizationId: string,
  branchId: string,
): Promise<OperationsOverview> {
  const [tables, notifications, topProducts, dailySummary, openOrderCount, kitchenServedCount, todayOrders, unreadNotificationCount] = await Promise.all([
    listBranchTableOperations(organizationId, branchId),
    listBranchNotifications(organizationId, branchId, 8),
    getTopSellingProducts(organizationId, branchId, 3),
    getDailyPaymentSummary(organizationId, branchId),
    prisma.customerOrder.count({
      where: { branchId, status: { in: OPEN_ORDER_STATUSES }, branch: { restaurant: { organizationId } } },
    }),
    prisma.customerOrder.count({
      where: { branchId, status: OrderStatus.SERVED, branch: { restaurant: { organizationId } } },
    }),
    prisma.customerOrder.aggregate({
      where: {
        branchId,
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfToday() },
        branch: { restaurant: { organizationId } },
      },
      _avg: { subtotal: true },
    }),
    prisma.businessNotification.count({
      where: { branchId, isRead: false, branch: { restaurant: { organizationId } } },
    }),
  ]);

  const activeTableCount = tables.filter((table) => OPERATIONAL_TABLE_STATUSES.includes(table.status)).length;
  const receiptRequestCount = tables.filter((table) => table.receiptRequested).length;

  return {
    tables,
    notifications,
    topProducts,
    metrics: {
      dailyPaidTotal: dailySummary.dailyPaidTotal,
      dailyPaymentCount: dailySummary.dailyPaymentCount,
      activeTableCount,
      openOrderCount,
      kitchenServedCount,
      receiptRequestCount,
      averageTicket: Number(todayOrders._avg.subtotal ?? 0),
      unreadNotificationCount,
    },
  };
}

export type OperationsSnapshot = {
  generatedAt: string;
  metrics: OperationsOverview["metrics"] & { pendingPaytrCount: number };
  tableStatus: {
    empty: number;
    occupied: number;
    paymentPending: number;
    partiallyPaid: number;
    paid: number;
  };
  openTablesCount: number;
};

export async function getOperationsSnapshot(organizationId: string, branchId: string): Promise<OperationsSnapshot> {
  const [overview, pendingPaytrCount] = await Promise.all([
    getWexPayOperationsOverview(organizationId, branchId),
    prisma.payment.count({
      where: {
        branchId,
        provider: "paytr",
        status: PaymentStatus.PENDING,
        branch: { restaurant: { organizationId } },
      },
    }),
  ]);

  const tables = overview.tables;
  return {
    generatedAt: new Date().toISOString(),
    metrics: { ...overview.metrics, pendingPaytrCount },
    tableStatus: {
      empty: tables.filter((table) => table.status === "EMPTY").length,
      occupied: tables.filter((table) => table.status === "OCCUPIED").length,
      paymentPending: tables.filter((table) => table.status === "PAYMENT_PENDING").length,
      partiallyPaid: tables.filter((table) => table.status === "PARTIALLY_PAID").length,
      paid: tables.filter((table) => table.status === "PAID").length,
    },
    openTablesCount: tables.filter((table) => table.remainingAmount > 0).length,
  };
}

function getIstanbulDayBounds(): { start: Date; end: Date } {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return {
    start: new Date(`${dayKey}T00:00:00+03:00`),
    end: new Date(`${dayKey}T23:59:59.999+03:00`),
  };
}

export async function getBranchDailyReport(organizationId: string, branchId: string) {
  const { start, end } = getIstanbulDayBounds();
  const result = await prisma.payment.aggregate({
    where: {
      branchId,
      status: PaymentStatus.PAID,
      paidAt: { gte: start, lte: end },
      branch: { restaurant: { organizationId } },
    },
    _sum: { amount: true },
    _count: true,
  });
  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
    paidTotal: Number(result._sum.amount ?? 0),
    paidCount: result._count,
  };
}

export type ProviderPaymentBreakdownRow = {
  provider: string;
  total: number;
  count: number;
};

export async function getPaymentBreakdownByProvider(
  organizationId: string,
  branchId: string,
): Promise<ProviderPaymentBreakdownRow[]> {
  const { start } = getIstanbulDayBounds();
  const groups = await prisma.payment.groupBy({
    by: ["provider"],
    where: {
      branchId,
      status: PaymentStatus.PAID,
      paidAt: { gte: start },
      branch: { restaurant: { organizationId } },
    },
    _sum: { amount: true },
    _count: true,
  });
  return groups.map((group) => ({
    provider: group.provider ?? "unknown",
    total: Number(group._sum.amount ?? 0),
    count: group._count,
  }));
}

export async function getOpenTablesSummary(organizationId: string, branchId: string) {
  const tables = await listBranchTableOperations(organizationId, branchId);
  return tables
    .filter((table) => table.remainingAmount > 0)
    .map((table) => ({
      id: table.id,
      label: table.label,
      status: table.status,
      remainingAmount: table.remainingAmount,
      totalAmount: table.totalAmount,
      paidAmount: table.paidAmount,
    }));
}

export type EntitlementUsageRow = {
  key: string;
  label: string;
  used: number;
  limit: number;
  unlimited: boolean;
};

/**
 * Entitlement usage vs. plan limit for the settings readout. A limit of 0 or
 * less is treated as unlimited (consistent with `assertEntitlementLimit`).
 */
export async function getEntitlementUsage(
  organizationId: string,
  entitlementMap: CoreEntitlementMap,
): Promise<EntitlementUsageRow[]> {
  const [branchCount, tableCount, productCount, staffCount] = await Promise.all([
    prisma.branch.count({ where: { restaurant: { organizationId } } }),
    prisma.restaurantTable.count({ where: { branch: { restaurant: { organizationId } } } }),
    prisma.menuProduct.count({ where: { branch: { restaurant: { organizationId } } } }),
    prisma.membership.count({ where: { organizationId, status: "ACTIVE" } }),
  ]);

  const rows: Array<{ key: string; label: string; used: number }> = [
    { key: "branch_limit", label: "Şube", used: branchCount },
    { key: "table_limit", label: "Masa", used: tableCount },
    { key: "product_limit", label: "Ürün", used: productCount },
    { key: "staff_limit", label: "Personel", used: staffCount },
  ];

  return rows.map((row) => {
    const limit = coreEntitlementNumber(entitlementMap, row.key);
    const unlimited = !Number.isFinite(limit) || limit <= 0;
    return { ...row, limit, unlimited };
  });
}
