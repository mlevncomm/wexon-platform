import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createDeflateRaw } from "node:zlib";
import {
  MENU_IMPORT_MAX_BYTES,
  MENU_IMPORT_MAX_DATA_ROWS,
  buildSampleCsv,
  buildSampleXlsx,
  isFormulaInjection,
  normalizeTryPrice,
  parseMenuImportFile,
  sanitizeCsvInjection,
} from "@/lib/wexpay-menu-import-parse";
import {
  assertSafeXlsxZip,
  buildMinimalMenuImportXlsx,
  colLettersToIndex,
  inflateRawBounded,
  MENU_IMPORT_XLSX_MAX_INFLATED_BYTES,
  MENU_IMPORT_XLSX_MAX_MATRIX_COLS,
  parseCellRef,
  parseXlsxWorksheetMatrix,
} from "@/lib/wexpay-menu-import-xlsx";
import { deflateRawSync } from "node:zlib";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "menu-import");

function csvBuffer(body: string, fileName = "menu.csv") {
  return { buffer: Buffer.from(body, "utf8"), originalFileName: fileName };
}

/** Craft a ZIP with a single stored/deflated entry and custom size fields via central directory. */
function craftZipWithSizes(input: {
  name: string;
  payload: Buffer;
  method: 0 | 8;
  /** Override declared uncompressed size (zip-bomb claim). */
  declaredUncompressed?: number;
}): Buffer {
  const nameBuf = Buffer.from(input.name, "utf8");
  const compressed =
    input.method === 8 ? deflateRawSync(input.payload) : input.payload;
  const uncompressed = input.payload.length;
  const declaredUncompressed = input.declaredUncompressed ?? uncompressed;

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(input.method, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredUncompressed, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(input.method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredUncompressed, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42); // local header offset
  nameBuf.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, compressed, central, eocd]);
}

/** Deflate a run of zeros without retaining the full uncompressed buffer. */
async function deflateZeros(byteCount: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const def = createDeflateRaw({ level: 9 });
  const done = new Promise<Buffer>((resolve, reject) => {
    def.on("data", (c: Buffer) => chunks.push(c));
    def.on("end", () => resolve(Buffer.concat(chunks)));
    def.on("error", reject);
  });
  const block = Buffer.alloc(64 * 1024, 0);
  let remaining = byteCount;
  while (remaining > 0) {
    const n = Math.min(remaining, block.length);
    def.write(block.subarray(0, n));
    remaining -= n;
  }
  def.end();
  return done;
}

/** Multi-entry store ZIP for OOXML cell-limit fixtures. */
function craftStoreZip(
  files: Array<{ name: string; data: Buffer }>,
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const size = file.data.length;
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    localParts.push(local, file.data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);
    offset += local.length + file.data.length;
  }
  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDir, eocd]);
}

const OOXML_CONTENT_TYPES = Buffer.from(
  `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  "utf8",
);
const OOXML_WORKBOOK = Buffer.from(
  `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "utf8",
);
const OOXML_RELS = Buffer.from(
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  "utf8",
);

function craftOoxmlWithSheetXml(sheetXml: string): Buffer {
  return craftStoreZip([
    { name: "[Content_Types].xml", data: OOXML_CONTENT_TYPES },
    { name: "xl/workbook.xml", data: OOXML_WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: OOXML_RELS },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") },
  ]);
}

/** OOXML where worksheet is deflated with a lying tiny declared uncompressed size. */
function craftOoxmlWithDeflatedSheetLie(input: {
  compressedSheet: Buffer;
  declaredUncompressed: number;
}): Buffer {
  type Part = {
    name: string;
    body: Buffer;
    method: 0 | 8;
    declaredUncompressed: number;
  };
  const parts: Part[] = [
    {
      name: "[Content_Types].xml",
      body: OOXML_CONTENT_TYPES,
      method: 0,
      declaredUncompressed: OOXML_CONTENT_TYPES.length,
    },
    {
      name: "xl/workbook.xml",
      body: OOXML_WORKBOOK,
      method: 0,
      declaredUncompressed: OOXML_WORKBOOK.length,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      body: OOXML_RELS,
      method: 0,
      declaredUncompressed: OOXML_RELS.length,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      body: input.compressedSheet,
      method: 8,
      declaredUncompressed: input.declaredUncompressed,
    },
  ];

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const part of parts) {
    const nameBuf = Buffer.from(part.name, "utf8");
    const compressedSize = part.body.length;
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(part.method, 8);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(part.declaredUncompressed, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    localParts.push(local, part.body);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(part.method, 10);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(part.declaredUncompressed, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);
    offset += local.length + part.body.length;
  }
  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(parts.length, 8);
  eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDir, eocd]);
}

describe("sanitizeCsvInjection / isFormulaInjection", () => {
  it("detects formula-like values", () => {
    assert.equal(isFormulaInjection("=CMD()"), true);
    assert.equal(isFormulaInjection("+1234"), true);
    assert.equal(isFormulaInjection("@sum"), true);
    assert.equal(isFormulaInjection("-evil"), true);
    assert.equal(isFormulaInjection("-12.5"), false);
    assert.equal(sanitizeCsvInjection("=CMD()"), "'=CMD()");
  });
});

describe("normalizeTryPrice", () => {
  it("parses 1234.50, 1234,50, and 1.234,50", () => {
    assert.deepEqual(normalizeTryPrice("1234.50"), { ok: true, value: "1234.50" });
    assert.deepEqual(normalizeTryPrice("1234,50"), { ok: true, value: "1234.50" });
    assert.deepEqual(normalizeTryPrice("1.234,50"), { ok: true, value: "1234.50" });
  });

  it("rejects invalid, negative, and formula prices", () => {
    assert.equal(normalizeTryPrice("").ok, false);
    assert.equal(normalizeTryPrice("abc").ok, false);
    assert.equal(normalizeTryPrice("-10").ok, false);
    const inj = normalizeTryPrice("=1+1");
    assert.equal(inj.ok, false);
    if (!inj.ok) assert.equal(inj.code, "FORMULA_INJECTION");
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

    const en = await parseMenuImportFile(
      csvBuffer("category,product_name,description,price,active,in_stock\nDrinks,Tea,Hot,40.00,true,true\n"),
    );
    assert.equal(en.validRows, 1);
    assert.equal(en.rows[0]!.category, "Drinks");
  });

  it("rejects CSV formula injection in text fields (does not strip escape)", async () => {
    const result = await parseMenuImportFile(
      csvBuffer('category,product_name,price\nIcecek,"=HYPERLINK()",45.00\n'),
    );
    assert.equal(result.validRows, 0);
    assert.ok(result.errors.some((e) => e.errorCode === "FORMULA_INJECTION"));
    assert.ok(!result.rows.some((r) => r.productName.includes("HYPERLINK")));
  });

  it("rejects non-TRY currency instead of coercing", async () => {
    const result = await parseMenuImportFile(
      csvBuffer("category,product_name,price,currency\nIcecek,Cay,45.00,USD\n"),
    );
    assert.equal(result.validRows, 0);
    assert.ok(result.errors.some((e) => e.errorCode === "CURRENCY_UNSUPPORTED"));
  });

  it("flags conflicting modifier group rules in dry-run errors", async () => {
    const result = await parseMenuImportFile(
      csvBuffer(
        [
          "category,product_name,price,modifier_group,modifier_option,selection_type,min_select,max_select",
          "Icecek,Cay,45,Boyut,Kucuk,SINGLE,0,1",
          "Icecek,Kahve,50,Boyut,Buyuk,MULTI,1,3",
        ].join("\n"),
      ),
    );
    assert.ok(result.errors.some((e) => e.errorCode === "MODIFIER_RULE_CONFLICT"));
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
  });

  it("parses a tiny xlsx via buildMinimalMenuImportXlsx (no exceljs)", async () => {
    const buffer = buildMinimalMenuImportXlsx([
      ["category", "product_name", "price"],
      ["Icecek", "Cay", "45.00"],
    ]);
    const result = await parseMenuImportFile({
      buffer,
      originalFileName: "menu.xlsx",
    });
    assert.equal(result.validRows, 1);
    assert.equal(result.rows[0]!.productName, "Cay");
  });

  it("rejects crafted high-ratio XLSX zip-bomb before inflate", async () => {
    const bomb = craftZipWithSizes({
      name: "xl/worksheets/sheet1.xml",
      payload: Buffer.from("a".repeat(100), "utf8"),
      method: 8,
      declaredUncompressed: 5 * 1024 * 1024,
    });
    assert.throws(() => assertSafeXlsxZip(bomb), (err: unknown) => {
      return err instanceof Error && (err.name === "XLSX_ZIP_BOMB" || /XLSX_ZIP_BOMB/.test(err.message));
    });
    await assert.rejects(
      () => parseMenuImportFile({ buffer: bomb, originalFileName: "bomb.xlsx" }),
      (err: unknown) =>
        err instanceof Error && "code" in err && (err as { code: string }).code === "XLSX_ZIP_BOMB",
    );
  });

  it("buildSampleCsv and buildSampleXlsx parse cleanly", async () => {
    const sample = buildSampleCsv();
    const csv = await parseMenuImportFile(csvBuffer(sample, "sample.csv"));
    assert.ok(csv.validRows >= 3);
    assert.equal(csv.errorRows, 0);

    const xlsx = await parseMenuImportFile({
      buffer: buildSampleXlsx(),
      originalFileName: "sample.xlsx",
    });
    assert.ok(xlsx.validRows >= 2);
  });

  it("rejects underdeclared zip that inflates past hard output bound without huge heap", async () => {
    const overLimit = MENU_IMPORT_XLSX_MAX_INFLATED_BYTES + 256 * 1024;
    const compressed = await deflateZeros(overLimit);
    assert.ok(compressed.length < 64 * 1024, "zeros must compress tightly");

    const heapBefore = process.memoryUsage().heapUsed;
    await assert.rejects(
      () => inflateRawBounded(compressed, MENU_IMPORT_XLSX_MAX_INFLATED_BYTES),
      (err: unknown) =>
        err instanceof Error &&
        (err.name === "XLSX_TOO_LARGE" || /XLSX_TOO_LARGE/.test(err.message)),
    );
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;
    assert.ok(
      heapDelta < overLimit,
      `heap delta ${heapDelta} must stay below underdeclared bomb size ${overLimit}`,
    );

    // Full OOXML with matching local/central lie on the worksheet entry only.
    const underdeclared = craftOoxmlWithDeflatedSheetLie({
      compressedSheet: compressed,
      declaredUncompressed: 128,
    });

    // CD declared size looks safe — assertSafeXlsxZip must not be the only guard.
    assert.doesNotThrow(() => assertSafeXlsxZip(underdeclared));

    const heapBeforeParse = process.memoryUsage().heapUsed;
    await assert.rejects(
      () => parseXlsxWorksheetMatrix(underdeclared),
      (err: unknown) =>
        err instanceof Error &&
        (err.name === "XLSX_TOO_LARGE" || /XLSX_TOO_LARGE/.test(err.message)),
    );
    await assert.rejects(
      () => parseMenuImportFile({ buffer: underdeclared, originalFileName: "lie.xlsx" }),
      (err: unknown) =>
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "XLSX_TOO_LARGE",
    );
    const parseHeapDelta = process.memoryUsage().heapUsed - heapBeforeParse;
    assert.ok(
      parseHeapDelta < overLimit,
      `parse heap delta ${parseHeapDelta} must stay below underdeclared bomb size ${overLimit}`,
    );
  });

  it("rejects extreme column refs (XFD1 / ZZZZZZ1) before dense allocation", async () => {
    assert.throws(
      () => parseCellRef("XFD1"),
      (err: unknown) => err instanceof Error && err.name === "XLSX_CELL_LIMIT",
    );
    assert.throws(
      () => parseCellRef("ZZZZZZ1"),
      (err: unknown) =>
        err instanceof Error &&
        (err.name === "XLSX_CELL_LIMIT" || err.name === "XLSX_INVALID_ZIP"),
    );
    assert.equal(colLettersToIndex("A"), 0);
    assert.equal(colLettersToIndex("BL"), MENU_IMPORT_XLSX_MAX_MATRIX_COLS - 1);
    assert.throws(
      () => colLettersToIndex("BM"),
      (err: unknown) => err instanceof Error && err.name === "XLSX_CELL_LIMIT",
    );

    const xfdSheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:XFD1"/><sheetData><row r="1"><c r="XFD1" t="inlineStr"><is><t>boom</t></is></c></row></sheetData></worksheet>`;
    const xfdXlsx = craftOoxmlWithSheetXml(xfdSheet);
    await assert.rejects(
      () => parseXlsxWorksheetMatrix(xfdXlsx),
      (err: unknown) => err instanceof Error && err.name === "XLSX_CELL_LIMIT",
    );
    await assert.rejects(
      () => parseMenuImportFile({ buffer: xfdXlsx, originalFileName: "xfd.xlsx" }),
      (err: unknown) =>
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "XLSX_CELL_LIMIT",
    );

    const dimOnly = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:ZZZZZZ2000"/><sheetData/></worksheet>`;
    await assert.rejects(
      () => parseXlsxWorksheetMatrix(craftOoxmlWithSheetXml(dimOnly)),
      (err: unknown) =>
        err instanceof Error &&
        (err.name === "XLSX_CELL_LIMIT" || err.name === "XLSX_INVALID_ZIP"),
    );
  });

  it("parses openpyxl-produced real XLSX fixture", async () => {
    const buffer = readFileSync(join(FIXTURES_DIR, "openpyxl-menu-sample.xlsx"));
    const matrix = await parseXlsxWorksheetMatrix(buffer);
    assert.ok(matrix.length >= 3);
    assert.equal(String(matrix[0]![0]).toLowerCase(), "category");

    const result = await parseMenuImportFile({
      buffer,
      originalFileName: "openpyxl-menu-sample.xlsx",
    });
    assert.equal(result.validRows, 2);
    assert.equal(result.errorRows, 0);
    assert.equal(result.rows[0]!.productName, "Cay");
    assert.equal(result.rows[0]!.price, "45.00");
    assert.equal(result.rows[1]!.productName, "Adana");
    assert.equal(result.rows[1]!.price, "320.50");
  });
});
