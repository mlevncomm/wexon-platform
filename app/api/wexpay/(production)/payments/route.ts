import {
  readJsonBody,
  requireWexPayApiContext,
  toWexPayApiErrorLogContext,
  toWexPayMutationContext,
  wexpayApiErrorResponse,
} from "@/lib/wexpay-api-guard";
import { createPayment, updatePayment } from "@/lib/wexpay-service";
import { listBranchPayments, listOrgPayments } from "@/lib/wexpay-read";
import { parsePaymentCreatePayload, parsePaymentUpdatePayload } from "@/lib/wexpay-validation";

/**
 * PRODUCTION WexPay payments API (route group `(production)` -> /api/wexpay/payments).
 * These are operational WexPay payments, NOT Core BillingPayment. Reads need
 * `wexpay:read`, mutations need `wexpay:write`. Reuses the operator service layer.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const branchId = url.searchParams.get("branchId") ?? undefined;

  const context = await requireWexPayApiContext(request, { requiredScope: "wexpay:read", organizationId });
  if (!context.ok) return context.response;

  const payments = branchId
    ? await listBranchPayments(context.organizationId, branchId)
    : await listOrgPayments(context.organizationId);

  return Response.json({
    organizationId: context.organizationId,
    payments: payments.map((payment) => ({
      id: payment.id,
      tableId: payment.table.id,
      tableLabel: payment.table.label,
      orderNo: payment.order?.orderNo ?? null,
      amount: Number(payment.amount),
      status: payment.status,
      provider: payment.provider,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireWexPayApiContext(request, { manage: true });
  if (!context.ok) return context.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const input = parsePaymentCreatePayload(parsed.body);
    const payment = await createPayment(toWexPayMutationContext(context), input);
    return Response.json({ id: payment.id, amount: Number(payment.amount), status: payment.status }, { status: 201 });
  } catch (error) {
    return wexpayApiErrorResponse(error, toWexPayApiErrorLogContext(context, "POST /api/wexpay/payments"));
  }
}

export async function PATCH(request: Request) {
  const context = await requireWexPayApiContext(request, { manage: true });
  if (!context.ok) return context.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  try {
    const input = parsePaymentUpdatePayload(parsed.body);
    const payment = await updatePayment(toWexPayMutationContext(context), input);
    return Response.json({ id: payment.id, status: payment.status });
  } catch (error) {
    return wexpayApiErrorResponse(error, toWexPayApiErrorLogContext(context, "PATCH /api/wexpay/payments"));
  }
}
