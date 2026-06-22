import { requireWexPayApiContext } from "@/lib/wexpay-api-guard";
import { getOperationsSnapshot } from "@/lib/wexpay-read";

/**
 * Tenant-scoped operations snapshot for panel polling.
 * GET /api/wexpay/operations/snapshot?organizationId=&branchId=
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId")?.trim() ?? undefined;
  const branchId = url.searchParams.get("branchId")?.trim();

  if (!branchId) {
    return Response.json({ error: "branchId zorunludur.", reason: "validation" }, { status: 400 });
  }

  const context = await requireWexPayApiContext(request, { organizationId, requiredScope: "wexpay:read" });
  if (!context.ok) return context.response;

  const snapshot = await getOperationsSnapshot(context.organizationId, branchId);
  return Response.json(snapshot);
}
