import { cartStorageKey } from "@/lib/qr-order/format";
import type { QrCartLine } from "@/lib/qr-order/types";

export { cartStorageKey };

function isCartLine(value: unknown): value is QrCartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as QrCartLine;
  return (
    typeof line.key === "string" &&
    typeof line.quantity === "number" &&
    line.quantity > 0 &&
    line.product != null &&
    typeof line.product.id === "string" &&
    typeof line.product.price === "number"
  );
}

export function readCartFromStorage(qrCode: string): QrCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cartStorageKey(qrCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

export function writeCartToStorage(qrCode: string, lines: QrCartLine[]) {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) {
      window.localStorage.removeItem(cartStorageKey(qrCode));
      return;
    }
    window.localStorage.setItem(cartStorageKey(qrCode), JSON.stringify(lines));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearCartStorage(qrCode: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cartStorageKey(qrCode));
  } catch {
    // ignore
  }
}

export function upsertCartLine(lines: QrCartLine[], next: QrCartLine): QrCartLine[] {
  const index = lines.findIndex((line) => line.key === next.key);
  if (next.quantity <= 0) {
    return lines.filter((line) => line.key !== next.key);
  }
  if (index === -1) return [...lines, next];
  const copy = [...lines];
  copy[index] = next;
  return copy;
}

export function setCartLineQuantity(lines: QrCartLine[], key: string, quantity: number): QrCartLine[] {
  if (quantity <= 0) return lines.filter((line) => line.key !== key);
  return lines.map((line) => (line.key === key ? { ...line, quantity } : line));
}
