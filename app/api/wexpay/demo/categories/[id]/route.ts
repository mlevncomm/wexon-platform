import { NotificationType } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../../_access";
import { errorResponse } from "../../_utils";

type Params = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  name?: unknown;
  isActive?: unknown;
};

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const existing = await prisma.menuCategory.findFirst({
      where: {
        id,
        branchId: demo.branch.id,
      },
    });

    if (!existing) return errorResponse("Kategori bulunamadı.", 404);

    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

    if (name !== undefined && name.length === 0) {
      return errorResponse("Kategori adı boş olamaz.", 400);
    }

    if (name === undefined && isActive === undefined) {
      return errorResponse("Güncellenecek alan gönderilmelidir.", 400);
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.menuCategory.findFirst({
        where: {
          branchId: demo.branch.id,
          name,
          NOT: { id: existing.id },
        },
      });
      if (conflict) return errorResponse("Bu isimde bir kategori zaten var.", 409);
    }

    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.menuCategory.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          title: "Kategori güncellendi",
          message: `${updated.name} kategorisi güncellendi.`,
          type: NotificationType.MENU_UPDATED,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.category.updated",
          entityType: "MenuCategory",
          entityId: updated.id,
          metadata: {
            before: { name: existing.name, isActive: existing.isActive },
            after: { name: updated.name, isActive: updated.isActive },
          },
        },
        tx,
      );

      return updated;
    });

    return Response.json({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
  } catch {
    return errorResponse("Kategori güncellenirken bir sorun oluştu.", 500);
  }
}
