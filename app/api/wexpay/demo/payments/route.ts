import { NotificationType, PaymentStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse, toPaymentResponse } from "../_utils";

type CreatePaymentBody = {
  tableName?: unknown;
  orderId?: unknown;
  amount?: unknown;
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

    const receiptRequested = typeof body.receiptRequested === "boolean" ? body.receiptRequested : false;

    const payment = await prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          branchId: demo.branch.id,
          tableId: table.id,
          orderId: order?.id,
          amount,
          tipAmount: 0,
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
        data: { status: TableStatus.PAID },
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
            receiptRequested,
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
