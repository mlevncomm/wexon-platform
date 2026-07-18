import { OrderStatus, PaymentStatus, TableStatus } from ".prisma/client";

type AccountOrder = {
  status: OrderStatus | string;
  subtotal: number | { toString(): string };
  receiptRequested?: boolean | null;
};

type AccountPayment = {
  status: PaymentStatus | string;
  amount: number | { toString(): string };
  receiptRequested?: boolean | null;
};

type AccountReceiptRequest = {
  status: string;
};

export type TableAccountSnapshot = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  hasOpenOrders: boolean;
  hasChargeableOrders: boolean;
  hasPendingPayments: boolean;
  receiptRequested: boolean;
  status: TableStatus;
};

export type TableBillWaveLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: Array<{
    groupName: string;
    optionName: string;
    priceDelta: number;
    sortOrder: number;
  }>;
};

export type TableBillWave = {
  orderId: string;
  orderNo: string;
  status: string;
  createdAt: string;
  note: string | null;
  subtotal: number;
  items: TableBillWaveLine[];
};

const OPEN_ORDER_STATUSES = new Set<string>([OrderStatus.NEW, OrderStatus.PREPARING]);
const CHARGEABLE_ORDER_STATUSES = new Set<string>([OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.SERVED]);
/** Settled money only — shown as "paid" in cashier/guest UI. */
const SETTLED_PAYMENT_STATUSES = new Set<string>([PaymentStatus.PAID, PaymentStatus.PARTIAL]);
/** In-flight PayTR intents reserve available balance (not shown as settled). */
const RESERVED_PAYMENT_STATUSES = new Set<string>([PaymentStatus.PENDING]);

export function isOpenOrderStatus(status: string) {
  return OPEN_ORDER_STATUSES.has(String(status));
}

export function isChargeableOrderStatus(status: string) {
  return CHARGEABLE_ORDER_STATUSES.has(String(status));
}

function money(value: number | { toString(): string }) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function scopeRecordsAfterClose<T extends { createdAt: Date }>(
  records: T[],
  lastClosedAt: Date | null | undefined,
): T[] {
  if (!lastClosedAt) return records;
  return records.filter((record) => record.createdAt > lastClosedAt);
}

function resolveTableSessionStart(
  lastClosedAt: Date | null | undefined,
  orders: Array<{ status: string; createdAt: Date }>,
): Date | null {
  if (lastClosedAt) return lastClosedAt;

  const openOrders = orders.filter((order) => OPEN_ORDER_STATUSES.has(String(order.status)));
  if (openOrders.length > 0) {
    return openOrders.reduce(
      (earliest, order) => (order.createdAt < earliest ? order.createdAt : earliest),
      openOrders[0].createdAt,
    );
  }

  const chargeableOrders = orders.filter((order) => CHARGEABLE_ORDER_STATUSES.has(String(order.status)));
  if (chargeableOrders.length === 0) return null;

  return chargeableOrders.reduce(
    (earliest, order) => (order.createdAt < earliest ? order.createdAt : earliest),
    chargeableOrders[0].createdAt,
  );
}

function filterRecordsFromSessionStart<T extends { createdAt: Date }>(
  records: T[],
  sessionStart: Date,
  lastClosedAt: Date | null | undefined,
): T[] {
  return records.filter((record) =>
    lastClosedAt ? record.createdAt > sessionStart : record.createdAt >= sessionStart,
  );
}

function isSettledOperationalSession(
  orders: Array<{ status: string; subtotal: number | { toString(): string } }>,
  payments: Array<{ status: string; amount: number | { toString(): string }; receiptRequested?: boolean | null }>,
  receiptRequests: Array<{ status: string }> = [],
): boolean {
  const account = calculateTableAccount({ orders, payments, receiptRequests });
  const hasOpenOrders = filterOperationalOrders(orders).length > 0;
  return !hasOpenOrders && account.remainingAmount === 0 && account.totalAmount > 0;
}

export function resolveOperationalTableSession<
  TOrder extends { status: string; createdAt: Date; subtotal: number | { toString(): string } },
  TPayment extends {
    status: string;
    amount: number | { toString(): string };
    createdAt: Date;
    receiptRequested?: boolean | null;
  },
  TReceipt extends { status: string; createdAt: Date },
>(input: {
  lastClosedAt: Date | null | undefined;
  orders: TOrder[];
  payments: TPayment[];
  receiptRequests?: TReceipt[];
}) {
  const receiptRequests = input.receiptRequests ?? [];
  const scopedOrders = scopeRecordsAfterClose(input.orders, input.lastClosedAt);
  const scopedPayments = scopeRecordsAfterClose(input.payments, input.lastClosedAt);
  const scopedReceiptRequests = scopeRecordsAfterClose(receiptRequests, input.lastClosedAt);
  const lifecycleAccount = calculateTableAccount({
    orders: scopedOrders,
    payments: scopedPayments,
    receiptRequests: scopedReceiptRequests,
  });

  if (isSettledOperationalSession(scopedOrders, scopedPayments, scopedReceiptRequests)) {
    return {
      orders: [] as TOrder[],
      payments: [] as TPayment[],
      receiptRequests: [] as TReceipt[],
      account: {
        ...lifecycleAccount,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        hasOpenOrders: false,
      },
    };
  }

  const sessionStart = resolveTableSessionStart(input.lastClosedAt, scopedOrders);
  if (!sessionStart) {
    return {
      orders: [] as TOrder[],
      payments: [] as TPayment[],
      receiptRequests: [] as TReceipt[],
      account: lifecycleAccount,
    };
  }

  const sessionOrders = filterRecordsFromSessionStart(scopedOrders, sessionStart, input.lastClosedAt);
  const sessionPayments = filterRecordsFromSessionStart(scopedPayments, sessionStart, input.lastClosedAt);
  const sessionReceiptRequests = filterRecordsFromSessionStart(
    scopedReceiptRequests,
    sessionStart,
    input.lastClosedAt,
  );

  return {
    orders: sessionOrders,
    payments: sessionPayments,
    receiptRequests: sessionReceiptRequests,
    account: calculateTableAccount({
      orders: sessionOrders,
      payments: sessionPayments,
      receiptRequests: sessionReceiptRequests,
    }),
  };
}

export function filterOperationalOrders<T extends { status: string }>(orders: T[]): T[] {
  return orders.filter((order) => OPEN_ORDER_STATUSES.has(String(order.status)));
}

/** Bill-visible waves: NEW/PREPARING/SERVED. CANCELLED excluded. */
export function filterChargeableOrders<T extends { status: string }>(orders: T[]): T[] {
  return orders.filter((order) => CHARGEABLE_ORDER_STATUSES.has(String(order.status)));
}

export function filterTableSessionRecords<T extends { createdAt: Date }>(
  records: T[],
  lastClosedAt: Date | null | undefined,
  orders: Array<{ status: string; createdAt: Date }> = [],
): T[] {
  const scopedOrders = scopeRecordsAfterClose(orders, lastClosedAt);
  const sessionStart = resolveTableSessionStart(lastClosedAt, scopedOrders);
  if (!sessionStart) return [];

  const scopedRecords = scopeRecordsAfterClose(records, lastClosedAt);
  return filterRecordsFromSessionStart(scopedRecords, sessionStart, lastClosedAt);
}

/**
 * Honest table-close gate from account snapshot.
 * Payment-request notifications never affect remainingAmount / hasOpenOrders.
 * PENDING PayTR intents block close even when remaining is fully reserved.
 */
export function canCloseTableFromAccount(
  account: Pick<TableAccountSnapshot, "hasOpenOrders" | "remainingAmount" | "hasPendingPayments">,
) {
  return !account.hasOpenOrders && account.remainingAmount <= 0 && !account.hasPendingPayments;
}

export function closeTableBlockReason(
  account: Pick<TableAccountSnapshot, "hasOpenOrders" | "remainingAmount" | "hasPendingPayments">,
): string | null {
  if (account.hasOpenOrders) {
    return "Aktif NEW/PREPARING sipariş varken masa kapatılamaz. Önce siparişleri servis edin veya iptal edin.";
  }
  if (account.hasPendingPayments) {
    return "Bekleyen online ödeme varken masa kapatılamaz. Ödeme tamamlanana veya iptal edilene kadar bekleyin.";
  }
  if (account.remainingAmount > 0) {
    return "Kalan ödeme varken masa kapatılamaz. Önce adisyonu kapatın. Ödeme talebi tahsilat değildir.";
  }
  return null;
}

/** Server-side wave totals from persisted line totals (modifier-aware). */
export function sumOrderItemsSubtotal(
  items: Array<{
    quantity: number;
    unitPrice: number | { toString(): string };
    lineTotal?: number | { toString(): string };
    totalPrice?: number | { toString(): string };
  }>,
) {
  return roundMoney(
    items.reduce((sum, item) => {
      if (item.lineTotal !== undefined) return sum + money(item.lineTotal);
      if (item.totalPrice !== undefined) return sum + money(item.totalPrice);
      return sum + money(item.unitPrice) * Math.max(0, item.quantity);
    }, 0),
  );
}

export function buildTableBillWaves<
  T extends {
    id: string;
    orderNo: string;
    status: string;
    note?: string | null;
    createdAt: Date | string;
    subtotal: number | { toString(): string };
    items: Array<{
      id: string;
      productName?: string;
      name?: string;
      quantity: number;
      unitPrice: number | { toString(): string };
      totalPrice?: number | { toString(): string };
      modifiers?: Array<{
        groupName: string;
        optionName: string;
        priceDelta: number | { toString(): string };
        sortOrder: number;
      }>;
    }>;
  },
>(orders: T[]): TableBillWave[] {
  return filterChargeableOrders(orders)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    })
    .map((order) => {
      const items = order.items.map((item) => {
        const unitPrice = money(item.unitPrice);
        const lineTotal =
          item.totalPrice !== undefined ? money(item.totalPrice) : roundMoney(unitPrice * item.quantity);
        return {
          id: item.id,
          name: item.productName ?? item.name ?? "Ürün",
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          modifiers: (item.modifiers ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((modifier) => ({
              groupName: modifier.groupName,
              optionName: modifier.optionName,
              priceDelta: money(modifier.priceDelta),
              sortOrder: modifier.sortOrder,
            })),
        };
      });
      const itemSubtotal = sumOrderItemsSubtotal(items);
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        status: String(order.status),
        createdAt: typeof order.createdAt === "string" ? order.createdAt : order.createdAt.toISOString(),
        note: order.note ?? null,
        subtotal: itemSubtotal > 0 ? itemSubtotal : roundMoney(money(order.subtotal)),
        items,
      };
    });
}

export function calculateTableAccount(input: {
  orders: AccountOrder[];
  payments: AccountPayment[];
  receiptRequests?: AccountReceiptRequest[];
}): TableAccountSnapshot {
  const chargeableOrders = input.orders.filter((order) => CHARGEABLE_ORDER_STATUSES.has(String(order.status)));
  const totalAmount = roundMoney(chargeableOrders.reduce((sum, order) => sum + money(order.subtotal), 0));
  const paidAmount = roundMoney(
    input.payments
      .filter((payment) => SETTLED_PAYMENT_STATUSES.has(String(payment.status)))
      .reduce((sum, payment) => sum + money(payment.amount), 0),
  );
  const reservedAmount = roundMoney(
    input.payments
      .filter((payment) => RESERVED_PAYMENT_STATUSES.has(String(payment.status)))
      .reduce((sum, payment) => sum + money(payment.amount), 0),
  );
  /** Available for new cash/online settle — PENDING intents reserve balance. */
  const remainingAmount = Math.max(0, roundMoney(totalAmount - paidAmount - reservedAmount));
  const hasOpenOrders = input.orders.some((order) => OPEN_ORDER_STATUSES.has(String(order.status)));
  const hasChargeableOrders = chargeableOrders.length > 0;
  const hasPendingPayments = reservedAmount > 0;
  const receiptRequested =
    (input.receiptRequests?.some((request) => request.status === "REQUESTED") ?? false) ||
    input.payments.some((payment) => Boolean(payment.receiptRequested)) ||
    input.orders.some((order) => Boolean(order.receiptRequested));

  let status: TableStatus = TableStatus.EMPTY;
  if (receiptRequested) {
    status = TableStatus.RECEIPT_REQUESTED;
  } else if (hasPendingPayments) {
    status = TableStatus.PAYMENT_PENDING;
  } else if (totalAmount > 0 && paidAmount > 0 && remainingAmount > 0) {
    status = TableStatus.PARTIALLY_PAID;
  } else if (totalAmount > 0 && remainingAmount <= 0) {
    status = TableStatus.PAID;
  } else if (hasOpenOrders || hasChargeableOrders) {
    status = TableStatus.OCCUPIED;
  }

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    hasOpenOrders,
    hasChargeableOrders,
    hasPendingPayments,
    receiptRequested,
    status,
  };
}
