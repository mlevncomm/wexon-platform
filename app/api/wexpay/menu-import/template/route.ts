import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { buildSampleCsv, MENU_IMPORT_CANONICAL_COLUMNS } from "@/lib/wexpay-menu-import-parse";
import { getCustomerSession } from "@/lib/wexon-customer-auth";

/**
 * Downloadable CSV/XLSX template for MENU_IMPORT (authenticated customer session).
 */
export async function GET(request: Request) {
  const session = await getCustomerSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Menu");
    sheet.addRow([...MENU_IMPORT_CANONICAL_COLUMNS]);
    sheet.addRow([
      "Icecekler",
      "Cay",
      "Demlik cay",
      45.0,
      "TRY",
      true,
      true,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    sheet.addRow([
      "Icecekler",
      "Kahve",
      "Turk kahvesi",
      80.0,
      "TRY",
      true,
      true,
      "Boyut",
      "Buyuk",
      10.0,
      "SINGLE",
      0,
      1,
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(buffer, {
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
