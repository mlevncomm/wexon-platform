import {
  requireWexPayApiContext,
  toWexPayMutationContext,
  wexpayApiErrorResponse,
} from "@/lib/wexpay-api-guard";
import { acknowledgeTableAssistRequest } from "@/lib/wexpay-service";

/**
 * PRODUCTION WexPay assist acknowledge
 * File: app/api/wexpay/(production)/assist-requests/[id]/acknowledge/route.ts
 * HTTP: POST /api/wexpay/assist-requests/[id]/acknowledge
 *
 * Guard uses wexpay:write (not manage) so cashier STAFF can pass the route;
 * assertCashierOperate enforces the final role check in the service layer.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const apiContext = await requireWexPayApiContext(request, {
    requiredScope: "wexpay:write",
  });
  if (!apiContext.ok) return apiContext.response;

  try {
    const result = await acknowledgeTableAssistRequest(toWexPayMutationContext(apiContext), {
      requestId: id,
    });
    return Response.json(result);
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: apiContext.organizationId,
      ipAddress: apiContext.ipAddress,
      route: "POST /api/wexpay/assist-requests/[id]/acknowledge",
    });
  }
}
