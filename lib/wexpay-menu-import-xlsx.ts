import { inflateRaw } from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export const MENU_IMPORT_XLSX_MAX_ENTRIES = 64;
export const MENU_IMPORT_XLSX_MAX_INFLATED_BYTES = 12 * 1024 * 1024;
export const MENU_IMPORT_XLSX_MAX_MATRIX_ROWS = 2005;
export const MENU_IMPORT_XLSX_MAX_MATRIX_COLS = 64;

const MAX_RATIO = 100;
const RATIO_MIN_UNCOMPRESSED = 64 * 1024;

const COMPRESSION_STORE = 0;
const COMPRESSION_DEFLATE = 8;

const GPBF_ENCRYPTED = 0x0001;
const GPBF_DATA_DESCRIPTOR = 0x0008;

const textDecoder = new TextDecoder("utf-8", { fatal: false });

type ZipCentralEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type InflateBudget = {
  used: number;
  limit: number;
};

type ZipErrorCode =
  | "XLSX_ZIP_BOMB"
  | "XLSX_TOO_LARGE"
  | "XLSX_INVALID_ZIP"
  | "XLSX_CELL_LIMIT";

function zipError(code: ZipErrorCode, detail?: string): Error {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.name = code;
  return err;
}

/**
 * Inflates raw deflate data with a hard output ceiling.
 * Never use declared ZIP uncompressedSize as the sole output bound.
 */
export function inflateRawBounded(
  compressed: Buffer,
  maxOutputLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    inflateRaw(compressed, { maxOutputLength }, (err, result) => {
      if (err) {
        const msg = err.message ?? "";
        if (
          /maxOutputLength|too large|Maximum output length|ERR_BUFFER_TOO_LARGE/i.test(
            msg,
          ) ||
          (err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE"
        ) {
          reject(zipError("XLSX_TOO_LARGE", "inflated output exceeds bound"));
          return;
        }
        reject(zipError("XLSX_INVALID_ZIP", "deflate failed"));
        return;
      }
      resolve(result as Buffer);
    });
  });
}

function readUInt16LE(buf: Buffer, offset: number): number {
  if (offset + 2 > buf.length) throw zipError("XLSX_INVALID_ZIP", "truncated read");
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) throw zipError("XLSX_INVALID_ZIP", "truncated read");
  return buf.readUInt32LE(offset);
}

function findEocdOffset(buffer: Buffer): number {
  // EOCD is at least 22 bytes; comment can be up to 65535 bytes.
  const minSize = 22;
  if (buffer.length < minSize) throw zipError("XLSX_INVALID_ZIP", "buffer too small");

  const scanStart = Math.max(0, buffer.length - (minSize + 0xffff));
  for (let i = buffer.length - minSize; i >= scanStart; i--) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) {
      const commentLen = readUInt16LE(buffer, i + 20);
      if (i + minSize + commentLen === buffer.length) return i;
      // Tolerate trailing junk only when comment length matches remaining bytes.
      if (i + minSize + commentLen <= buffer.length) return i;
    }
  }
  throw zipError("XLSX_INVALID_ZIP", "EOCD not found");
}

function parseCentralDirectory(buffer: Buffer): ZipCentralEntry[] {
  const eocdOffset = findEocdOffset(buffer);
  const totalEntries = readUInt16LE(buffer, eocdOffset + 10);
  const centralSize = readUInt32LE(buffer, eocdOffset + 12);
  const centralOffset = readUInt32LE(buffer, eocdOffset + 16);

  if (totalEntries > MENU_IMPORT_XLSX_MAX_ENTRIES) {
    throw zipError(
      "XLSX_ZIP_BOMB",
      `entry count ${totalEntries} exceeds ${MENU_IMPORT_XLSX_MAX_ENTRIES}`,
    );
  }

  if (centralOffset + centralSize > buffer.length) {
    throw zipError("XLSX_INVALID_ZIP", "central directory out of bounds");
  }

  const entries: ZipCentralEntry[] = [];
  let offset = centralOffset;
  const end = centralOffset + centralSize;
  let uncompressedSum = 0;

  while (offset < end && entries.length < totalEntries) {
    if (readUInt32LE(buffer, offset) !== SIG_CENTRAL) {
      throw zipError("XLSX_INVALID_ZIP", "bad central directory signature");
    }

    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLen = readUInt16LE(buffer, offset + 28);
    const extraLen = readUInt16LE(buffer, offset + 30);
    const commentLen = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);

    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLen;
    if (nameEnd + extraLen + commentLen > buffer.length) {
      throw zipError("XLSX_INVALID_ZIP", "central entry out of bounds");
    }

    const fileName = buffer.subarray(nameStart, nameEnd).toString("utf8");
    if (!fileName || fileName.includes("..") || fileName.startsWith("/") || fileName.includes("\\")) {
      throw zipError("XLSX_INVALID_ZIP", "unsafe entry path");
    }

    if (compressionMethod !== COMPRESSION_STORE && compressionMethod !== COMPRESSION_DEFLATE) {
      throw zipError("XLSX_INVALID_ZIP", `unsupported compression method ${compressionMethod}`);
    }

    if (uncompressedSize > MENU_IMPORT_XLSX_MAX_INFLATED_BYTES) {
      throw zipError("XLSX_TOO_LARGE", `entry ${fileName} uncompressed size exceeds limit`);
    }

    uncompressedSum += uncompressedSize;
    if (uncompressedSum > MENU_IMPORT_XLSX_MAX_INFLATED_BYTES) {
      throw zipError("XLSX_TOO_LARGE", "total uncompressed size exceeds limit");
    }

    if (
      compressedSize > 0 &&
      uncompressedSize > RATIO_MIN_UNCOMPRESSED &&
      uncompressedSize / compressedSize > MAX_RATIO
    ) {
      throw zipError("XLSX_ZIP_BOMB", `suspicious compression ratio for ${fileName}`);
    }

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = nameEnd + extraLen + commentLen;
  }

  if (entries.length !== totalEntries) {
    throw zipError("XLSX_INVALID_ZIP", "central directory entry count mismatch");
  }

  return entries;
}

/**
 * Validates ZIP structure and applies zip-bomb / size guards for XLSX uploads.
 * Throws Error whose name/message uses XLSX_ZIP_BOMB | XLSX_TOO_LARGE | XLSX_INVALID_ZIP.
 */
export function assertSafeXlsxZip(buffer: Buffer): void {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw zipError("XLSX_INVALID_ZIP", "empty buffer");
  }
  parseCentralDirectory(buffer);
}

async function readZipEntry(
  buffer: Buffer,
  entry: ZipCentralEntry,
  budget: InflateBudget,
): Promise<Buffer> {
  const { localHeaderOffset: off } = entry;
  if (off + 30 > buffer.length) throw zipError("XLSX_INVALID_ZIP", "local header out of bounds");
  if (readUInt32LE(buffer, off) !== SIG_LOCAL) {
    throw zipError("XLSX_INVALID_ZIP", "bad local header signature");
  }

  const gpbf = readUInt16LE(buffer, off + 6);
  if (gpbf & GPBF_ENCRYPTED) {
    throw zipError("XLSX_INVALID_ZIP", "encrypted entries are not allowed");
  }

  const localMethod = readUInt16LE(buffer, off + 8);
  if (localMethod !== entry.compressionMethod) {
    throw zipError("XLSX_INVALID_ZIP", "local compression method mismatch");
  }

  const localCompressedSize = readUInt32LE(buffer, off + 18);
  const localUncompressedSize = readUInt32LE(buffer, off + 22);
  const hasDataDescriptor = (gpbf & GPBF_DATA_DESCRIPTOR) !== 0;

  if (hasDataDescriptor) {
    if (localCompressedSize !== 0 || localUncompressedSize !== 0) {
      throw zipError(
        "XLSX_INVALID_ZIP",
        "data descriptor flag set but local sizes are non-zero",
      );
    }
  } else if (
    localCompressedSize !== entry.compressedSize ||
    localUncompressedSize !== entry.uncompressedSize
  ) {
    throw zipError("XLSX_INVALID_ZIP", "local sizes do not match central directory");
  }

  const nameLen = readUInt16LE(buffer, off + 26);
  const extraLen = readUInt16LE(buffer, off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) throw zipError("XLSX_INVALID_ZIP", "compressed data out of bounds");

  const compressed = buffer.subarray(dataStart, dataEnd);
  const remaining = budget.limit - budget.used;
  if (remaining <= 0) {
    throw zipError("XLSX_TOO_LARGE", "inflate budget exhausted");
  }

  if (entry.compressionMethod === COMPRESSION_STORE) {
    if (compressed.length > remaining) {
      throw zipError("XLSX_TOO_LARGE", "stored entry exceeds inflate budget");
    }
    budget.used += compressed.length;
    return compressed;
  }

  if (entry.compressionMethod === COMPRESSION_DEFLATE) {
    const hardCap = Math.min(MENU_IMPORT_XLSX_MAX_INFLATED_BYTES, remaining);
    const inflated = await inflateRawBounded(compressed, hardCap);
    budget.used += inflated.length;
    return inflated;
  }

  throw zipError("XLSX_INVALID_ZIP", `unsupported compression method ${entry.compressionMethod}`);
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function findEntry(entries: ZipCentralEntry[], logicalPath: string): ZipCentralEntry | undefined {
  const target = normalizeZipPath(logicalPath);
  return entries.find((e) => normalizeZipPath(e.fileName) === target);
}

function decodeXml(buf: Buffer): string {
  return textDecoder.decode(buf);
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  // Match each <si>...</si> block (non-greedy, including nested rich-text runs).
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRe.exec(xml)) !== null) {
    const body = siMatch[1] ?? "";
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRe.exec(body)) !== null) {
      parts.push(unescapeXml(tMatch[1] ?? ""));
    }
    strings.push(parts.join(""));
  }
  return strings;
}

export function colLettersToIndex(col: string): number {
  if (col.length === 0 || col.length > 3) {
    throw zipError("XLSX_CELL_LIMIT", "column letters length exceeds 3");
  }
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    const c = col.charCodeAt(i);
    if (c < 65 || c > 90) throw zipError("XLSX_INVALID_ZIP", "bad cell reference");
    n = n * 26 + (c - 64);
  }
  const index = n - 1;
  if (index >= MENU_IMPORT_XLSX_MAX_MATRIX_COLS) {
    throw zipError("XLSX_CELL_LIMIT", `column ${col} exceeds matrix column limit`);
  }
  return index;
}

export function parseCellRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) throw zipError("XLSX_INVALID_ZIP", "bad cell reference");
  const col = colLettersToIndex(m[1]!);
  const row = Number(m[2]) - 1;
  if (!Number.isFinite(row) || row < 0) {
    throw zipError("XLSX_INVALID_ZIP", "bad cell reference");
  }
  if (row >= MENU_IMPORT_XLSX_MAX_MATRIX_ROWS) {
    throw zipError("XLSX_CELL_LIMIT", `row exceeds matrix row limit`);
  }
  return { col, row };
}

function indexToColLetters(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function extractAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const m = re.exec(tag);
  return m?.[1];
}

function cellValueFromXml(
  cellInner: string,
  cellType: string | undefined,
  sharedStrings: string[],
): string {
  if (cellType === "inlineStr") {
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRe.exec(cellInner)) !== null) {
      parts.push(unescapeXml(tMatch[1] ?? ""));
    }
    return parts.join("");
  }

  const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellInner);
  const raw = vMatch ? unescapeXml(vMatch[1] ?? "") : "";

  if (cellType === "s") {
    const idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= sharedStrings.length) {
      throw zipError("XLSX_INVALID_ZIP", "bad shared string index");
    }
    return sharedStrings[idx] ?? "";
  }

  if (cellType === "b") {
    return raw === "1" || raw.toLowerCase() === "true" ? "TRUE" : "FALSE";
  }

  // Numeric, str, or untyped — return literal string form.
  return raw;
}

function assertDimensionWithinLimits(sheetXml: string): void {
  const dimMatch = /<dimension\b[^>]*\bref="([^"]+)"/i.exec(sheetXml);
  if (!dimMatch) return;

  const dimRef = dimMatch[1]!;
  const parts = dimRef.split(":");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Dimension refs are cell addresses like A1 or AA2005.
    if (/^[A-Za-z]+\d+$/.test(trimmed)) {
      parseCellRef(trimmed);
    }
  }
}

function parseWorksheetMatrix(sheetXml: string, sharedStrings: string[]): string[][] {
  if (/<f\b[\s/>]/i.test(sheetXml)) {
    const err = new Error("XLSX_FORMULA_REJECTED: formula cells are not allowed");
    err.name = "XLSX_FORMULA_REJECTED";
    throw err;
  }

  assertDimensionWithinLimits(sheetXml);

  const sheetDataMatch = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/i.exec(sheetXml);
  const sheetData = sheetDataMatch?.[1] ?? "";

  let maxRow = -1;
  let maxCol = -1;
  const sparse = new Map<string, string>();

  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheetData)) !== null) {
    const rowAttrs = rowMatch[1] ?? "";
    const rowInner = rowMatch[2] ?? "";
    const rowAttrNum = extractAttr(rowAttrs, "r");

    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowInner)) !== null) {
      const cellAttrs = cellMatch[1] ?? "";
      const cellInner = cellMatch[2] ?? "";
      const ref = extractAttr(cellAttrs, "r");
      if (!ref) continue;

      const { row, col } = parseCellRef(ref);
      if (rowAttrNum != null && Number(rowAttrNum) - 1 !== row) {
        // Prefer explicit cell ref when present.
      }

      const t = extractAttr(cellAttrs, "t");
      const value = cellValueFromXml(cellInner, t, sharedStrings);
      sparse.set(`${row}:${col}`, value);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
  }

  if (maxRow < 0) return [];

  if (maxRow + 1 > MENU_IMPORT_XLSX_MAX_MATRIX_ROWS) {
    throw zipError("XLSX_CELL_LIMIT", `more than ${MENU_IMPORT_XLSX_MAX_MATRIX_ROWS} rows`);
  }
  if (maxCol + 1 > MENU_IMPORT_XLSX_MAX_MATRIX_COLS) {
    throw zipError("XLSX_CELL_LIMIT", `more than ${MENU_IMPORT_XLSX_MAX_MATRIX_COLS} columns`);
  }

  // Dense allocation only after dimension / cell-limit checks.
  const matrix: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      row.push(sparse.get(`${r}:${c}`) ?? "");
    }
    matrix.push(row);
  }
  return matrix;
}

async function resolveWorksheetEntry(
  buffer: Buffer,
  entries: ZipCentralEntry[],
  workbookXml: string,
  budget: InflateBudget,
): Promise<ZipCentralEntry> {
  const sheetMatch = /<sheet\b[^>]*>/i.exec(workbookXml);
  if (!sheetMatch) {
    const fallback = findEntry(entries, "xl/worksheets/sheet1.xml");
    if (fallback) return fallback;
    throw zipError("XLSX_INVALID_ZIP", "no worksheet found");
  }

  const sheetTag = sheetMatch[0];
  const rid = extractAttr(sheetTag, "r:id") ?? extractAttr(sheetTag, "id");

  if (rid) {
    const relsEntry = findEntry(entries, "xl/_rels/workbook.xml.rels");
    if (relsEntry) {
      const relsXml = decodeXml(await readZipEntry(buffer, relsEntry, budget));
      const relRe = /<Relationship\b[^>]*>/gi;
      let relMatch: RegExpExecArray | null;
      while ((relMatch = relRe.exec(relsXml)) !== null) {
        const tag = relMatch[0];
        if (extractAttr(tag, "Id") === rid) {
          let target = extractAttr(tag, "Target") ?? "";
          target = target.replace(/^\.\//, "");
          if (!target.toLowerCase().startsWith("worksheets/") && !target.toLowerCase().includes("/")) {
            target = `worksheets/${target}`;
          }
          const logical = target.toLowerCase().startsWith("xl/") ? target : `xl/${target}`;
          const entry = findEntry(entries, logical);
          if (entry) return entry;
        }
      }
    }
  }

  const fallback = findEntry(entries, "xl/worksheets/sheet1.xml");
  if (fallback) return fallback;
  throw zipError("XLSX_INVALID_ZIP", "worksheet target not found");
}

/**
 * Parses the first worksheet of an XLSX into a dense string matrix (used range).
 * Rejects formula cells (`<f>`). Caps rows/cols via MENU_IMPORT_XLSX_MAX_MATRIX_*.
 */
export async function parseXlsxWorksheetMatrix(buffer: Buffer): Promise<string[][]> {
  assertSafeXlsxZip(buffer);
  const entries = parseCentralDirectory(buffer);
  const budget: InflateBudget = {
    used: 0,
    limit: MENU_IMPORT_XLSX_MAX_INFLATED_BYTES,
  };

  const workbookEntry = findEntry(entries, "xl/workbook.xml");
  if (!workbookEntry) throw zipError("XLSX_INVALID_ZIP", "missing xl/workbook.xml");

  const workbookXml = decodeXml(await readZipEntry(buffer, workbookEntry, budget));

  // Optional content types — presence only; ignore parse failures.
  const contentTypes = findEntry(entries, "[Content_Types].xml");
  if (contentTypes) {
    await readZipEntry(buffer, contentTypes, budget);
  }

  let sharedStrings: string[] = [];
  const sstEntry = findEntry(entries, "xl/sharedStrings.xml");
  if (sstEntry) {
    sharedStrings = parseSharedStrings(decodeXml(await readZipEntry(buffer, sstEntry, budget)));
  }

  const sheetEntry = await resolveWorksheetEntry(buffer, entries, workbookXml, budget);
  const sheetXml = decodeXml(await readZipEntry(buffer, sheetEntry, budget));
  return parseWorksheetMatrix(sheetXml, sharedStrings);
}

// --- Minimal XLSX builder (store compression) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

type ZipWriteEntry = {
  fileName: string;
  data: Buffer;
};

function buildZipStore(files: ZipWriteEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.fileName, "utf8");
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(COMPRESSION_STORE, 8);
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra
    nameBuf.copy(local, 30);

    localParts.push(local, file.data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(COMPRESSION_STORE, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);

    offset += local.length + file.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function buildSheetXml(rows: string[][]): { sheetXml: string; sharedStrings: string[] } {
  const shared: string[] = [];
  const indexByValue = new Map<string, number>();

  function sstIndex(value: string): number {
    const existing = indexByValue.get(value);
    if (existing != null) return existing;
    const idx = shared.length;
    shared.push(value);
    indexByValue.set(value, idx);
    return idx;
  }

  const rowXml: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cells: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const text = row[c] ?? "";
      const ref = `${indexToColLetters(c)}${r + 1}`;
      if (text === "") {
        // Omit empty cells for a smaller template.
        continue;
      }
      const idx = sstIndex(text);
      cells.push(`<c r="${ref}" t="s"><v>${idx}</v></c>`);
    }
    if (cells.length === 0) continue;
    rowXml.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  }

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetData>${rowXml.join("")}</sheetData></worksheet>`;

  return { sheetXml, sharedStrings: shared };
}

function buildSharedStringsXml(strings: string[]): string {
  const items = strings
    .map((s) => {
      const needsPreserve = /^\s|\s$/.test(s) || s.includes("\n") || s.includes("\t");
      const t = needsPreserve
        ? `<t xml:space="preserve">${escapeXml(s)}</t>`
        : `<t>${escapeXml(s)}</t>`;
      return `<si>${t}</si>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`
  );
}

/**
 * Builds a minimal valid XLSX (ZIP store) with one worksheet containing `rows`.
 */
export function buildMinimalMenuImportXlsx(rows: string[][]): Buffer {
  const { sheetXml, sharedStrings } = buildSheetXml(rows);

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
    `</Relationships>`;

  const files: ZipWriteEntry[] = [
    { fileName: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { fileName: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { fileName: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
    { fileName: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels, "utf8") },
    { fileName: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") },
    { fileName: "xl/sharedStrings.xml", data: Buffer.from(buildSharedStringsXml(sharedStrings), "utf8") },
  ];

  return buildZipStore(files);
}
