import { NotificationType, TableStatus } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../../../_access";
import { errorResponse, toTableResponse } from "../../../_utils";

type Params = {
  params: Promise<{ id: string }>;
};

const tableInclude = {
  orders: {
    where: {
      status: {
        not: "CANCELLED" as const,
      },
    },
    include: {
      items: {
        orderBy: { id: "asc" as const },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
  },
  receiptRequests: {
    where: {
      status: "REQUESTED" as const,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!id) return errorResponse("Masa id zorunludur.", 400);

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const table = await prisma.restaurantTable.findFirst({
      where: {
        id,
        branchId: demo.branch.id,
      },
    });

    if (!table) return errorResponse("Masa bulunamadı.", 404);

    const updatedTable = await prisma.$transaction(async (tx) => {
      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          type: NotificationType.TABLE_UPDATED,
          title: "Masa kapatıldı",
          message: `${table.label} kapatıldı.`,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.table.closed",
          entityType: "RestaurantTable",
          entityId: table.id,
          metadata: { branchId: demo.branch.id, label: table.label },
        },
        tx,
      );

      return tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: TableStatus.EMPTY },
        include: tableInclude,
      });
    });

    return Response.json(toTableResponse(updatedTable));
  } catch {
    return errorResponse("Masa işlemi sırasında bir sorun oluştu.", 500);
  }
}
