import { PaymentStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/wexon-audit";
import { calculateTableAccount, filterTableSessionRecords } from "@/lib/wexpay-account";
import { loadPaytrCredentialBundle } from "@/lib/wexpay-paytr-adapter";
import { resolveWexPayPaymentProvider } from "@/lib/wexpay-payment-provider";
import type { TenantDb } from "@/lib/wexpay-tenant";
import { WexPayValidationError } from "@/lib/wexpay-validation";

export class WexPayPublicCheckoutUnavailableError extends Error {
  constructor(message = "Online ödeme şu anda aktif değil. Ödeme için işletme personeline başvurun.") {
    super(message);
    this.name = "WexPayPublicCheckoutUnavailableError";
  }
}

function buildPublicCheckoutRedirectUrls(qrCode: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl) {
    throw new WexPayValidationError("Uygulama URL yapılandırması eksik.");
  }
  const encoded = encodeURIComponent(qrCode);
  return {
    successUrl: `${appUrl}/wexpay/t/${encoded}?paytr=success`,
    failUrl: `${appUrl}/wexpay/t/${encoded}?paytr=failed`,
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

export async function createPublicCheckoutPayment(input: {
  organizationId: string;
  branchId: string;
  tableId: string;
  qrCode: string;
  orderId?: string | null;
  ipAddress: string | null;
}) {
  if (process.env.WEXPAY_PAYTR_ENABLE_API !== "true") {
    throw new WexPayPublicCheckoutUnavailableError();
  }

  const credentials = await loadPaytrCredentialBundle(input.organizationId);
  if (!credentials) {
    throw new WexPayPublicCheckoutUnavailableError();
  }

  const existingPending = await prisma.payment.findFirst({
    where: {
      tableId: input.tableId,
      branchId: input.branchId,
      provider: "paytr",
      status: PaymentStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingPending?.providerRef) {
    const { adapter } = await resolveWexPayPaymentProvider("paytr");
    const intent = await adapter.createPaymentIntent({
      organizationId: input.organizationId,
      branchId: input.branchId,
      tableId: input.tableId,
      orderId: existingPending.orderId,
      amount: Number(existingPending.amount),
      currency: "TRY",
      clientIp: input.ipAddress,
      existingProviderRef: existingPending.providerRef,
      checkoutRedirect: buildPublicCheckoutRedirectUrls(input.qrCode),
    });
    if (!intent.externalCheckoutUrl) {
      throw new WexPayPublicCheckoutUnavailableError();
    }
    return {
      paymentId: existingPending.id,
      amount: Number(existingPending.amount),
      providerRef: existingPending.providerRef,
      externalCheckoutUrl: intent.externalCheckoutUrl,
      reusedPending: true as const,
    };
  }

  return prisma.$transaction(async (tx) => {
    const table = await tx.restaurantTable.findFirst({
      where: {
        id: input.tableId,
        branchId: input.branchId,
        isActive: true,
        branch: { restaurant: { organizationId: input.organizationId } },
      },
    });
    if (!table) throw new WexPayValidationError("Masa bulunamadı.");

    let amount = 0;
    const orderId: string | null = input.orderId ?? null;

    if (orderId) {
      const order = await tx.customerOrder.findFirst({
        where: { id: orderId, branchId: input.branchId, tableId: table.id },
      });
      if (!order) throw new WexPayValidationError("Sipariş bulunamadı.");
      amount = Number(order.subtotal);
    } else {
      const account = await getTableAccountSnapshot(tx, table.id);
      amount = account.remainingAmount;
    }

    if (amount <= 0) {
      throw new WexPayValidationError("Ödenecek tutar bulunmuyor.");
    }

    const { adapter } = await resolveWexPayPaymentProvider("paytr");
    const intent = await adapter.createPaymentIntent({
      organizationId: input.organizationId,
      branchId: input.branchId,
      tableId: table.id,
      orderId,
      amount,
      currency: "TRY",
      clientIp: input.ipAddress,
      checkoutRedirect: buildPublicCheckoutRedirectUrls(input.qrCode),
    });

    if (!intent.externalCheckoutUrl || !intent.providerRef) {
      throw new WexPayPublicCheckoutUnavailableError();
    }

    const payment = await tx.payment.create({
      data: {
        branchId: input.branchId,
        tableId: table.id,
        orderId,
        amount,
        currency: "TRY",
        status: PaymentStatus.PENDING,
        provider: "paytr",
        providerRef: intent.providerRef,
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
          providerRef: intent.providerRef,
        },
      },
      tx,
    );

    return {
      paymentId: payment.id,
      amount,
      providerRef: intent.providerRef,
      externalCheckoutUrl: intent.externalCheckoutUrl,
      reusedPending: false as const,
    };
  });
}
