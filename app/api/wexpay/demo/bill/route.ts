import { PaymentStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext } from "../_access";
import { errorResponse } from "../_utils";

/**
 * Demo masa hesabı: açık sipariş kalemleri + ödeme kalem tahsisi.
 * itemIds audit metadata'dan okunur; yoksa FIFO.
 * GET /api/wexpay/demo/bill?tableName=Masa%2012
 */
export async function GET(request: Request) {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("tableName")?.trim() || "Masa 12";

    const table = await prisma.restaurantTable.findFirst({
      where: {
        branchId: demo.branch.id,
        label: tableName,
        isActive: true,
      },
    });

    if (!table) return errorResponse("Masa bulunamadı.", 404);

    const isClosed = table.status === "EMPTY" || table.status === "CLOSED";

    const orders = isClosed
      ? []
      : await prisma.customerOrder.findMany({
          where: {
            tableId: table.id,
            status: { not: "CANCELLED" },
          },
          include: {
            items: { orderBy: { id: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        });

    const payments = isClosed
      ? []
      : await prisma.payment.findMany({
          where: {
            tableId: table.id,
            status: PaymentStatus.PAID,
          },
          orderBy: { createdAt: "asc" },
        });

    const paymentIds = payments.map((payment) => payment.id);
    const audits =
      paymentIds.length === 0
        ? []
        : await prisma.auditLog.findMany({
            where: {
              organizationId: demo.organizationId,
              action: "wexpay.demo.payment.created",
              entityId: { in: paymentIds },
            },
            select: {
              entityId: true,
              metadataJson: true,
            },
          });

    const paidItemIds = new Set<string>();
    for (const audit of audits) {
      const metadata = audit.metadataJson;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
      const itemIds = (metadata as { itemIds?: unknown }).itemIds;
      if (!Array.isArray(itemIds)) continue;
      for (const itemId of itemIds) {
        if (typeof itemId === "string" && itemId.trim()) paidItemIds.add(itemId.trim());
      }
    }

    const rawItems = orders.flatMap((order) =>
      order.items.map((item) => ({
        id: item.id,
        orderId: order.id,
        orderNumber: order.orderNo,
        productId: item.productId,
        name: item.productName,
        quantity: item.quantity,
        price: Number(item.unitPrice),
        lineTotal: Number(item.totalPrice),
        createdAt: order.createdAt.toISOString(),
      })),
    );

    let items: Array<(typeof rawItems)[number] & { paid: boolean }>;

    if (paidItemIds.size > 0) {
      items = rawItems.map((item) => ({
        ...item,
        paid: paidItemIds.has(item.id),
      }));
    } else {
      let paidBudget = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const tipTotal = payments.reduce((sum, payment) => sum + Number(payment.tipAmount ?? 0), 0);
      paidBudget = Math.max(paidBudget - tipTotal, 0);

      items = rawItems.map((item) => {
        if (paidBudget >= item.lineTotal - 0.001) {
          paidBudget -= item.lineTotal;
          return { ...item, paid: true };
        }
        return { ...item, paid: false };
      });
    }

    const tipTotal = payments.reduce((sum, payment) => sum + Number(payment.tipAmount ?? 0), 0);
    const unpaidTotal = items
      .filter((item) => !item.paid)
      .reduce((sum, item) => sum + item.lineTotal, 0);
    const paidItemsTotal = items
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + item.lineTotal, 0);

    return Response.json({
      table: {
        id: table.id,
        name: table.label,
        status: table.status,
        qrToken: table.qrCode,
      },
      items,
      totals: {
        billTotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
        paidTotal: paidItemsTotal,
        unpaidTotal,
        tipPaidTotal: tipTotal,
        paymentCount: payments.length,
        orderCount: orders.length,
      },
    });
  } catch {
    return errorResponse("Masa hesabı yüklenirken bir sorun oluştu.", 500);
  }
}
