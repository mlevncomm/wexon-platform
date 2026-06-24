import { PaymentStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { calculateTableAccount, filterTableSessionRecords } from "@/lib/wexpay-account";
import { generatePaytrMerchantOid, loadPaytrCredentialBundle } from "@/lib/wexpay-paytr-adapter";
import { resolveWexPayPaymentProvider } from "@/lib/wexpay-payment-provider";
import type { TenantDb } from "@/lib/wexpay-tenant";
import { WexPayValidationError } from "@/lib/wexpay-validation";

export class WexPayPublicCheckoutUnavailableError extends Error {
  constructor(message = "Online ödeme şu anda aktif değil. Ödeme için işletme personeline başvurun.") {
    super(message);
    this.name = "WexPayPublicCheckoutUnavailableError";
  }
}

function buildPublicCheckoutRedirectUrls(qrCode: string, paymentId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl) {
    throw new WexPayValidationError("Uygulama URL yapılandırması eksik.");
  }
  const encoded = encodeURIComponent(qrCode);
  const paymentQuery = `&paymentId=${encodeURIComponent(paymentId)}`;
  return {
    successUrl: `${appUrl}/wexpay/t/${encoded}?paytr=success${paymentQuery}`,
    failUrl: `${appUrl}/wexpay/t/${encoded}?paytr=failed${paymentQuery}`,
  };
}

async function getTableAccountSnapshot(tx: TenantDb, tableId: string) {
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

/** Server-side checkout amount: never trust client totals; cap by remaining table balance. */
export function resolvePublicCheckoutAmount(input: {
  orderSubtotal: number | null;
  remainingAmount: number;
}): number {
  const remaining = Number(input.remainingAmount);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  if (input.orderSubtotal === null) return remaining;
  const orderTotal = Number(input.orderSubtotal);
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return 0;
  return Math.min(orderTotal, remaining);
}

export type PublicCheckoutValidatedContext = {
  tableId: string;
  orderId: string | null;
  amount: number;
  remainingAmount: number;
};

/** Validates tenant table, order ownership, and server-side amount before PSP calls. */
export async function validatePublicCheckoutContext(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  orderId?: string | null;
}): Promise<PublicCheckoutValidatedContext> {
  const table = await prisma.restaurantTable.findFirst({
    where: {
      id: input.tableId,
      branchId: input.branchId,
      isActive: true,
      branch: { restaurant: { organizationId: input.organizationId } },
    },
  });
  if (!table) throw new WexPayValidationError("Masa bulunamadı.");

  const account = await getTableAccountSnapshot(prisma, table.id);
  const orderId: string | null = input.orderId ?? null;
  let amount = account.remainingAmount;

  if (orderId) {
    const order = await prisma.customerOrder.findFirst({
      where: { id: orderId, branchId: input.branchId, tableId: table.id },
    });
    if (!order) throw new WexPayValidationError("Sipariş bulunamadı.");
    amount = resolvePublicCheckoutAmount({
      orderSubtotal: Number(order.subtotal),
      remainingAmount: account.remainingAmount,
    });
  }

  if (account.remainingAmount <= 0) {
    throw new WexPayValidationError("Ödenecek tutar bulunmuyor.");
  }

  if (amount <= 0) {
    throw new WexPayValidationError("Ödenecek tutar bulunmuyor.");
  }

  return {
    tableId: table.id,
    orderId,
    amount,
    remainingAmount: account.remainingAmount,
  };
}

export type PublicCheckoutPaymentStatus = {
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  provider: string;
};

/** Poll-friendly status for public QR return flow (webhook may lag behind PayTR redirect). */
export async function getPublicCheckoutPaymentStatus(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  paymentId: string;
}): Promise<PublicCheckoutPaymentStatus | null> {
  const payment = await prisma.payment.findFirst({
    where: {
      id: input.paymentId,
      tableId: input.tableId,
      branchId: input.branchId,
      provider: "paytr",
      branch: { restaurant: { organizationId: input.organizationId } },
    },
    select: { id: true, status: true, amount: true, provider: true },
  });

  if (!payment) return null;

  return {
    paymentId: payment.id,
    status: payment.status,
    amount: Number(payment.amount),
    provider: payment.provider ?? "paytr",
  };
}

async function markStalePendingPaymentFailed(
  tx: TenantDb,
  input: {
    paymentId: string;
    organizationId: string;
    ipAddress: string | null;
    reason: string;
  },
) {
  await tx.payment.updateMany({
    where: {
      id: input.paymentId,
      status: PaymentStatus.PENDING,
      provider: "paytr",
      branch: { restaurant: { organizationId: input.organizationId } },
    },
    data: { status: PaymentStatus.FAILED },
  });

  await writeAuditLog(
    {
      action: "wexpay.public.checkout.stale_pending_failed",
      organizationId: input.organizationId,
      entityType: "Payment",
      entityId: input.paymentId,
      ipAddress: input.ipAddress,
      source: "wexpay_public",
      metadata: { reason: input.reason },
    },
    tx,
  );
}

function amountsMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

export type PendingCheckoutReuseDecision = "reuse" | "invalidate_stale" | "create_new";

/** Pure decision helper for pending PayTR checkout reuse (unit-tested). */
export function resolvePendingCheckoutReuseDecision(input: {
  hasPending: boolean;
  pendingAmount: number;
  validatedAmount: number;
  remainingAmount: number;
}): PendingCheckoutReuseDecision {
  if (!input.hasPending) return "create_new";
  if (input.remainingAmount <= 0 || input.validatedAmount <= 0) return "invalidate_stale";
  if (!amountsMatch(input.pendingAmount, input.validatedAmount)) return "invalidate_stale";
  return "reuse";
}

async function resolvePaytrCheckoutIntent(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  orderId: string | null;
  amount: number;
  qrCode: string;
  paymentId: string;
  providerRef: string;
  ipAddress: string | null;
}) {
  const { adapter } = await resolveWexPayPaymentProvider("paytr");
  const intent = await adapter.createPaymentIntent({
    organizationId: input.organizationId,
    branchId: input.branchId,
    tableId: input.tableId,
    orderId: input.orderId,
    amount: input.amount,
    currency: "TRY",
    clientIp: input.ipAddress,
    existingProviderRef: input.providerRef,
    checkoutRedirect: buildPublicCheckoutRedirectUrls(input.qrCode, input.paymentId),
  });

  if (!intent.externalCheckoutUrl) {
    throw new WexPayPublicCheckoutUnavailableError();
  }

  return intent;
}

export async function createPublicCheckoutPayment(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  qrCode: string;
  orderId?: string | null;
  ipAddress: string | null;
}) {
  const validated = await validatePublicCheckoutContext({
    organizationId: input.organizationId,
    branchId: input.branchId,
    tableId: input.tableId,
    orderId: input.orderId,
  });

  if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
    throw new WexPayPublicCheckoutUnavailableError();
  }

  const credentials = await loadPaytrCredentialBundle(input.organizationId);
  if (!credentials) {
    throw new WexPayPublicCheckoutUnavailableError();
  }

  const locked = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.tableId}))`;

    const existingPending = await tx.payment.findFirst({
      where: {
        tableId: input.tableId,
        branchId: input.branchId,
        provider: "paytr",
        status: PaymentStatus.PENDING,
        branch: { restaurant: { organizationId: input.organizationId } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPending?.providerRef) {
      const reuseDecision = resolvePendingCheckoutReuseDecision({
        hasPending: true,
        pendingAmount: Number(existingPending.amount),
        validatedAmount: validated.amount,
        remainingAmount: validated.remainingAmount,
      });

      if (reuseDecision === "invalidate_stale") {
        await markStalePendingPaymentFailed(tx, {
          paymentId: existingPending.id,
          organizationId: input.organizationId,
          ipAddress: input.ipAddress,
          reason:
            validated.remainingAmount <= 0 || validated.amount <= 0
              ? "table_fully_paid"
              : "amount_mismatch",
        });
      } else if (reuseDecision === "reuse") {
        return {
          kind: "reuse" as const,
          paymentId: existingPending.id,
          amount: validated.amount,
          providerRef: existingPending.providerRef,
          orderId: existingPending.orderId,
        };
      }
    }

    const table = await tx.restaurantTable.findFirst({
      where: {
        id: input.tableId,
        branchId: input.branchId,
        isActive: true,
        branch: { restaurant: { organizationId: input.organizationId } },
      },
    });
    if (!table) throw new WexPayValidationError("Masa bulunamadı.");

    const account = await getTableAccountSnapshot(tx, table.id);
    if (account.remainingAmount <= 0) {
      throw new WexPayValidationError("Ödenecek tutar bulunmuyor.");
    }

    let amount = account.remainingAmount;
    const orderId = validated.orderId;

    if (orderId) {
      const order = await tx.customerOrder.findFirst({
        where: { id: orderId, branchId: input.branchId, tableId: table.id },
      });
      if (!order) throw new WexPayValidationError("Sipariş bulunamadı.");
      amount = resolvePublicCheckoutAmount({
        orderSubtotal: Number(order.subtotal),
        remainingAmount: account.remainingAmount,
      });
    }

    if (amount <= 0) {
      throw new WexPayValidationError("Ödenecek tutar bulunmuyor.");
    }

    const providerRef = generatePaytrMerchantOid();
    const payment = await tx.payment.create({
      data: {
        branchId: input.branchId,
        tableId: table.id,
        orderId,
        amount,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef,
        paidAt: null,
      },
    });

    await syncTableStatus(tx, table.id);

    await writeAuditLog(
      {
        action: "wexpay.public.checkout.started",
        organizationId: input.organizationId,
        entityType: "Payment",
        entityId: payment.id,
        ipAddress: input.ipAddress,
        source: "wexpay_public",
        metadata: {
          qrCode: input.qrCode,
          branchId: input.branchId,
          tableId: table.id,
          orderId,
          amount,
          providerRef,
        },
      },
      tx,
    );

    return {
      kind: "create" as const,
      paymentId: payment.id,
      amount,
      providerRef,
      orderId,
    };
  });

  const intent = await resolvePaytrCheckoutIntent({
    organizationId: input.organizationId,
    branchId: input.branchId,
    tableId: input.tableId,
    orderId: locked.orderId,
    amount: locked.amount,
    qrCode: input.qrCode,
    paymentId: locked.paymentId,
    providerRef: locked.providerRef,
    ipAddress: input.ipAddress,
  });

  return {
    paymentId: locked.paymentId,
    amount: locked.amount,
    providerRef: locked.providerRef,
    externalCheckoutUrl: intent.externalCheckoutUrl,
    reusedPending: locked.kind === "reuse",
  };
}
