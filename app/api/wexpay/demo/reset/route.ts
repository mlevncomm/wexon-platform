import { TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse } from "../_utils";

export async function POST(request: Request) {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const tableIds = (
      await prisma.restaurantTable.findMany({
        where: { branchId: demo.branch.id },
        select: { id: true },
      })
    ).map((table) => table.id);
    const orderIds = (
      await prisma.customerOrder.findMany({
        where: { branchId: demo.branch.id },
        select: { id: true },
      })
    ).map((order) => order.id);
    const paymentIds = (
      await prisma.payment.findMany({
        where: { branchId: demo.branch.id },
        select: { id: true },
      })
    ).map((payment) => payment.id);

    await prisma.$transaction(async (tx) => {
      await tx.businessNotification.deleteMany({
        where: { branchId: demo.branch.id },
      });
      await tx.receiptRequest.deleteMany({
        where: {
          OR: [
            { tableId: { in: tableIds } },
            { orderId: { in: orderIds } },
            { paymentId: { in: paymentIds } },
          ],
        },
      });
      await tx.payment.deleteMany({
        where: { branchId: demo.branch.id },
      });
      await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.customerOrder.deleteMany({
        where: { branchId: demo.branch.id },
      });
      await tx.restaurantTable.updateMany({
        where: { branchId: demo.branch.id },
        data: { status: TableStatus.EMPTY },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.data.reset",
          entityType: "Branch",
          entityId: demo.branch.id,
          metadata: {
            branchId: demo.branch.id,
            clearedOrders: orderIds.length,
            clearedPayments: paymentIds.length,
            clearedTables: tableIds.length,
          },
        },
        tx,
      );
    });

    return Response.json({
      success: true,
      message: "Demo verileri sıfırlandı.",
    });
  } catch {
    return errorResponse("Demo verileri sıfırlanırken bir sorun oluştu.", 500);
  }
}
