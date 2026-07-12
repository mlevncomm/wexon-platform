import type { QrCartLine, QrOptionGroup, QrProduct } from "@/lib/qr-order/types";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Display-only option deltas; server still charges catalog unit price. */
export function optionDeltaTotal(
  selectedOptions: Record<string, string[]>,
  groups: QrOptionGroup[],
): number {
  let delta = 0;
  for (const group of groups) {
    const selected = selectedOptions[group.id] ?? [];
    for (const choiceId of selected) {
      const choice = group.choices.find((item) => item.id === choiceId);
      if (choice?.priceDelta) delta += choice.priceDelta;
    }
  }
  return roundMoney(delta);
}

export function lineUnitPrice(line: QrCartLine, groups: QrOptionGroup[] = []) {
  return roundMoney(line.product.price + optionDeltaTotal(line.selectedOptions, groups));
}

export function lineTotal(line: QrCartLine, groups: QrOptionGroup[] = []) {
  return roundMoney(lineUnitPrice(line, groups) * line.quantity);
}

export function cartSubtotal(lines: QrCartLine[], groupsByProductId: Record<string, QrOptionGroup[]> = {}) {
  return roundMoney(
    lines.reduce((sum, line) => sum + lineTotal(line, groupsByProductId[line.product.id] ?? []), 0),
  );
}

export function cartItemCount(lines: QrCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function buildCartLineKey(
  productId: string,
  selectedOptions: Record<string, string[]>,
  note: string,
) {
  const optionsPart = Object.keys(selectedOptions)
    .sort()
    .map((groupId) => `${groupId}:${[...(selectedOptions[groupId] ?? [])].sort().join(",")}`)
    .join("|");
  return `${productId}::${optionsPart}::${note.trim().toLowerCase()}`;
}

export function describeSelectedOptions(
  selectedOptions: Record<string, string[]>,
  groups: QrOptionGroup[],
): string {
  const parts: string[] = [];
  for (const group of groups) {
    const selected = selectedOptions[group.id] ?? [];
    if (selected.length === 0) continue;
    const labels = selected
      .map((id) => group.choices.find((choice) => choice.id === id)?.label)
      .filter(Boolean);
    if (labels.length > 0) {
      parts.push(`${group.label}: ${labels.join(", ")}`);
    }
  }
  return parts.join("; ");
}

export function buildOrderNote(lines: QrCartLine[], groupsByProductId: Record<string, QrOptionGroup[]>, generalNote: string) {
  const lineNotes = lines
    .map((line) => {
      const groups = groupsByProductId[line.product.id] ?? [];
      const optionText = describeSelectedOptions(line.selectedOptions, groups);
      const bits = [optionText, line.note.trim()].filter(Boolean);
      if (bits.length === 0) return null;
      return `${line.product.name}: ${bits.join(" · ")}`;
    })
    .filter(Boolean) as string[];

  const general = generalNote.trim();
  const chunks = [...lineNotes];
  if (general) chunks.push(`Genel not: ${general}`);
  return chunks.length > 0 ? chunks.join(" | ") : null;
}

export function validateRequiredOptions(
  selectedOptions: Record<string, string[]>,
  groups: QrOptionGroup[],
): string | null {
  for (const group of groups) {
    if (!group.required) continue;
    const selected = selectedOptions[group.id] ?? [];
    if (selected.length === 0) {
      return `${group.label} seçimi zorunludur.`;
    }
  }
  return null;
}

export function enrichProductBadges(product: QrProduct): QrProduct {
  const badges = [...(product.badges ?? [])];
  if (product.isPopular && !badges.includes("popular")) {
    badges.push("popular");
  }
  return { ...product, badges };
}
