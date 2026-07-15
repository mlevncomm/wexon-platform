import { writeAuditFailure } from "@/lib/wexon-audit";
import { enforcePublicQrIpRateLimit } from "@/lib/wexpay-public-rate-limit";
import { getPublicBranchMenu, resolvePublicTableByQr } from "@/lib/wexpay-read";
import { toPublicMenuModifierGroups } from "@/lib/wexpay-order-pricing";

/**
 * PUBLIC QR table resolution -> GET /api/wexpay/public/[qrCode]
 *
 * Unauthenticated diner endpoint. Rate-limited per client IP.
 * Never returns organizationId / riskReasons / secrets.
 */
export async function GET(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "menu", request, qrCode });
  if (!limited.ok) return limited.response;

  const resolution = await resolvePublicTableByQr(qrCode);
  if (!resolution) {
    writeAuditFailure({
      action: "wexpay.public.qr_not_found",
      message: "QR masa bulunamadı.",
      level: "WARN",
      source: "public_qr",
      ipAddress: limited.ipAddress,
      metadata: { qrCode },
    });
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
      products: category.products.map((product) => {
        const modifierGroups = toPublicMenuModifierGroups(
          product.productModifierGroups?.map((link) => ({
            groupId: link.groupId,
            sortOrder: link.sortOrder,
            isActive: link.isActive,
            group: link.group,
          })),
        );
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: Number(product.price),
          currency: product.currency,
          imageUrl: product.imageUrl,
          isPopular: product.isPopular,
          ...(modifierGroups.length > 0 ? { modifierGroups } : {}),
        };
      }),
    })),
  });
}
