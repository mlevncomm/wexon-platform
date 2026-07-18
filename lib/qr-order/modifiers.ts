import type { QrModifierGroup, QrProduct } from "@/lib/qr-order/types";
import { roundMoney } from "@/lib/qr-order/pricing";

export function productRequiresModifierSelection(product: QrProduct): boolean {
  return (product.modifierGroups ?? []).some((group) => group.minSelect > 0);
}

export function productHasModifiers(product: QrProduct): boolean {
  return (product.modifierGroups ?? []).some((group) => group.options.length > 0);
}

export function sumSelectedOptionDeltas(
  product: QrProduct,
  selectedOptionIds: string[],
): number {
  const selected = new Set(selectedOptionIds);
  let delta = 0;
  for (const group of product.modifierGroups ?? []) {
    for (const option of group.options) {
      if (selected.has(option.id)) delta += option.priceDelta;
    }
  }
  return roundMoney(delta);
}

export function catalogUnitPriceWithModifiers(
  product: QrProduct,
  selectedOptionIds: string[],
): number {
  return roundMoney(product.price + sumSelectedOptionDeltas(product, selectedOptionIds));
}

export function validateModifierSelections(
  product: QrProduct,
  selectedOptionIds: string[],
): string | null {
  const selected = new Set(selectedOptionIds);
  const knownIds = new Set(
    (product.modifierGroups ?? []).flatMap((group) => group.options.map((option) => option.id)),
  );

  for (const id of selected) {
    if (!knownIds.has(id)) return "Geçersiz seçenek bulundu. Lütfen ürünü yeniden seçin.";
  }

  for (const group of product.modifierGroups ?? []) {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    const selectionType = String(group.selectionType).toUpperCase();
    const maxSelect = selectionType === "SINGLE" ? 1 : Math.max(0, group.maxSelect);
    const minSelect = Math.max(0, group.minSelect);

    if (count < minSelect) {
      return `“${group.name}” için en az ${minSelect} seçim yapın.`;
    }
    if (maxSelect > 0 && count > maxSelect) {
      return selectionType === "SINGLE"
        ? `“${group.name}” için yalnızca bir seçim yapılabilir.`
        : `“${group.name}” için en fazla ${maxSelect} seçim yapılabilir.`;
    }
  }

  return null;
}

export function toggleModifierOption(
  group: QrModifierGroup,
  selectedOptionIds: string[],
  optionId: string,
): string[] {
  const selectionType = String(group.selectionType).toUpperCase();
  const groupOptionIds = new Set(group.options.map((option) => option.id));
  const withoutGroup = selectedOptionIds.filter((id) => !groupOptionIds.has(id));

  if (selectionType === "SINGLE") {
    if (selectedOptionIds.includes(optionId)) {
      return withoutGroup;
    }
    return [...withoutGroup, optionId];
  }

  if (selectedOptionIds.includes(optionId)) {
    return selectedOptionIds.filter((id) => id !== optionId);
  }

  const currentInGroup = selectedOptionIds.filter((id) => groupOptionIds.has(id));
  const maxSelect = Math.max(0, group.maxSelect);
  if (maxSelect > 0 && currentInGroup.length >= maxSelect) {
    return selectedOptionIds;
  }
  return [...selectedOptionIds, optionId];
}

export function describeSelectedModifiers(
  product: QrProduct,
  selectedOptionIds: string[],
): Array<{ groupName: string; optionName: string; priceDelta: number }> {
  const selected = new Set(selectedOptionIds);
  const rows: Array<{ groupName: string; optionName: string; priceDelta: number }> = [];
  for (const group of product.modifierGroups ?? []) {
    for (const option of group.options) {
      if (!selected.has(option.id)) continue;
      rows.push({
        groupName: group.name,
        optionName: option.name,
        priceDelta: option.priceDelta,
      });
    }
  }
  return rows;
}
