import {
  readJsonBody,
  requireWexPayApiContext,
  toWexPayApiErrorLogContext,
  toWexPayMutationContext,
  wexpayApiErrorResponse,
} from "@/lib/wexpay-api-guard";
import { createOrder, updateOrderStatus } from "@/lib/wexpay-service";
import { listBranchOrders, listOrgOrders } from "@/lib/wexpay-read";
import { parseOrderCreatePayload, parseOrderStatusUpdatePayload } from "@/lib/wexpay-validation";

/**
 * PRODUCTION WexPay orders API (route group `(production)` -> /api/wexpay/orders).
 * Tenant is resolved from API key or customer session via the guard; reads need
 * `wexpay:read`, mutations need `wexpay:write`. Reuses the same service layer as
 * the operator UI so tenant/entitlement/audit rules are shared.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const branchId = url.searchParams.get("branchId") ?? undefined;

  const context = await requireWexPayApiContext(request, { requiredScope: "wexpay:read", organizationId });
  if (!context.ok) return context.response;

  const orders = branchId
    ? await listBranchOrders(context.organizationId, branchId)
    : await listOrgOrders(context.organizationId);

  return Response.json({
    organizationId: context.organizationId,
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      tableId: order.table.id,
      tableLabel: order.table.label,
      status: order.status,
      subtotal: Number(order.subtotal),
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireWexPayApiContext(request, { manage: true });
  if (!context.ok) return context.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const input = parseOrderCreatePayload(parsed.body);
    const order = await createOrder(toWexPayMutationContext(context), input);
    return Response.json({ id: order.id, orderNo: order.orderNo, subtotal: Number(order.subtotal) }, { status: 201 });
  } catch (error) {
    return wexpayApiErrorResponse(error, toWexPayApiErrorLogContext(context, "POST /api/wexpay/orders"));
  }
}

export async function PATCH(request: Request) {
  const context = await requireWexPayApiContext(request, { manage: true });
  if (!context.ok) return context.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const input = parseOrderStatusUpdatePayload(parsed.body);
    const order = await updateOrderStatus(toWexPayMutationContext(context), input);
    return Response.json({ id: order.id, status: order.status });
  } catch (error) {
    return wexpayApiErrorResponse(error, toWexPayApiErrorLogContext(context, "PATCH /api/wexpay/orders"));
  }
}
