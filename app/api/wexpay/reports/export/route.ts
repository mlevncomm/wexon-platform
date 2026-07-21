import { requireWexPayApiContext } from "@/lib/wexpay-api-guard";
import { prisma } from "@/lib/prisma";
import {
  getBranchDailyReport,
  getOpenTablesSummary,
  getPaymentBreakdownByProvider,
  getTopSellingProducts,
} from "@/lib/wexpay-read";

function csvEscape(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Tenant-scoped daily report CSV export scaffold.
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

  const ownedBranch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      restaurant: { organizationId: context.organizationId },
    },
    select: { id: true },
  });
  if (!ownedBranch) {
    return Response.json({ error: "Şube bulunamadı.", reason: "not_found" }, { status: 404 });
  }

  const [daily, providers, products, openTables] = await Promise.all([
    getBranchDailyReport(context.organizationId, branchId),
    getPaymentBreakdownByProvider(context.organizationId, branchId),
    getTopSellingProducts(context.organizationId, branchId, 10),
    getOpenTablesSummary(context.organizationId, branchId),
  ]);

  const lines = [
    "section,key,value",
    `summary,daily_paid_total,${daily.paidTotal}`,
    `summary,paid_count,${daily.paidCount}`,
    `summary,open_tables,${openTables.length}`,
    ...providers.map((row) => `provider,${csvEscape(row.provider)},${row.total}`),
    ...products.map((row) => `product,${csvEscape(row.name)},${row.total}`),
    ...openTables.map((row) => `open_table,${csvEscape(row.label)},${row.remainingAmount}`),
  ];

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wexpay-report-${branchId.slice(0, 8)}.csv"`,
    },
  });
}
