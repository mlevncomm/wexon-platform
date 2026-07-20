import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";

const inflateRawAsync = promisify(inflateRaw);

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const MAX_ENTRIES = 64;
const MAX_UNCOMPRESSED_TOTAL = 12 * 1024 * 1024;
const MAX_UNCOMPRESSED_ENTRY = 12 * 1024 * 1024;
const MAX_RATIO = 100;
const RATIO_MIN_UNCOMPRESSED = 64 * 1024;
const MAX_MATRIX_ROWS = 2005;

const COMPRESSION_STORE = 0;
const COMPRESSION_DEFLATE = 8;

const textDecoder = new TextDecoder("utf-8", { fatal: false });

type ZipCentralEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function zipError(code: "XLSX_ZIP_BOMB" | "XLSX_TOO_LARGE" | "XLSX_INVALID_ZIP", detail?: string): Error {
  const err = new Error(detail ? `${code}: ${detail}` : code);
  err.name = code;
  return err;
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

  if (totalEntries > MAX_ENTRIES) {
    throw zipError("XLSX_ZIP_BOMB", `entry count ${totalEntries} exceeds ${MAX_ENTRIES}`);
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

    if (uncompressedSize > MAX_UNCOMPRESSED_ENTRY) {
      throw zipError("XLSX_TOO_LARGE", `entry ${fileName} uncompressed size exceeds limit`);
    }

    uncompressedSum += uncompressedSize;
    if (uncompressedSum > MAX_UNCOMPRESSED_TOTAL) {
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
 * Throws Error whose message starts with XLSX_ZIP_BOMB | XLSX_TOO_LARGE | XLSX_INVALID_ZIP.
 */
export function assertSafeXlsxZip(buffer: Buffer): void {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw zipError("XLSX_INVALID_ZIP", "empty buffer");
  }
  parseCentralDirectory(buffer);
}

async function inflateEntry(compressed: Buffer, method: number, expectedUncompressed: number): Promise<Buffer> {
  if (method === COMPRESSION_STORE) {
    if (compressed.length !== expectedUncompressed && expectedUncompressed > 0) {
      // Some writers leave sizes inconsistent; still cap by declared size when larger.
      if (compressed.length > MAX_UNCOMPRESSED_ENTRY) {
        throw zipError("XLSX_TOO_LARGE", "stored entry too large");
      }
    }
    return compressed;
  }

  if (method === COMPRESSION_DEFLATE) {
    let inflated: Buffer;
    try {
      inflated = await inflateRawAsync(compressed) as Buffer;
    } catch {
      throw zipError("XLSX_INVALID_ZIP", "deflate failed");
    }
    if (inflated.length > MAX_UNCOMPRESSED_ENTRY) {
      throw zipError("XLSX_TOO_LARGE", "inflated entry too large");
    }
    if (expectedUncompressed > 0 && inflated.length !== expectedUncompressed) {
      // Allow mismatch but still enforce absolute cap already checked.
    }
    return inflated;
  }

  throw zipError("XLSX_INVALID_ZIP", `unsupported compression method ${method}`);
}

async function readZipEntry(buffer: Buffer, entry: ZipCentralEntry): Promise<Buffer> {
  const { localHeaderOffset: off } = entry;
  if (off + 30 > buffer.length) throw zipError("XLSX_INVALID_ZIP", "local header out of bounds");
  if (readUInt32LE(buffer, off) !== SIG_LOCAL) {
    throw zipError("XLSX_INVALID_ZIP", "bad local header signature");
  }

  const nameLen = readUInt16LE(buffer, off + 26);
  const extraLen = readUInt16LE(buffer, off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) throw zipError("XLSX_INVALID_ZIP", "compressed data out of bounds");

  const compressed = buffer.subarray(dataStart, dataEnd);
  return inflateEntry(compressed, entry.compressionMethod, entry.uncompressedSize);
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

function colLettersToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    const c = col.charCodeAt(i);
    if (c < 65 || c > 90) throw new Error("XLSX_INVALID_ZIP: bad cell reference");
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function parseCellRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) throw new Error("XLSX_INVALID_ZIP: bad cell reference");
  return { col: colLettersToIndex(m[1]!), row: Number(m[2]) - 1 };
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
      throw new Error("XLSX_INVALID_ZIP: bad shared string index");
    }
    return sharedStrings[idx] ?? "";
  }

  if (cellType === "b") {
    return raw === "1" || raw.toLowerCase() === "true" ? "TRUE" : "FALSE";
  }

  // Numeric, str, or untyped — return literal string form.
  return raw;
}

function parseWorksheetMatrix(sheetXml: string, sharedStrings: string[]): string[][] {
  if (/<f\b[\s/>]/i.test(sheetXml)) {
    throw new Error("XLSX_FORMULA_REJECTED: formula cells are not allowed");
  }

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
      if (row >= MAX_MATRIX_ROWS) {
        throw new Error(`XLSX_TOO_LARGE: more than ${MAX_MATRIX_ROWS} rows`);
      }

      const t = extractAttr(cellAttrs, "t");
      const value = cellValueFromXml(cellInner, t, sharedStrings);
      sparse.set(`${row}:${col}`, value);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
  }

  if (maxRow < 0) return [];

  if (maxRow + 1 > MAX_MATRIX_ROWS) {
    throw new Error(`XLSX_TOO_LARGE: more than ${MAX_MATRIX_ROWS} rows`);
  }

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
): Promise<ZipCentralEntry> {
  const sheetMatch = /<sheet\b[^>]*>/i.exec(workbookXml);
  if (!sheetMatch) {
    const fallback = findEntry(entries, "xl/worksheets/sheet1.xml");
    if (fallback) return fallback;
    throw new Error("XLSX_INVALID_ZIP: no worksheet found");
  }

  const sheetTag = sheetMatch[0];
  const rid = extractAttr(sheetTag, "r:id") ?? extractAttr(sheetTag, "id");

  if (rid) {
    const relsEntry = findEntry(entries, "xl/_rels/workbook.xml.rels");
    if (relsEntry) {
      const relsXml = decodeXml(await readZipEntry(buffer, relsEntry));
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
  throw new Error("XLSX_INVALID_ZIP: worksheet target not found");
}

/**
 * Parses the first worksheet of an XLSX into a dense string matrix (used range).
 * Rejects formula cells (`<f>`). Caps at 2005 rows.
 */
export async function parseXlsxWorksheetMatrix(buffer: Buffer): Promise<string[][]> {
  assertSafeXlsxZip(buffer);
  const entries = parseCentralDirectory(buffer);

  const workbookEntry = findEntry(entries, "xl/workbook.xml");
  if (!workbookEntry) throw new Error("XLSX_INVALID_ZIP: missing xl/workbook.xml");

  const workbookXml = decodeXml(await readZipEntry(buffer, workbookEntry));

  // Optional content types — presence only; ignore parse failures.
  const contentTypes = findEntry(entries, "[Content_Types].xml");
  if (contentTypes) {
    await readZipEntry(buffer, contentTypes);
  }

  let sharedStrings: string[] = [];
  const sstEntry = findEntry(entries, "xl/sharedStrings.xml");
  if (sstEntry) {
    sharedStrings = parseSharedStrings(decodeXml(await readZipEntry(buffer, sstEntry)));
  }

  const sheetEntry = await resolveWorksheetEntry(buffer, entries, workbookXml);
  const sheetXml = decodeXml(await readZipEntry(buffer, sheetEntry));
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
