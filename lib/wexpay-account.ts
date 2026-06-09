import { OrderStatus, PaymentStatus, TableStatus } from ".prisma/client";

type AccountOrder = {
  status: OrderStatus | string;
  subtotal: number | { toString(): string };
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

const OPEN_ORDER_STATUSES = new Set<string>([OrderStatus.NEW, OrderStatus.PREPARING]);
const CHARGEABLE_ORDER_STATUSES = new Set<string>([OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.SERVED]);
const PAID_LIKE_PAYMENT_STATUSES = new Set<string>([PaymentStatus.PAID, PaymentStatus.PARTIAL]);

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

export function calculateTableAccount(input: {
  orders: AccountOrder[];
  payments: AccountPayment[];
  receiptRequests?: AccountReceiptRequest[];
}): TableAccountSnapshot {
  const chargeableOrders = input.orders.filter((order) => CHARGEABLE_ORDER_STATUSES.has(String(order.status)));
  const totalAmount = roundMoney(chargeableOrders.reduce((sum, order) => sum + money(order.subtotal), 0));
  const paidAmount = roundMoney(
    input.payments
      .filter((payment) => PAID_LIKE_PAYMENT_STATUSES.has(String(payment.status)))
      .reduce((sum, payment) => sum + money(payment.amount), 0),
  );
  const remainingAmount = Math.max(0, roundMoney(totalAmount - paidAmount));
  const hasOpenOrders = input.orders.some((order) => OPEN_ORDER_STATUSES.has(String(order.status)));
  const hasChargeableOrders = chargeableOrders.length > 0;
  const hasPendingPayments = input.payments.some((payment) => payment.status === PaymentStatus.PENDING);
  const receiptRequested =
    (input.receiptRequests?.some((request) => request.status === "REQUESTED") ?? false) ||
    input.payments.some((payment) => Boolean(payment.receiptRequested));

  let status: TableStatus = TableStatus.EMPTY;
  if (receiptRequested) {
    status = TableStatus.RECEIPT_REQUESTED;
  } else if (hasPendingPayments && remainingAmount > 0) {
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
