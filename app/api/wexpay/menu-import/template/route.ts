import { NextResponse } from "next/server";
import { buildSampleCsv, buildSampleXlsx } from "@/lib/wexpay-menu-import-parse";
import { getCustomerSession } from "@/lib/wexon-customer-auth";

/**
 * Downloadable CSV/XLSX template for MENU_IMPORT (authenticated customer session).
 * XLSX is built without exceljs (minimal OOXML + ZIP store).
 */
export async function GET(request: Request) {
  const session = await getCustomerSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  if (format === "xlsx") {
    const buffer = buildSampleXlsx();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="wexon-menu-sablon.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  }

  const body = buildSampleCsv();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wexon-menu-sablon.csv"',
      "Cache-Control": "no-store",
    },
  });
}
