import { NotificationType } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse } from "../_utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) return errorResponse("Kategori adı zorunludur.", 400);

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const lastCategory = await prisma.menuCategory.findFirst({
      where: { branchId: demo.branch.id },
      orderBy: { sortOrder: "desc" },
    });

    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.menuCategory.create({
        data: {
          branchId: demo.branch.id,
          name,
          isActive: true,
          sortOrder: (lastCategory?.sortOrder ?? -1) + 1,
        },
      });

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          title: "Yeni kategori eklendi",
          message: `${created.name} kategorisi menüye eklendi.`,
          type: NotificationType.MENU_UPDATED,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.category.created",
          entityType: "MenuCategory",
          entityId: created.id,
          metadata: { branchId: demo.branch.id, name: created.name },
        },
        tx,
      );

      return created;
    });

    return Response.json({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
  } catch {
    return errorResponse("Kategori oluşturulurken beklenmeyen bir hata oluştu.", 500);
  }
}
