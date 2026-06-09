import { getPublicBranchMenu, resolvePublicTableByQr } from "@/lib/wexpay-read";

/**
 * PUBLIC QR table resolution (Phase 2B scaffold) -> /api/wexpay/public/[qrCode].
 *
 * Unauthenticated diner endpoint. Resolves qrCode -> table -> branch ->
 * restaurant -> organizationId and gates the public menu through Wexon Core
 * access (`evaluateProductAccess`). No demo slug, no global fallback. If the
 * owning organization's WexPay access is not allowed, the menu is closed.
 */
export async function GET(_request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const resolution = await resolvePublicTableByQr(qrCode);
  if (!resolution) {
    return Response.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  if (!resolution.allowed) {
    return Response.json({ error: "Bu işletme şu anda QR sipariş kabul etmiyor.", reason: "access_closed" }, { status: 403 });
  }

  const categories = await getPublicBranchMenu(resolution.organizationId, resolution.branch.id);

  return Response.json({
    restaurant: { name: resolution.restaurant.name },
    branch: { id: resolution.branch.id, name: resolution.branch.name },
    table: { id: resolution.table.id, label: resolution.table.label, status: resolution.table.status },
    menu: categories.map((category) => ({
      id: category.id,
      name: category.name,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        currency: product.currency,
      })),
    })),
  });
}
