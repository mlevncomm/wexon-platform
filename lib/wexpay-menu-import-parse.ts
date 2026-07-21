import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import {
  assertSafeXlsxZip,
  buildMinimalMenuImportXlsx,
  parseXlsxWorksheetMatrix,
} from "@/lib/wexpay-menu-import-xlsx";

export const MENU_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const MENU_IMPORT_MAX_DATA_ROWS = 2000;
/** Declared uncompressed ZIP payload ceiling (checked before inflate). */
export const MENU_IMPORT_MAX_XLSX_UNCOMPRESSED = 12 * 1024 * 1024;

export const MENU_IMPORT_CANONICAL_COLUMNS = [
  "category",
  "product_name",
  "description",
  "price",
  "currency",
  "active",
  "in_stock",
  "modifier_group",
  "modifier_option",
  "modifier_price_delta",
  "selection_type",
  "min_select",
  "max_select",
] as const;

export type MenuImportCanonicalColumn = (typeof MENU_IMPORT_CANONICAL_COLUMNS)[number];

const HEADER_ALIASES: Record<string, MenuImportCanonicalColumn | "tax_ignored"> = {
  category: "category",
  kategori: "category",
  product_name: "product_name",
  urun_adi: "product_name",
  ürün_adı: "product_name",
  "ürün_adi": "product_name",
  description: "description",
  aciklama: "description",
  açıklama: "description",
  price: "price",
  fiyat: "price",
  currency: "currency",
  para_birimi: "currency",
  active: "active",
  aktif: "active",
  in_stock: "in_stock",
  stokta: "in_stock",
  modifier_group: "modifier_group",
  secenek_grubu: "modifier_group",
  seçenek_grubu: "modifier_group",
  modifier_option: "modifier_option",
  secenek: "modifier_option",
  seçenek: "modifier_option",
  modifier_price_delta: "modifier_price_delta",
  fiyat_farki: "modifier_price_delta",
  fiyat_farkı: "modifier_price_delta",
  selection_type: "selection_type",
  secim_turu: "selection_type",
  seçim_türü: "selection_type",
  min_select: "min_select",
  min_secim: "min_select",
  min_seçim: "min_select",
  max_select: "max_select",
  max_secim: "max_select",
  max_seçim: "max_select",
  // Tax columns are ignored — canonical policy taxEnabled=false.
  tax: "tax_ignored",
  kdv: "tax_ignored",
  vat: "tax_ignored",
  tax_rate: "tax_ignored",
  kdv_orani: "tax_ignored",
  kdv_oranı: "tax_ignored",
};

export type MenuImportRowErrorDraft = {
  rowNumber: number;
  errorCode: string;
  message: string;
  safeContextJson?: Record<string, string | number | boolean | null>;
};

export type MenuImportWarning = {
  code: string;
  message: string;
  rowNumber?: number;
};

export type NormalizedMenuImportRow = {
  rowNumber: number;
  category: string;
  productName: string;
  description: string | null;
  price: string;
  currency: string;
  isActive: boolean;
  inStock: boolean;
  modifierGroup: string | null;
  modifierOption: string | null;
  modifierPriceDelta: string | null;
  selectionType: "SINGLE" | "MULTI" | null;
  minSelect: number | null;
  maxSelect: number | null;
};

export type MenuImportParseResult = {
  checksum: string;
  contentType: string;
  byteSize: number;
  originalFileName: string;
  rows: NormalizedMenuImportRow[];
  errors: MenuImportRowErrorDraft[];
  warnings: MenuImportWarning[];
  totalRows: number;
  validRows: number;
  errorRows: number;
};

export class MenuImportParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MenuImportParseError";
    this.code = code;
  }
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

/** True when a cell looks like spreadsheet formula / CSV injection. */
export function isFormulaInjection(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const first = v[0]!;
  if (first === "=" || first === "+" || first === "@") return true;
  // Leading dash only when followed by a letter (not a numeric negative).
  if (first === "-" && /[a-zA-Z]/.test(v[1] ?? "")) return true;
  return false;
}

/**
 * @deprecated Prefer isFormulaInjection + reject. Kept for unit coverage of detection.
 * Does not strip the leading apostrophe on later reads — callers must not undo escaping.
 */
export function sanitizeCsvInjection(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (isFormulaInjection(v)) return `'${v}`;
  return v;
}

export function normalizeTryPrice(raw: string): { ok: true; value: string } | { ok: false; code: string; message: string } {
  const trimmed = String(raw ?? "").trim();
  if (isFormulaInjection(trimmed)) {
    return { ok: false, code: "FORMULA_INJECTION", message: "Formül/CSV injection fiyat kabul edilmez." };
  }

  const cleaned = trimmed
    .replace(/\s/g, "")
    .replace(/₺/g, "")
    .replace(/TRY/gi, "")
    .replace(/TL/gi, "");

  if (!cleaned) {
    return { ok: false, code: "PRICE_REQUIRED", message: "Fiyat zorunludur." };
  }
  if (/[eE]/.test(cleaned)) {
    return { ok: false, code: "PRICE_INVALID", message: "Bilimsel gösterimli fiyat kabul edilmez." };
  }

  let normalized = cleaned;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    // 1.234,50 → European; 1,234.50 → US
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    // 1234,50 or 1.234 style without dots — treat comma as decimal
    const parts = normalized.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      normalized = `${parts[0]!.replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized) && !/^-?\d+\.\d+$/.test(normalized)) {
    // Allow more than 2 decimals then round later check
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      return { ok: false, code: "PRICE_INVALID", message: "Fiyat formatı geçersiz." };
    }
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { ok: false, code: "PRICE_INVALID", message: "Fiyat sayısal değil." };
  }
  if (num < 0) {
    return { ok: false, code: "PRICE_NEGATIVE", message: "Negatif fiyat kabul edilmez." };
  }
  if (!Number.isFinite(num) || num === Number.POSITIVE_INFINITY) {
    return { ok: false, code: "PRICE_INVALID", message: "Fiyat geçersiz." };
  }

  const rounded = Math.round(num * 100) / 100;
  return { ok: true, value: rounded.toFixed(2) };
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || String(raw).trim() === "") return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "evet", "aktif", "var"].includes(v)) return true;
  if (["0", "false", "no", "hayir", "hayır", "pasif", "yok"].includes(v)) return false;
  return defaultValue;
}

function sniffContent(buffer: Buffer, fileName: string): { kind: "csv" | "xlsx"; contentType: string } {
  const name = fileName.toLowerCase();
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const textStart = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8");
  const looksCsv =
    textStart.includes(",") ||
    textStart.includes(";") ||
    /category|kategori|product_name|urun_adi|ürün/i.test(textStart);

  if (isZip || name.endsWith(".xlsx")) {
    if (!isZip) {
      throw new MenuImportParseError("MIME_MISMATCH", "XLSX uzantısı var ama dosya ZIP/XLSX değil.");
    }
    return {
      kind: "xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  if (name.endsWith(".csv") || looksCsv) {
    if (isZip) {
      throw new MenuImportParseError("MIME_MISMATCH", "CSV uzantısı var ama dosya XLSX/ZIP.");
    }
    return { kind: "csv", contentType: "text/csv; charset=utf-8" };
  }

  throw new MenuImportParseError("UNSUPPORTED_TYPE", "Yalnızca .csv veya .xlsx desteklenir.");
}

function mapHeaders(rawHeaders: string[]): {
  indexToCanonical: Map<number, MenuImportCanonicalColumn>;
  taxColumnsIgnored: number;
  unknownHeaders: string[];
} {
  const indexToCanonical = new Map<number, MenuImportCanonicalColumn>();
  let taxColumnsIgnored = 0;
  const unknownHeaders: string[] = [];
  const seen = new Set<MenuImportCanonicalColumn>();

  rawHeaders.forEach((h, idx) => {
    const key = normalizeHeaderKey(h);
    if (!key) return;
    const mapped = HEADER_ALIASES[key];
    if (!mapped) {
      unknownHeaders.push(h);
      return;
    }
    if (mapped === "tax_ignored") {
      taxColumnsIgnored += 1;
      return;
    }
    if (seen.has(mapped)) return;
    seen.add(mapped);
    indexToCanonical.set(idx, mapped);
  });

  return { indexToCanonical, taxColumnsIgnored, unknownHeaders };
}

function rowFromCells(
  cells: string[],
  indexToCanonical: Map<number, MenuImportCanonicalColumn>,
  rowNumber: number,
): { row?: NormalizedMenuImportRow; error?: MenuImportRowErrorDraft; warnings: MenuImportWarning[] } {
  const warnings: MenuImportWarning[] = [];
  const rawGet = (col: MenuImportCanonicalColumn) => {
    for (const [idx, name] of indexToCanonical) {
      if (name === col) return String(cells[idx] ?? "").trim();
    }
    return "";
  };

  const categoryRaw = rawGet("category");
  const productNameRaw = rawGet("product_name");
  const descriptionRaw = rawGet("description");
  const priceRaw = rawGet("price");
  const currencyRaw = rawGet("currency") || "TRY";
  const activeRaw = rawGet("active");
  const inStockRaw = rawGet("in_stock");
  const modifierGroupRaw = rawGet("modifier_group");
  const modifierOptionRaw = rawGet("modifier_option");
  const modifierPriceDeltaRaw = rawGet("modifier_price_delta");
  const selectionTypeRaw = rawGet("selection_type").toUpperCase();
  const minSelectRaw = rawGet("min_select");
  const maxSelectRaw = rawGet("max_select");

  // Skip fully empty rows
  if (
    !categoryRaw &&
    !productNameRaw &&
    !priceRaw &&
    !modifierGroupRaw &&
    !modifierOptionRaw &&
    !descriptionRaw
  ) {
    return { warnings };
  }

  const textFields: Array<{ label: string; value: string }> = [
    { label: "category", value: categoryRaw },
    { label: "product_name", value: productNameRaw },
    { label: "description", value: descriptionRaw },
    { label: "modifier_group", value: modifierGroupRaw },
    { label: "modifier_option", value: modifierOptionRaw },
  ];
  for (const field of textFields) {
    if (field.value && isFormulaInjection(field.value)) {
      return {
        error: {
          rowNumber,
          errorCode: "FORMULA_INJECTION",
          message: `Formül/CSV injection kabul edilmez (${field.label}).`,
          safeContextJson: { field: field.label },
        },
        warnings,
      };
    }
  }

  const category = categoryRaw;
  const productName = productNameRaw;
  const modifierGroup = modifierGroupRaw || null;
  const modifierOption = modifierOptionRaw || null;

  if (!category) {
    return {
      error: {
        rowNumber,
        errorCode: "CATEGORY_REQUIRED",
        message: "Kategori zorunludur.",
        safeContextJson: { productName: productName.slice(0, 80) || null },
      },
      warnings,
    };
  }
  if (!productName) {
    return {
      error: {
        rowNumber,
        errorCode: "PRODUCT_NAME_REQUIRED",
        message: "Ürün adı zorunludur.",
        safeContextJson: { category: category.slice(0, 80) },
      },
      warnings,
    };
  }

  const currency = currencyRaw.toUpperCase().slice(0, 8) || "TRY";
  if (currency !== "TRY") {
    return {
      error: {
        rowNumber,
        errorCode: "CURRENCY_UNSUPPORTED",
        message: `Para birimi yalnızca TRY olabilir (gelen: ${currency.slice(0, 8)}).`,
        safeContextJson: { currency: currency.slice(0, 8) },
      },
      warnings,
    };
  }

  const price = normalizeTryPrice(priceRaw);
  if (!price.ok) {
    return {
      error: {
        rowNumber,
        errorCode: price.code,
        message: price.message,
        safeContextJson: { category: category.slice(0, 40), productName: productName.slice(0, 40) },
      },
      warnings,
    };
  }

  let modifierPriceDelta: string | null = null;
  if (modifierPriceDeltaRaw) {
    const delta = normalizeTryPrice(modifierPriceDeltaRaw);
    if (!delta.ok) {
      return {
        error: {
          rowNumber,
          errorCode: "MODIFIER_PRICE_INVALID",
          message: delta.message,
          safeContextJson: { modifierOption: (modifierOption ?? "").slice(0, 40) },
        },
        warnings,
      };
    }
    modifierPriceDelta = delta.value;
  }

  let selectionType: "SINGLE" | "MULTI" | null = null;
  if (selectionTypeRaw) {
    if (selectionTypeRaw === "SINGLE" || selectionTypeRaw === "TEK") selectionType = "SINGLE";
    else if (selectionTypeRaw === "MULTI" || selectionTypeRaw === "COKLU" || selectionTypeRaw === "ÇOKLU") {
      selectionType = "MULTI";
    } else {
      return {
        error: {
          rowNumber,
          errorCode: "SELECTION_TYPE_INVALID",
          message: "Seçim türü SINGLE veya MULTI olmalı.",
          safeContextJson: { selectionType: selectionTypeRaw.slice(0, 20) },
        },
        warnings,
      };
    }
  }

  const minSelect: number | null = minSelectRaw ? Number(minSelectRaw) : null;
  const maxSelect: number | null = maxSelectRaw ? Number(maxSelectRaw) : null;
  if (minSelectRaw && (!Number.isInteger(minSelect) || (minSelect as number) < 0)) {
    return {
      error: {
        rowNumber,
        errorCode: "MIN_SELECT_INVALID",
        message: "min_secim geçersiz.",
      },
      warnings,
    };
  }
  if (maxSelectRaw && (!Number.isInteger(maxSelect) || (maxSelect as number) < 1)) {
    return {
      error: {
        rowNumber,
        errorCode: "MAX_SELECT_INVALID",
        message: "max_secim geçersiz.",
      },
      warnings,
    };
  }

  return {
    row: {
      rowNumber,
      category: category.slice(0, 120),
      productName: productName.slice(0, 160),
      description: descriptionRaw ? descriptionRaw.slice(0, 500) : null,
      price: price.value,
      currency: "TRY",
      isActive: parseBool(activeRaw, true),
      inStock: parseBool(inStockRaw, true),
      modifierGroup: modifierGroup ? modifierGroup.slice(0, 120) : null,
      modifierOption: modifierOption ? modifierOption.slice(0, 120) : null,
      modifierPriceDelta,
      selectionType,
      minSelect,
      maxSelect,
    },
    warnings,
  };
}

function detectDelimiter(sample: string): "," | ";" {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function parseCsvBuffer(buffer: Buffer): string[][] {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text.slice(0, 4096));
  const records = parseCsv(text, {
    delimiter,
    relax_column_count: true,
    skip_empty_lines: false,
    bom: true,
    cast: false,
  }) as string[][];
  return records.map((r) => r.map((c) => String(c ?? "")));
}

async function parseXlsxBuffer(buffer: Buffer): Promise<string[][]> {
  try {
    // Declared uncompressed sizes / entry count / ratio — before any inflate.
    assertSafeXlsxZip(buffer);
    return await parseXlsxWorksheetMatrix(buffer);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "XLSX okunamadı.";
    if (name === "XLSX_ZIP_BOMB" || message.startsWith("XLSX_ZIP_BOMB")) {
      throw new MenuImportParseError("XLSX_ZIP_BOMB", "XLSX zip-bomb / sıkıştırma oranı reddedildi.");
    }
    if (name === "XLSX_CELL_LIMIT" || message.startsWith("XLSX_CELL_LIMIT")) {
      throw new MenuImportParseError("XLSX_CELL_LIMIT", "XLSX satır/sütun sınırı aşıldı.");
    }
    if (name === "XLSX_TOO_LARGE" || message.startsWith("XLSX_TOO_LARGE")) {
      throw new MenuImportParseError("XLSX_TOO_LARGE", "XLSX dosyası güvenlik sınırını aşıyor.");
    }
    if (name === "XLSX_FORMULA_REJECTED" || /formula/i.test(message)) {
      throw new MenuImportParseError("XLSX_FORMULA_REJECTED", "Formül hücreleri kabul edilmez.");
    }
    if (error instanceof MenuImportParseError) throw error;
    throw new MenuImportParseError("XLSX_INVALID", message.slice(0, 200));
  }
}

function normalizeMatrix(
  matrix: string[][],
  fileMeta: { checksum: string; contentType: string; byteSize: number; originalFileName: string },
): MenuImportParseResult {
  if (matrix.length === 0) {
    throw new MenuImportParseError("EMPTY_FILE", "Dosya boş.");
  }

  const headerRow = matrix[0]!;
  const { indexToCanonical, taxColumnsIgnored, unknownHeaders } = mapHeaders(headerRow);

  if (!indexToCanonical.size) {
    throw new MenuImportParseError("HEADER_REQUIRED", "Geçerli başlık satırı bulunamadı.");
  }
  const hasCategory = [...indexToCanonical.values()].includes("category");
  const hasProduct = [...indexToCanonical.values()].includes("product_name");
  const hasPrice = [...indexToCanonical.values()].includes("price");
  if (!hasCategory || !hasProduct || !hasPrice) {
    throw new MenuImportParseError(
      "HEADER_INCOMPLETE",
      "Zorunlu kolonlar: kategori, ürün adı, fiyat (veya İngilizce eşleri).",
    );
  }

  const warnings: MenuImportWarning[] = [];
  if (taxColumnsIgnored > 0) {
    warnings.push({
      code: "TAX_COLUMN_IGNORED",
      message: "KDV/vergi kolonları yok sayıldı (taxEnabled=false).",
    });
  }
  for (const h of unknownHeaders.slice(0, 10)) {
    warnings.push({ code: "UNKNOWN_HEADER", message: `Bilinmeyen kolon yok sayıldı: ${h.slice(0, 40)}` });
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > MENU_IMPORT_MAX_DATA_ROWS) {
    throw new MenuImportParseError(
      "ROW_LIMIT",
      `En fazla ${MENU_IMPORT_MAX_DATA_ROWS} veri satırı desteklenir.`,
    );
  }

  const rows: NormalizedMenuImportRow[] = [];
  const errors: MenuImportRowErrorDraft[] = [];
  const errorRowNumbers = new Set<number>();

  dataRows.forEach((cells, idx) => {
    const rowNumber = idx + 2; // 1-based file row (header = 1)
    const result = rowFromCells(cells, indexToCanonical, rowNumber);
    warnings.push(...result.warnings);
    if (result.error) {
      errors.push(result.error);
      errorRowNumbers.add(rowNumber);
      return;
    }
    if (result.row) rows.push(result.row);
  });

  for (const conflict of findModifierGroupRuleConflicts(rows)) {
    errors.push(conflict);
    errorRowNumbers.add(conflict.rowNumber);
  }

  // Drop rows that participate in modifier rule conflicts from valid staging.
  const conflictRows = new Set(
    errors.filter((e) => e.errorCode === "MODIFIER_RULE_CONFLICT").map((e) => e.rowNumber),
  );
  const validRows = rows.filter((r) => !conflictRows.has(r.rowNumber));

  return {
    ...fileMeta,
    rows: validRows,
    errors,
    warnings,
    totalRows: dataRows.filter((r) => r.some((c) => String(c).trim())).length,
    validRows: validRows.length,
    errorRows: errorRowNumbers.size,
  };
}

export async function parseMenuImportFile(input: {
  buffer: Buffer;
  originalFileName: string;
}): Promise<MenuImportParseResult> {
  const byteSize = input.buffer.length;
  if (byteSize <= 0) {
    throw new MenuImportParseError("EMPTY_FILE", "Dosya boş.");
  }
  if (byteSize > MENU_IMPORT_MAX_BYTES) {
    throw new MenuImportParseError("FILE_TOO_LARGE", "Dosya en fazla 2 MB olabilir.");
  }

  const safeName = input.originalFileName.replace(/[^\w.\-ığüşöçİĞÜŞÖÇ ]+/gi, "_").slice(0, 180);
  const sniffed = sniffContent(input.buffer, safeName);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  const matrix =
    sniffed.kind === "csv" ? parseCsvBuffer(input.buffer) : await parseXlsxBuffer(input.buffer);

  return normalizeMatrix(matrix, {
    checksum,
    contentType: sniffed.contentType,
    byteSize,
    originalFileName: safeName || "menu.csv",
  });
}

export function buildSampleCsv(): string {
  const header = MENU_IMPORT_CANONICAL_COLUMNS.join(",");
  const rows = [
    "Icecekler,Cay,Demlik cay,45.00,TRY,true,true,,,,,,",
    "Icecekler,Kahve,Turk kahvesi,80.00,TRY,true,true,Boyut,Buyuk,10.00,SINGLE,0,1",
    "Ana Yemek,Adana Kebap,Acili,320.50,TRY,1,1,,,,,,",
  ];
  return `\uFEFF${header}\n${rows.join("\n")}\n`;
}

export function buildSampleXlsx(): Buffer {
  const header = [...MENU_IMPORT_CANONICAL_COLUMNS];
  return buildMinimalMenuImportXlsx([
    header,
    ["Icecekler", "Cay", "Demlik cay", "45.00", "TRY", "true", "true", "", "", "", "", "", ""],
    [
      "Icecekler",
      "Kahve",
      "Turk kahvesi",
      "80.00",
      "TRY",
      "true",
      "true",
      "Boyut",
      "Buyuk",
      "10.00",
      "SINGLE",
      "0",
      "1",
    ],
  ]);
}

/** Detect conflicting modifier group rules across staging rows (dry-run). */
export function findModifierGroupRuleConflicts(
  rows: NormalizedMenuImportRow[],
): MenuImportRowErrorDraft[] {
  type Rule = {
    selectionType: "SINGLE" | "MULTI" | null;
    minSelect: number | null;
    maxSelect: number | null;
    rowNumber: number;
  };
  const byGroup = new Map<string, Rule>();
  const errors: MenuImportRowErrorDraft[] = [];

  for (const row of rows) {
    if (!row.modifierGroup) continue;
    const key = row.modifierGroup.trim().toLocaleLowerCase("tr-TR");
    const next: Rule = {
      selectionType: row.selectionType,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      rowNumber: row.rowNumber,
    };
    const prev = byGroup.get(key);
    if (!prev) {
      byGroup.set(key, next);
      continue;
    }
    const conflict =
      (next.selectionType != null &&
        prev.selectionType != null &&
        next.selectionType !== prev.selectionType) ||
      (next.minSelect != null && prev.minSelect != null && next.minSelect !== prev.minSelect) ||
      (next.maxSelect != null && prev.maxSelect != null && next.maxSelect !== prev.maxSelect);
    if (conflict) {
      errors.push({
        rowNumber: row.rowNumber,
        errorCode: "MODIFIER_RULE_CONFLICT",
        message: `Seçenek grubu kuralları çelişiyor: ${row.modifierGroup.slice(0, 60)}`,
        safeContextJson: { modifierGroup: row.modifierGroup.slice(0, 60) },
      });
    } else {
      byGroup.set(key, {
        selectionType: next.selectionType ?? prev.selectionType,
        minSelect: next.minSelect ?? prev.minSelect,
        maxSelect: next.maxSelect ?? prev.maxSelect,
        rowNumber: prev.rowNumber,
      });
    }
  }
  return errors;
}

export function productKey(category: string, productName: string): string {
  return `${category.trim().toLocaleLowerCase("tr-TR")}::${productName.trim().toLocaleLowerCase("tr-TR")}`;
}

export type MenuImportDryRunPreview = {
  totalRows: number;
  categoriesToCreate: number;
  productsToCreate: number;
  productsToUpdate: number;
  modifierGroups: number;
  modifierOptions: number;
  warningCount: number;
  errorCount: number;
  productLimit: number | null;
  productsUsed: number;
  productsAfter: number;
  remainingAfter: number | null;
  wouldExceedLimit: boolean;
};
