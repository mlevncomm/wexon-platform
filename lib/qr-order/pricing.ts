import type { QrCartLine, QrProduct } from "@/lib/qr-order/types";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Catalog unit price only — no client-side modifier deltas. */
export function lineUnitPrice(line: QrCartLine) {
  return roundMoney(line.product.price);
}

export function lineTotal(line: QrCartLine) {
  return roundMoney(lineUnitPrice(line) * line.quantity);
}

export function cartSubtotal(lines: QrCartLine[]) {
  return roundMoney(lines.reduce((sum, line) => sum + lineTotal(line), 0));
}

export function cartItemCount(lines: QrCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function buildCartLineKey(productId: string, note: string) {
  return `${productId}::${note.trim().toLowerCase()}`;
}

export function buildOrderNote(lines: QrCartLine[], generalNote: string) {
  const lineNotes = lines
    .map((line) => {
      const note = line.note.trim();
      if (!note) return null;
      return `${line.product.name}: ${note}`;
    })
    .filter(Boolean) as string[];

  const general = generalNote.trim();
  const chunks = [...lineNotes];
  if (general) chunks.push(`Sipariş notu: ${general}`);
  return chunks.length > 0 ? chunks.join(" | ") : null;
}

export function withPopularFlag(product: QrProduct): QrProduct {
  return product;
}
