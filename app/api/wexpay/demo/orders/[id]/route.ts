import { NotificationType, OrderStatus, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../../_access";
import { errorResponse, toOrderResponse } from "../../_utils";

type Params = {
  params: Promise<{ id: string }>;
};

type UpdateOrderBody = {
  status?: unknown;
};

const allowedStatuses: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PREPARING,
  OrderStatus.SERVED,
  OrderStatus.CANCELLED,
];

function isOrderStatus(status: unknown): status is OrderStatus {
  return typeof status === "string" && allowedStatuses.includes(status as OrderStatus);
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateOrderBody;

    if (!isOrderStatus(body.status)) {
      return errorResponse("Geçerli bir sipariş durumu gönderilmelidir.", 400);
    }
    const status = body.status;

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const existingOrder = await prisma.customerOrder.findFirst({
      where: {
        id,
        branchId: demo.branch.id,
      },
      include: { table: true },
    });

    if (!existingOrder) return errorResponse("Sipariş bulunamadı.", 404);

    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.customerOrder.update({
        where: { id: existingOrder.id },
        data: {
          status,
          servedAt: status === OrderStatus.SERVED ? new Date() : existingOrder.servedAt,
          cancelledAt: status === OrderStatus.CANCELLED ? new Date() : existingOrder.cancelledAt,
        },
        include: {
          table: true,
          items: {
            orderBy: { id: "asc" },
          },
        },
      });

      if (status === OrderStatus.SERVED) {
        await tx.restaurantTable.update({
          where: { id: updatedOrder.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          orderId: updatedOrder.id,
          type: NotificationType.ORDER_UPDATED,
          title: "Sipariş durumu güncellendi",
          message: `${updatedOrder.orderNo} durumu ${status} olarak güncellendi.`,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.order.status_changed",
          entityType: "CustomerOrder",
          entityId: updatedOrder.id,
          metadata: {
            branchId: demo.branch.id,
            orderNo: updatedOrder.orderNo,
            before: existingOrder.status,
            after: status,
          },
        },
        tx,
      );

      return updatedOrder;
    });

    return Response.json(toOrderResponse(order));
  } catch {
    return errorResponse("Sipariş işlemi sırasında bir sorun oluştu.", 500);
  }
}
