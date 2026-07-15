import { writeAuditFailure } from "@/lib/wexon-audit";
import { wexpayApiErrorResponse } from "@/lib/wexpay-api-guard";
import { enforcePublicQrIpRateLimit } from "@/lib/wexpay-public-rate-limit";
import { resolvePublicTableByQr } from "@/lib/wexpay-read";
import { getPublicTableBill } from "@/lib/wexpay-service";

/**
 * PUBLIC QR table bill -> GET /api/wexpay/public/[qrCode]/bill
 * Session-scoped account snapshot for the diner payment screen.
 */
export async function GET(request: Request, context: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = await context.params;

  const limited = enforcePublicQrIpRateLimit({ kind: "bill", request, qrCode });
  if (!limited.ok) return limited.response;
  const ipAddress = limited.ipAddress;

  const resolution = await resolvePublicTableByQr(qrCode);
  if (!resolution) {
    return Response.json({ error: "Masa bulunamadı." }, { status: 404 });
  }
  if (!resolution.allowed) {
    return Response.json(
      { error: "Bu işletme şu anda QR sipariş kabul etmiyor.", reason: "access_closed" },
      { status: 403 },
    );
  }

  try {
    const bill = await getPublicTableBill({
      organizationId: resolution.organizationId,
      branchId: resolution.branch.id,
      tableId: resolution.table.id,
    });

    const onlineCheckoutEnabled = process.env.WEXPAY_PAYTR_ENABLE_API === "true";

    return Response.json({
      restaurant: { name: resolution.restaurant.name },
      branch: { id: resolution.branch.id, name: resolution.branch.name },
      table: { id: resolution.table.id, label: resolution.table.label, status: resolution.table.status },
      session: {
        open: !bill.empty,
        tableStatus: resolution.table.status,
      },
      bill: {
        ...bill,
        subtotal: bill.totalAmount,
        paid: bill.paidAmount,
        remaining: bill.remainingAmount,
      },
      paymentAvailability: {
        staffPaymentRequest: true,
        onlineCheckout: onlineCheckoutEnabled,
        liveChargeFromThisEndpoint: false,
      },
    });
  } catch (error) {
    return wexpayApiErrorResponse(error, {
      organizationId: resolution.organizationId,
      ipAddress,
      route: "GET /api/wexpay/public/bill",
    });
  }
}
