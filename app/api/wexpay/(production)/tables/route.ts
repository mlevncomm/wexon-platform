import { prisma } from "@/lib/prisma";
import { requireWexPayApiContext } from "@/lib/wexpay-api-guard";

/**
 * Reference PRODUCTION WexPay route (route group `(production)` -> /api/wexpay/tables).
 *
 * This is a documented contract reference for the tenant-aware guard, NOT the
 * full production API. Unlike the demo endpoints, the organization is resolved
 * from the caller's API key or customer session - never a global fallback - and
 * the final access decision is delegated to Wexon Core.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? undefined;

  const context = await requireWexPayApiContext(request, {
    requiredScope: "wexpay:read",
    organizationId,
  });

  if (!context.ok) return context.response;

  const branches = await prisma.branch.findMany({
    where: { restaurant: { organizationId: context.organizationId } },
    include: {
      tables: {
        where: { isActive: true },
        orderBy: { label: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    organizationId: context.organizationId,
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      tables: branch.tables.map((table) => ({
        id: table.id,
        label: table.label,
        status: table.status,
        qrToken: table.qrCode,
      })),
    })),
  });
}
