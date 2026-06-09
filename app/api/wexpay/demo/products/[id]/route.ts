import { NotificationType } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../../_access";
import { errorResponse, toProductResponse } from "../../_utils";

type Params = {
  params: Promise<{ id: string }>;
};

function getNotificationTitle({
  priceChanged,
  activeChanged,
  stockChanged,
}: {
  priceChanged: boolean;
  activeChanged: boolean;
  stockChanged: boolean;
}) {
  if (priceChanged) return "Ürün fiyatı güncellendi";
  if (activeChanged) return "Ürün durumu güncellendi";
  if (stockChanged) return "Ürün stok durumu güncellendi";
  return "Ürün güncellendi";
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      categoryId?: unknown;
      price?: unknown;
      imageUrl?: unknown;
      isActive?: unknown;
      inStock?: unknown;
      isPopular?: unknown;
    };

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const existingProduct = await prisma.menuProduct.findFirst({
      where: {
        id,
        branchId: demo.branch.id,
      },
    });

    if (!existingProduct) return errorResponse("Ürün bulunamadı.", 404);

    if (typeof body.categoryId === "string") {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: body.categoryId,
          branchId: demo.branch.id,
        },
      });

      if (!category) return errorResponse("Kategori bulunamadı.", 404);
    }

    const price = body.price === undefined ? undefined : Number(body.price);
    if (price !== undefined && (Number.isNaN(price) || price <= 0)) {
      return errorResponse("Geçerli bir fiyat girilmelidir.", 400);
    }

    const data = {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.description === "string" ? { description: body.description.trim() } : {}),
      ...(typeof body.categoryId === "string" ? { categoryId: body.categoryId } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl.trim() } : {}),
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(typeof body.inStock === "boolean" ? { inStock: body.inStock } : {}),
      ...(typeof body.isPopular === "boolean" ? { isPopular: body.isPopular } : {}),
    };

    if (Object.keys(data).length === 0) {
      return errorResponse("Güncellenecek alan bulunamadı.", 400);
    }

    const title = getNotificationTitle({
      priceChanged: price !== undefined && Number(existingProduct.price) !== price,
      activeChanged:
        typeof body.isActive === "boolean" && existingProduct.isActive !== body.isActive,
      stockChanged: typeof body.inStock === "boolean" && existingProduct.inStock !== body.inStock,
    });

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const updated = await tx.menuProduct.update({
        where: { id: existingProduct.id },
        data,
        include: { category: true },
      });

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          title,
          message: `${updated.name} güncellendi.`,
          type: NotificationType.MENU_UPDATED,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.product.updated",
          entityType: "MenuProduct",
          entityId: updated.id,
          metadata: {
            branchId: demo.branch.id,
            changedFields: Object.keys(data),
          },
        },
        tx,
      );

      return updated;
    });

    return Response.json(toProductResponse(updatedProduct));
  } catch {
    return errorResponse("Ürün güncellenirken beklenmeyen bir hata oluştu.", 500);
  }
}
