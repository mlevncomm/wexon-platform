/**
 * Table assist request domain (payment request / waiter call).
 * PLAN v2.1 — structured lifecycle separate from BusinessNotification inbox.
 */

import {
  NotificationType,
  PaymentStatus,
  TableAssistKind,
  TableAssistStatus,
  TableStatus,
  type Payment,
  type PaymentMethodPreference,
  type Prisma,
} from ".prisma/client";
import { calculateTableAccount, filterTableSessionRecords } from "@/lib/wexpay-account";
import { lockWexPayTableAccount } from "@/lib/wexpay-locks";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { WexPayAccessError } from "@/lib/wexpay-tenant";
import { WexPayValidationError } from "@/lib/wexpay-validation";

const ASSIST_TTL_MS = 10 * 60 * 1000;
const RECENT_ORDER_WINDOW_MS = 6 * 60 * 60 * 1000;

const ACTIVE_TABLE_STATUSES = new Set<TableStatus>([
  TableStatus.EMPTY,
  TableStatus.OCCUPIED,
  TableStatus.PAYMENT_PENDING,
  TableStatus.PARTIALLY_PAID,
  TableStatus.RECEIPT_REQUESTED,
  TableStatus.PAID,
]);

type Tx = Prisma.TransactionClient;

export type TableAssistPaymentMethod = "CASH" | "PHYSICAL_POS";

export type CreateTableAssistResult = {
  id: string;
  title: string;
  requestId: string;
  alreadyOpen: boolean;
  existing?: {
    paymentMethod: TableAssistPaymentMethod | null;
    requestedAmount: number | null;
  };
};

export type AcknowledgeAssistResult =
  | { acknowledged: true }
  | { acknowledged: false; conflict: { acknowledgedByDisplayName: string } };

export type ActiveTableAssistView = {
  id: string;
  kind: "PAYMENT_REQUEST" | "WAITER_CALL";
  status: "OPEN" | "ACKNOWLEDGED";
  paymentMethod: TableAssistPaymentMethod | null;
  createdAt: string;
};

export type AssistRequestByIdView = {
  id: string;
  kind: "PAYMENT_REQUEST" | "WAITER_CALL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  paymentMethod: TableAssistPaymentMethod | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};

export type AssistMutationContext = {
  organizationId: string;
  canManage: boolean;
  actorUserId: string | null;
  ipAddress?: string | null;
};

function plusTtl(from: Date = new Date()) {
  return new Date(from.getTime() + ASSIST_TTL_MS);
}

function preferenceToView(
  value: PaymentMethodPreference | null | undefined,
): TableAssistPaymentMethod | null {
  if (value === "CASH" || value === "PHYSICAL_POS") return value;
  return null;
}

function displayNameForUser(user: { name: string | null; email: string } | null | undefined) {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email;
  return "Başka personel";
}

async function calculateTableRemainingInTx(tx: Tx, tableId: string): Promise<number> {
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
  const sessionReceiptRequests = filterTableSessionRecords(
    table.receiptRequests,
    table.lastClosedAt,
    table.orders,
  );
  return calculateTableAccount({
    orders: sessionOrders,
    payments: sessionPayments,
    receiptRequests: sessionReceiptRequests,
  }).remainingAmount;
}

async function expireOpenAssistRequestsInTx(tx: Tx, tableId: string, now: Date) {
  const expired = await tx.tableAssistRequest.findMany({
    where: {
      tableId,
      status: { in: [TableAssistStatus.OPEN, TableAssistStatus.ACKNOWLEDGED] },
      expiresAt: { lt: now },
    },
    select: { id: true, kind: true, organizationId: true },
  });

  if (expired.length === 0) return;

  await tx.tableAssistRequest.updateMany({
    where: { id: { in: expired.map((row) => row.id) } },
    data: {
      status: TableAssistStatus.CANCELLED,
      cancelledAt: now,
    },
  });

  for (const row of expired) {
    const prefix =
      row.kind === TableAssistKind.PAYMENT_REQUEST
        ? "wexpay.assist.payment_request"
        : "wexpay.assist.waiter_call";
    await writeAuditLog(
      {
        action: `${prefix}.expired`,
        organizationId: row.organizationId,
        entityType: "TableAssistRequest",
        entityId: row.id,
        source: "wexpay_app",
        metadata: { tableId, reason: "expiresAt" },
      },
      tx,
    );
  }
}

/**
 * Abuse gates for public payment-request (PLAN §8.1).
 * Throws WexPayValidationError with messages suitable for 409 mapping.
 */
export async function assertPublicPaymentRequestPreconditions(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
}): Promise<{ remainingAmount: number }> {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branchId: input.branchId,
      isActive: true,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
    select: { id: true, status: true, lastClosedAt: true },
  });
  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  if (table.status === TableStatus.CLOSED || !ACTIVE_TABLE_STATUSES.has(table.status)) {
    throw new WexPayValidationError("Bu masa şu anda ödeme talebi için uygun değil.");
  }

  const remainingAmount = await calculateTableRemainingInTx(prisma, table.id);
  if (remainingAmount <= 0) {
    throw new WexPayValidationError("Bu masa için ödenecek açık bir hesap bulunmuyor.");
  }

  const since = new Date(Date.now() - RECENT_ORDER_WINDOW_MS);
  const windowStart =
    table.lastClosedAt && table.lastClosedAt > since ? table.lastClosedAt : since;
  const recentOk = await prisma.customerOrder.findFirst({
    where: {
      tableId: table.id,
      branchId: input.branchId,
      createdAt: { gte: windowStart },
    },
    select: { id: true },
  });
  if (!recentOk) {
    throw new WexPayValidationError("Bu masa için yakın zamanda sipariş bulunmuyor.");
  }

  return { remainingAmount };
}

export async function createStructuredTableAssistRequest(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  kind: "payment_request" | "waiter_call";
  reason?: string | null;
  note?: string | null;
  mode?: string | null;
  paymentMethod?: TableAssistPaymentMethod | null;
  ipAddress: string | null;
}): Promise<CreateTableAssistResult> {
  const isPayment = input.kind === "payment_request";
  if (isPayment && input.paymentMethod !== "CASH" && input.paymentMethod !== "PHYSICAL_POS") {
    throw new WexPayValidationError("Ödeme yöntemi CASH veya PHYSICAL_POS olmalıdır.");
  }

  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branchId: input.branchId,
      isActive: true,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
  });
  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  return prisma.$transaction(async (tx) => {
    await lockWexPayTableAccount(tx, table.id);
    const now = new Date();
    await expireOpenAssistRequestsInTx(tx, table.id, now);

    if (isPayment) {
      const existing = await tx.tableAssistRequest.findFirst({
        where: {
          tableId: table.id,
          kind: TableAssistKind.PAYMENT_REQUEST,
          status: { in: [TableAssistStatus.OPEN, TableAssistStatus.ACKNOWLEDGED] },
        },
        select: {
          id: true,
          paymentMethod: true,
          requestedAmount: true,
        },
      });
      if (existing) {
        const title = `[ÖDEME TALEBİ] ${table.label}`;
        return {
          id: existing.id,
          title,
          requestId: existing.id,
          alreadyOpen: true,
          existing: {
            paymentMethod: preferenceToView(existing.paymentMethod),
            requestedAmount:
              existing.requestedAmount == null ? null : Number(existing.requestedAmount),
          },
        };
      }
    }

    const remainingAmount = isPayment ? await calculateTableRemainingInTx(tx, table.id) : null;
    const title = isPayment
      ? `[ÖDEME TALEBİ] ${table.label}`
      : `[GARSON ÇAĞRISI] ${table.label}`;
    const reasonPart = input.reason?.trim() ? ` Sebep: ${input.reason.trim()}.` : "";
    const notePart = input.note?.trim() ? ` Not: ${input.note.trim()}` : "";
    const methodPart =
      isPayment && input.paymentMethod
        ? ` Yöntem: ${input.paymentMethod === "CASH" ? "Nakit" : "Fiziksel POS"}.`
        : "";
    const message = isPayment
      ? `${table.label} için müşteri ödeme talebi gönderdi.${methodPart}${reasonPart}${notePart}`
      : `${table.label} için garson çağrısı alındı.${reasonPart}${notePart}`;

    const notification = await tx.businessNotification.create({
      data: {
        branchId: input.branchId,
        type: NotificationType.TABLE_UPDATED,
        title,
        message,
      },
    });

    const mode = (input.mode?.trim() || input.reason?.trim() || (isPayment ? "full_bill" : null)) ?? null;

    const request = await tx.tableAssistRequest.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        tableId: table.id,
        kind: isPayment ? TableAssistKind.PAYMENT_REQUEST : TableAssistKind.WAITER_CALL,
        paymentMethod: isPayment ? input.paymentMethod! : null,
        mode,
        reason: input.reason?.trim() || null,
        note: input.note?.trim() || null,
        status: TableAssistStatus.OPEN,
        requestedAmount: remainingAmount,
        businessNotificationId: notification.id,
        expiresAt: plusTtl(now),
      },
    });

    const auditPrefix = isPayment ? "wexpay.assist.payment_request" : "wexpay.assist.waiter_call";
    await writeAuditLog(
      {
        action: `${auditPrefix}.created`,
        organizationId: input.organizationId,
        userId: null,
        entityType: "TableAssistRequest",
        entityId: request.id,
        ipAddress: input.ipAddress,
        source: "wexpay_public",
        metadata: {
          source: "public_qr",
          kind: input.kind,
          branchId: input.branchId,
          tableId: table.id,
          paymentMethod: input.paymentMethod ?? null,
          mode,
          businessNotificationId: notification.id,
          requestedAmount: remainingAmount,
        },
      },
      tx,
    );

    // Legacy public audit (kept for existing dashboards during rollout)
    await writeAuditLog(
      {
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
          requestId: request.id,
        },
      },
      tx,
    );

    return {
      id: notification.id,
      title,
      requestId: request.id,
      alreadyOpen: false,
    };
  });
}

export async function acknowledgeTableAssistRequest(
  context: AssistMutationContext,
  input: { requestId: string },
): Promise<AcknowledgeAssistResult> {
  const existing = await prisma.tableAssistRequest.findFirst({
    where: { id: input.requestId, organizationId: context.organizationId },
    include: {
      acknowledgedBy: { select: { name: true, email: true } },
    },
  });
  if (!existing) throw new WexPayValidationError("Yardım talebi bulunamadı.");

  if (!context.actorUserId && !context.canManage) {
    throw new WexPayAccessError("Talebi üstlenmek için oturum gerekli.", "role");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await lockWexPayTableAccount(tx, existing.tableId);
    await expireOpenAssistRequestsInTx(tx, existing.tableId, now);

    const count = await tx.tableAssistRequest.updateMany({
      where: {
        id: existing.id,
        organizationId: context.organizationId,
        status: TableAssistStatus.OPEN,
      },
      data: {
        status: TableAssistStatus.ACKNOWLEDGED,
        acknowledgedByUserId: context.actorUserId,
        acknowledgedAt: now,
        expiresAt: plusTtl(now),
      },
    });

    if (count.count === 0) {
      const current = await tx.tableAssistRequest.findFirst({
        where: { id: existing.id, organizationId: context.organizationId },
        include: { acknowledgedBy: { select: { name: true, email: true } } },
      });
      return {
        ok: false as const,
        displayName: displayNameForUser(current?.acknowledgedBy),
      };
    }

    await writeAuditLog(
      {
        action: "wexpay.assist.payment_request.acknowledged",
        organizationId: context.organizationId,
        userId: context.actorUserId,
        entityType: "TableAssistRequest",
        entityId: existing.id,
        ipAddress: context.ipAddress ?? null,
        source: "wexpay_app",
        metadata: {
          tableId: existing.tableId,
          branchId: existing.branchId,
          kind: existing.kind,
        },
      },
      tx,
    );

    return { ok: true as const };
  });

  if (!updated.ok) {
    return {
      acknowledged: false,
      conflict: { acknowledgedByDisplayName: updated.displayName },
    };
  }
  return { acknowledged: true };
}

export async function releaseTableAssistRequest(
  context: AssistMutationContext,
  input: { requestId: string },
): Promise<{ released: boolean }> {
  const existing = await prisma.tableAssistRequest.findFirst({
    where: { id: input.requestId, organizationId: context.organizationId },
  });
  if (!existing) throw new WexPayValidationError("Yardım talebi bulunamadı.");
  if (existing.status !== TableAssistStatus.ACKNOWLEDGED) {
    throw new WexPayValidationError("Yalnızca üstlenilmiş talepler bırakılabilir.");
  }

  const isOwner = Boolean(
    context.actorUserId && existing.acknowledgedByUserId === context.actorUserId,
  );
  if (!isOwner && !context.canManage) {
    throw new WexPayAccessError("Bu talebi yalnız üstlenen personel veya yönetici bırakabilir.", "role");
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await lockWexPayTableAccount(tx, existing.tableId);

    const where: Prisma.TableAssistRequestWhereInput = {
      id: existing.id,
      organizationId: context.organizationId,
      status: TableAssistStatus.ACKNOWLEDGED,
    };
    if (!context.canManage) {
      where.acknowledgedByUserId = context.actorUserId;
    }

    const count = await tx.tableAssistRequest.updateMany({
      where,
      data: {
        status: TableAssistStatus.OPEN,
        acknowledgedByUserId: null,
        acknowledgedAt: null,
        releasedAt: now,
        expiresAt: plusTtl(now),
      },
    });

    if (count.count === 0) return false;

    await writeAuditLog(
      {
        action: "wexpay.assist.payment_request.released",
        organizationId: context.organizationId,
        userId: context.actorUserId,
        entityType: "TableAssistRequest",
        entityId: existing.id,
        ipAddress: context.ipAddress ?? null,
        source: "wexpay_app",
        metadata: {
          tableId: existing.tableId,
          branchId: existing.branchId,
        },
      },
      tx,
    );

    return true;
  });

  return { released: result };
}

export async function maybeResolveTableAssistRequestOnPayment(
  tx: Tx,
  input: {
    tableId: string;
    payment: Pick<Payment, "id" | "status">;
    actorUserId?: string | null;
    organizationId?: string | null;
  },
): Promise<void> {
  if (input.payment.status !== PaymentStatus.PAID) return;

  const remaining = await calculateTableRemainingInTx(tx, input.tableId);
  if (remaining > 0) return;

  const openRequest = await tx.tableAssistRequest.findFirst({
    where: {
      tableId: input.tableId,
      kind: TableAssistKind.PAYMENT_REQUEST,
      status: { in: [TableAssistStatus.OPEN, TableAssistStatus.ACKNOWLEDGED] },
      mode: "full_bill",
    },
  });
  if (!openRequest) return;

  const now = new Date();
  await tx.tableAssistRequest.update({
    where: { id: openRequest.id },
    data: {
      status: TableAssistStatus.RESOLVED,
      resolvedAt: now,
      resolvedPaymentId: input.payment.id,
      resolvedByUserId: input.actorUserId ?? null,
    },
  });

  await writeAuditLog(
    {
      action: "wexpay.assist.payment_request.resolved",
      organizationId: input.organizationId ?? openRequest.organizationId,
      userId: input.actorUserId ?? null,
      entityType: "TableAssistRequest",
      entityId: openRequest.id,
      source: "wexpay_app",
      metadata: {
        tableId: input.tableId,
        paymentId: input.payment.id,
        remainingAmount: remaining,
      },
    },
    tx,
  );
}

export async function getActiveTableAssistRequest(
  tableId: string,
): Promise<ActiveTableAssistView | null> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await expireOpenAssistRequestsInTx(tx, tableId, now);
  });

  const row = await prisma.tableAssistRequest.findFirst({
    where: {
      tableId,
      status: { in: [TableAssistStatus.OPEN, TableAssistStatus.ACKNOWLEDGED] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status as "OPEN" | "ACKNOWLEDGED",
    paymentMethod: preferenceToView(row.paymentMethod),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAssistRequestById(
  requestId: string,
  options?: { tableId?: string },
): Promise<AssistRequestByIdView | null> {
  const row = await prisma.tableAssistRequest.findFirst({
    where: {
      id: requestId,
      ...(options?.tableId ? { tableId: options.tableId } : {}),
    },
  });
  if (!row) return null;

  if (
    (row.status === TableAssistStatus.OPEN || row.status === TableAssistStatus.ACKNOWLEDGED) &&
    row.expiresAt < new Date()
  ) {
    await prisma.$transaction(async (tx) => {
      await expireOpenAssistRequestsInTx(tx, row.tableId, new Date());
    });
    const refreshed = await prisma.tableAssistRequest.findUnique({ where: { id: requestId } });
    if (!refreshed) return null;
    return {
      id: refreshed.id,
      kind: refreshed.kind,
      status: refreshed.status,
      paymentMethod: preferenceToView(refreshed.paymentMethod),
      createdAt: refreshed.createdAt.toISOString(),
      acknowledgedAt: refreshed.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: refreshed.resolvedAt?.toISOString() ?? null,
    };
  }

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    paymentMethod: preferenceToView(row.paymentMethod),
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
