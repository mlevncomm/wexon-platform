import { NextResponse } from "next/server";
import { getCurrentCustomerUser } from "@/lib/wexon-customer-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const user = await getCurrentCustomerUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { paymentId } = await context.params;
  const payment = await prisma.subscriptionPayment.findFirst({
    where: {
      id: paymentId,
      OR: [{ userId: user.id }, { organizationId: { in: user.memberships.map((m) => m.organizationId) } }],
    },
    include: { subscription: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    paymentId: payment.id,
    status: payment.status,
    merchantOid: payment.merchantOid,
    amount: Number(payment.amount),
    currency: payment.currency,
    paidAt: payment.paidAt,
    subscriptionId: payment.subscriptionId,
    subscriptionStatus: payment.subscription?.status ?? null,
    currentPeriodEnd: payment.subscription?.currentPeriodEnd ?? null,
  });
}
