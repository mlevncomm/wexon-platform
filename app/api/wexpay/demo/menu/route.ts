import { prisma } from "@/lib/prisma";
import { requireWexPayDemoContext } from "../_access";
import { errorResponse, toProductResponse } from "../_utils";

export async function GET(request: Request) {
  try {
    const demo = await requireWexPayDemoContext();
    if (!demo.ok) return demo.response;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") === "admin" ? "admin" : "customer";
    const includeInactive = scope === "admin";

    const [categories, products] = await Promise.all([
      prisma.menuCategory.findMany({
        where: {
          branchId: demo.branch.id,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.menuProduct.findMany({
        where: {
          branchId: demo.branch.id,
          ...(includeInactive
            ? {}
            : {
                isActive: true,
                category: { isActive: true },
              }),
        },
        include: { category: true },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      }),
    ]);

    return Response.json({
      restaurant: {
        id: demo.restaurant.id,
        name: demo.restaurant.name,
        slug: demo.restaurant.slug,
      },
      scope,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      })),
      products: products.map(toProductResponse),
    });
  } catch {
    return errorResponse("Menü verileri alınırken beklenmeyen bir hata oluştu.", 500);
  }
}
