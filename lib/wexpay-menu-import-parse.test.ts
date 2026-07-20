import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  MENU_IMPORT_MAX_BYTES,
  MENU_IMPORT_MAX_DATA_ROWS,
  buildSampleCsv,
  normalizeTryPrice,
  parseMenuImportFile,
  sanitizeCsvInjection,
} from "@/lib/wexpay-menu-import-parse";

function csvBuffer(body: string, fileName = "menu.csv") {
  return { buffer: Buffer.from(body, "utf8"), originalFileName: fileName };
}

describe("sanitizeCsvInjection", () => {
  it("prefixes formula-like values", () => {
    assert.equal(sanitizeCsvInjection("=CMD()"), "'=CMD()");
    assert.equal(sanitizeCsvInjection("+1234"), "'+1234");
    assert.equal(sanitizeCsvInjection("@sum"), "'@sum");
    assert.equal(sanitizeCsvInjection("-evil"), "'-evil");
  });

  it("leaves numeric negatives alone", () => {
    assert.equal(sanitizeCsvInjection("-12.5"), "-12.5");
  });
});

describe("normalizeTryPrice", () => {
  it("parses 1234.50, 1234,50, and 1.234,50", () => {
    assert.deepEqual(normalizeTryPrice("1234.50"), { ok: true, value: "1234.50" });
    assert.deepEqual(normalizeTryPrice("1234,50"), { ok: true, value: "1234.50" });
    assert.deepEqual(normalizeTryPrice("1.234,50"), { ok: true, value: "1234.50" });
  });

  it("rejects invalid and negative prices", () => {
    assert.equal(normalizeTryPrice("").ok, false);
    assert.equal(normalizeTryPrice("abc").ok, false);
    assert.equal(normalizeTryPrice("-10").ok, false);
    const neg = normalizeTryPrice("-10");
    assert.equal(neg.ok, false);
    if (!neg.ok) assert.equal(neg.code, "PRICE_NEGATIVE");
  });
});

describe("parseMenuImportFile", () => {
  it("parses comma CSV", async () => {
    const result = await parseMenuImportFile(
      csvBuffer("category,product_name,price\nIcecek,Cay,45.00\n"),
    );
    assert.equal(result.validRows, 1);
    assert.equal(result.rows[0]!.productName, "Cay");
    assert.equal(result.rows[0]!.price, "45.00");
  });

  it("parses semicolon CSV and strips BOM", async () => {
    const result = await parseMenuImportFile(
      csvBuffer("\uFEFFkategori;urun_adi;fiyat\nIcecek;Cay;45,00\n"),
    );
    assert.equal(result.validRows, 1);
    assert.equal(result.rows[0]!.category, "Icecek");
    assert.equal(result.rows[0]!.price, "45.00");
  });

  it("accepts Turkish and English headers", async () => {
    const tr = await parseMenuImportFile(
      csvBuffer("kategori,ürün_adı,açıklama,fiyat,aktif,stokta\nAna,Adana,Acili,320.50,evet,var\n"),
    );
    assert.equal(tr.validRows, 1);
    assert.equal(tr.rows[0]!.productName, "Adana");
    assert.equal(tr.rows[0]!.isActive, true);

    const en = await parseMenuImportFile(
      csvBuffer("category,product_name,description,price,active,in_stock\nDrinks,Tea,Hot,40.00,true,true\n"),
    );
    assert.equal(en.validRows, 1);
    assert.equal(en.rows[0]!.category, "Drinks");
  });

  it("sanitizes CSV injection in cell values", async () => {
    const result = await parseMenuImportFile(
      csvBuffer('category,product_name,price\nIcecek,"=HYPERLINK()",45.00\n'),
    );
    assert.equal(result.validRows, 1);
    assert.equal(result.rows[0]!.productName, "=HYPERLINK()");
  });

  it("rejects CSV filename that carries ZIP/XLSX magic (not parsed as CSV)", async () => {
    const zipish = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    await assert.rejects(() =>
      parseMenuImportFile({ buffer: zipish, originalFileName: "menu.csv" }),
    );
  });

  it("rejects MIME mismatch (xlsx name without zip)", async () => {
    await assert.rejects(
      () =>
        parseMenuImportFile({
          buffer: Buffer.from("category,product_name,price\nA,B,1\n", "utf8"),
          originalFileName: "menu.xlsx",
        }),
      (err: unknown) =>
        err instanceof Error && "code" in err && (err as { code: string }).code === "MIME_MISMATCH",
    );
  });

  it("rejects files over 2MB", async () => {
    const huge = Buffer.alloc(MENU_IMPORT_MAX_BYTES + 1, 0x41);
    await assert.rejects(
      () => parseMenuImportFile({ buffer: huge, originalFileName: "big.csv" }),
      (err: unknown) =>
        err instanceof Error && "code" in err && (err as { code: string }).code === "FILE_TOO_LARGE",
    );
  });

  it("rejects more than 2000 data rows", async () => {
    const lines = ["category,product_name,price"];
    for (let i = 0; i < MENU_IMPORT_MAX_DATA_ROWS + 1; i += 1) {
      lines.push(`Cat,Prod${i},10.00`);
    }
    await assert.rejects(
      () => parseMenuImportFile(csvBuffer(`${lines.join("\n")}\n`)),
      (err: unknown) =>
        err instanceof Error && "code" in err && (err as { code: string }).code === "ROW_LIMIT",
    );
  });

  it("warns when tax columns are ignored", async () => {
    const result = await parseMenuImportFile(
      csvBuffer("category,product_name,price,kdv\nIcecek,Cay,45.00,10\n"),
    );
    assert.equal(result.validRows, 1);
    assert.ok(result.warnings.some((w) => w.code === "TAX_COLUMN_IGNORED"));
  });

  it("records invalid/negative price row errors", async () => {
    const result = await parseMenuImportFile(
      csvBuffer("category,product_name,price\nA,Good,10.00\nB,Bad,-5\nC,Nope,abc\n"),
    );
    assert.equal(result.validRows, 1);
    assert.equal(result.errorRows, 2);
    assert.ok(result.errors.some((e) => e.errorCode === "PRICE_NEGATIVE"));
    assert.ok(result.errors.some((e) => e.errorCode === "PRICE_INVALID"));
  });

  it("parses a tiny xlsx buffer via ExcelJS", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Menu");
    sheet.addRow(["category", "product_name", "price"]);
    sheet.addRow(["Icecek", "Cay", "45.00"]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const result = await parseMenuImportFile({
      buffer,
      originalFileName: "menu.xlsx",
    });
    assert.equal(result.validRows, 1);
    assert.equal(result.rows[0]!.productName, "Cay");
    assert.match(result.contentType, /spreadsheetml/);
  });

  it("buildSampleCsv parses cleanly", async () => {
    const sample = buildSampleCsv();
    assert.ok(sample.charCodeAt(0) === 0xfeff || sample.startsWith("category"));
    const result = await parseMenuImportFile(csvBuffer(sample, "sample.csv"));
    assert.ok(result.validRows >= 3);
    assert.equal(result.errorRows, 0);
    assert.ok(result.rows.some((r) => r.productName === "Cay"));
  });
});
