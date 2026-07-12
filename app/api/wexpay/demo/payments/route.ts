import { NotificationType, PaymentStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse, toPaymentResponse } from "../_utils";

type CreatePaymentBody = {
  tableName?: unknown;
  orderId?: unknown;
  amount?: unknown;
  tipAmount?: unknown;
  itemIds?: unknown;
  receiptRequested?: unknown;
};

function createDemoTransactionId() {
  return `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function formatLira(value: number) {
  return `₺${new Intl.NumberFormat("tr-TR").format(value)}`;
}

export async function GET() {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const payments = await prisma.payment.findMany({
      where: { branchId: demo.branch.id },
      include: {
        table: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ payments: payments.map(toPaymentResponse) });
  } catch {
    return errorResponse("Ödeme işlemi sırasında bir sorun oluştu.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePaymentBody;
    const amount = Number(body.amount);
    const tipAmountRaw = body.tipAmount === undefined || body.tipAmount === null ? 0 : Number(body.tipAmount);
    const tipAmount = Number.isFinite(tipAmountRaw) && tipAmountRaw >= 0 ? tipAmountRaw : 0;
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (Number.isNaN(amount) || amount <= 0) {
      return errorResponse("Geçerli bir ödeme tutarı gönderilmelidir.", 400);
    }

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const tableName = typeof body.tableName === "string" && body.tableName.trim() ? body.tableName.trim() : "Masa 12";
    const table = await prisma.restaurantTable.findFirst({
      where: {
        branchId: demo.branch.id,
        label: tableName,
        isActive: true,
      },
    });

    if (!table) return errorResponse("Masa bulunamadı.", 404);

    const openOrders = await prisma.customerOrder.findMany({
      where: {
        tableId: table.id,
        status: { not: "CANCELLED" },
      },
    });
    const existingPayments = await prisma.payment.findMany({
      where: {
        tableId: table.id,
        status: PaymentStatus.PAID,
      },
    });

    const orderId = typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null;
    const order = orderId
      ? await prisma.customerOrder.findFirst({
          where: {
            id: orderId,
            branchId: demo.branch.id,
          },
        })
      : null;

    if (orderId && !order) return errorResponse("Sipariş bulunamadı.", 404);

    const openItems = await prisma.orderItem.findMany({
      where: {
        order: {
          tableId: table.id,
          status: { not: "CANCELLED" },
        },
      },
    });
    const openItemMap = new Map(openItems.map((item) => [item.id, item]));

    if (itemIds.length > 0) {
      const missing = itemIds.filter((id) => !openItemMap.has(id));
      if (missing.length > 0) {
        return errorResponse("Seçili hesap kalemlerinden bazıları bulunamadı.", 400);
      }

      // Already-paid itemIds from prior payment audits
      const priorAudits = await prisma.auditLog.findMany({
        where: {
          organizationId: demo.organizationId,
          action: "wexpay.demo.payment.created",
          entityId: { in: existingPayments.map((payment) => payment.id) },
        },
        select: { metadataJson: true },
      });
      const alreadyPaidIds = new Set<string>();
      for (const audit of priorAudits) {
        const metadata = audit.metadataJson;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
        const priorIds = (metadata as { itemIds?: unknown }).itemIds;
        if (!Array.isArray(priorIds)) continue;
        for (const id of priorIds) {
          if (typeof id === "string") alreadyPaidIds.add(id);
        }
      }

      if (itemIds.some((id) => alreadyPaidIds.has(id))) {
        return errorResponse("Seçili kalemlerden bazıları zaten ödenmiş.", 400);
      }

      const itemsTotal = itemIds.reduce((sum, id) => {
        const item = openItemMap.get(id);
        return sum + (item ? Number(item.totalPrice) : 0);
      }, 0);
      const expectedGross = itemsTotal + tipAmount;
      if (Math.abs(expectedGross - amount) > 0.05) {
        return errorResponse("Ödeme tutarı seçili kalemler ve bahşiş ile uyuşmuyor.", 400);
      }
    }

    const receiptRequested = typeof body.receiptRequested === "boolean" ? body.receiptRequested : false;
    const openOrderTotal = openOrders.reduce((sum, openOrder) => sum + Number(openOrder.subtotal), 0);
    const alreadyPaid = existingPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const alreadyTip = existingPayments.reduce((sum, payment) => sum + Number(payment.tipAmount ?? 0), 0);
    const remainingBefore = Math.max(openOrderTotal - (alreadyPaid - alreadyTip), 0);
    const netPayment = Math.max(amount - tipAmount, 0);

    // Partial payments keep the table occupied/payment-pending until the bill is cleared.
    const willClearBill = netPayment >= remainingBefore - 0.01;

    const payment = await prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          branchId: demo.branch.id,
          tableId: table.id,
          orderId: order?.id,
          amount,
          tipAmount,
          currency: "TRY",
          status: PaymentStatus.PAID,
          provider: "MOCK",
          providerRef: createDemoTransactionId(),
          receiptRequested,
          paidAt: new Date(),
        },
        include: {
          table: true,
          order: true,
        },
      });

      if (receiptRequested) {
        await tx.receiptRequest.create({
          data: {
            tableId: table.id,
            orderId: order?.id,
            paymentId: createdPayment.id,
            status: "REQUESTED",
            note: "WexPay demo QR ödeme ekranından fiş talep edildi.",
          },
        });

        await tx.businessNotification.create({
          data: {
            branchId: demo.branch.id,
            orderId: order?.id,
            paymentId: createdPayment.id,
            type: NotificationType.RECEIPT_REQUESTED,
            title: "Fiş talebi alındı",
            message: `${table.label} için fiş talebi oluşturuldu.`,
          },
        });
      }

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          orderId: order?.id,
          paymentId: createdPayment.id,
          type: NotificationType.PAYMENT_RECEIVED,
          title: "Ödeme alındı",
          message: `${table.label} için ${formatLira(amount)} ödeme alındı.`,
        },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: willClearBill ? TableStatus.PAID : TableStatus.PAYMENT_PENDING },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.payment.created",
          entityType: "Payment",
          entityId: createdPayment.id,
          metadata: {
            branchId: demo.branch.id,
            tableId: table.id,
            orderId: order?.id ?? null,
            amount,
            tipAmount,
            itemIds,
            receiptRequested,
            billCleared: willClearBill,
          },
        },
        tx,
      );

      return createdPayment;
    });

    return Response.json(toPaymentResponse(payment));
  } catch {
    return errorResponse("Ödeme işlemi sırasında bir sorun oluştu.", 500);
  }
}
