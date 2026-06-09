import { NotificationType } from ".prisma/client";
import { prisma } from "@/lib/prisma";
import { assertEntitlementLimit } from "@/lib/wexon-core-access";
import { requireWexPayDemoContext, writeWexPayDemoAudit } from "../_access";
import { errorResponse, toProductResponse } from "../_utils";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      categoryId?: unknown;
      price?: unknown;
      imageUrl?: unknown;
      isPopular?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const price = Number(body.price);

    if (!name || !categoryId || Number.isNaN(price) || price <= 0) {
      return errorResponse("Ürün adı, kategori ve geçerli fiyat zorunludur.", 400);
    }

    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const category = await prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        branchId: demo.branch.id,
      },
    });

    if (!category) return errorResponse("Kategori bulunamadı.", 404);

    const currentProductCount = await prisma.menuProduct.count({
      where: { branchId: demo.branch.id },
    });
    const limitCheck = assertEntitlementLimit(demo.entitlementMap, "product_limit", currentProductCount);
    if (!limitCheck.ok) {
      return errorResponse(limitCheck.message, 403);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.menuProduct.create({
        data: {
          branchId: demo.branch.id,
          categoryId: category.id,
          name,
          description: typeof body.description === "string" ? body.description.trim() : null,
          price,
          imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : null,
          isPopular: typeof body.isPopular === "boolean" ? body.isPopular : false,
          isActive: true,
          inStock: true,
          currency: "TRY",
        },
        include: { category: true },
      });

      await tx.businessNotification.create({
        data: {
          branchId: demo.branch.id,
          title: "Yeni ürün eklendi",
          message: `${created.name} menüye eklendi.`,
          type: NotificationType.MENU_UPDATED,
        },
      });

      await writeWexPayDemoAudit(
        {
          request,
          organizationId: demo.organizationId,
          action: "wexpay.demo.product.created",
          entityType: "MenuProduct",
          entityId: created.id,
          metadata: {
            branchId: demo.branch.id,
            categoryId: category.id,
            name: created.name,
            price,
          },
        },
        tx,
      );

      return created;
    });

    return Response.json(toProductResponse(product));
  } catch {
    return errorResponse("Ürün oluşturulurken beklenmeyen bir hata oluştu.", 500);
  }
}
