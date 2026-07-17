import QRCode from "qrcode";
import { buildTableQrDownloadBasename } from "@/lib/wexpay-public-table-url";

export const TABLE_QR_ERROR_CORRECTION = "H" as const;
export const TABLE_QR_PNG_SIZE = 1200;
export const TABLE_QR_PREVIEW_SIZE = 280;
export const TABLE_QR_MARGIN = 4;

const QR_OPTIONS = {
  errorCorrectionLevel: TABLE_QR_ERROR_CORRECTION,
  margin: TABLE_QR_MARGIN,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export async function generateTableQrDataUrl(publicUrl: string, width = TABLE_QR_PREVIEW_SIZE): Promise<string> {
  return QRCode.toDataURL(publicUrl, { ...QR_OPTIONS, width, type: "image/png" });
}

export async function generateTableQrPngDataUrl(publicUrl: string): Promise<string> {
  return generateTableQrDataUrl(publicUrl, TABLE_QR_PNG_SIZE);
}

export async function generateTableQrSvg(publicUrl: string): Promise<string> {
  const svg = await QRCode.toString(publicUrl, {
    ...QR_OPTIONS,
    type: "svg",
    width: TABLE_QR_PNG_SIZE,
  });
  return sanitizeTableQrSvg(svg);
}

/** Strip accidental external refs / scripts from SVG output. */
export function sanitizeTableQrSvg(svg: string): string {
  let next = svg.trim();
  if (!next.startsWith("<svg")) {
    throw new Error("QR SVG çıktısı geçersiz.");
  }
  next = next.replace(/<script[\s\S]*?<\/script>/gi, "");
  next = next.replace(/\s(?:href|xlink:href)=["']https?:[^"']*["']/gi, "");
  next = next.replace(/@import/gi, "");
  return next;
}

export function assertSafeTableQrSvg(svg: string): void {
  if (!svg.includes("<svg")) throw new Error("SVG root missing");
  if (/<script\b/i.test(svg)) throw new Error("SVG must not include script");
  if (/<(?:image|foreignObject)\b/i.test(svg)) {
    throw new Error("SVG must not include external image references");
  }
  if (/\shref=["'](?!#|mailto:)/i.test(svg) || /\sxlink:href=["'](?!#)/i.test(svg)) {
    throw new Error("SVG must not include external href");
  }
}

export function buildTableQrFilenames(label: string) {
  const base = buildTableQrDownloadBasename(label);
  return { png: `${base}.png`, svg: `${base}.svg` };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTableQrPrintHtml(input: {
  tableLabel: string;
  publicUrl: string;
  qrDataUrl: string;
}): string {
  const label = escapeHtml(input.tableLabel);
  const url = escapeHtml(input.publicUrl);
  const src = escapeHtml(input.qrDataUrl);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${label} QR</title>
  <style>
    body { margin: 0; padding: 32px; font-family: system-ui, sans-serif; background: #fff; color: #000; text-align: center; }
    img { width: 320px; height: 320px; image-rendering: pixelated; }
    h1 { font-size: 22px; margin: 16px 0 8px; }
    p { font-size: 14px; margin: 8px 0; }
    .url { font-size: 12px; word-break: break-all; color: #222; }
  </style>
</head>
<body>
  <img src="${src}" width="320" height="320" alt="QR kod" />
  <h1>${label}</h1>
  <p>Menüyü görmek ve sipariş vermek için QR kodu okutun</p>
  <p class="url">${url}</p>
</body>
</html>`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("Clipboard kullanılamıyor.");
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Link kopyalanamadı.");
}

export function triggerBlobDownload(blob: Blob, filename: string): () => void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return () => URL.revokeObjectURL(objectUrl);
}

export async function downloadTableQrPng(publicUrl: string, label: string): Promise<() => void> {
  const dataUrl = await generateTableQrPngDataUrl(publicUrl);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("PNG data URL geçersiz.");
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return triggerBlobDownload(blob, buildTableQrFilenames(label).png);
}

export async function downloadTableQrSvg(publicUrl: string, label: string): Promise<() => void> {
  const svg = await generateTableQrSvg(publicUrl);
  assertSafeTableQrSvg(svg);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return triggerBlobDownload(blob, buildTableQrFilenames(label).svg);
}
