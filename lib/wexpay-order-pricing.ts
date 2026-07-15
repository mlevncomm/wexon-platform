/**
 * Shared WexPay order-line modifier validation + server-side pricing.
 * Guest QR and cashier create-order paths both call these helpers so totals
 * and OrderItemModifier snapshots stay consistent.
 *
 * Money uses integer minor units (kuruş) to avoid floating-point drift.
 * OrderItem.unitPrice = base catalog product price (snapshot).
 * OrderItem.totalPrice = (base + Σ priceDelta) × quantity.
 */
import { buildModifierCartIdentity } from "@/lib/wexpay-cart-identity";
import { WexPayValidationError } from "@/lib/wexpay-validation-error";

export { buildModifierCartIdentity };

export type MoneyInput = number | string | { toString(): string };

export type ModifierSelectionType = "SINGLE" | "MULTI";

export type CatalogModifierOption = {
  id: string;
  groupId: string;
  name: string;
  priceDelta: MoneyInput;
  sortOrder: number;
  isActive: boolean;
};

export type CatalogModifierGroup = {
  id: string;
  branchId: string;
  name: string;
  selectionType: ModifierSelectionType | string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  options: CatalogModifierOption[];
};

export type CatalogProductModifierLink = {
  groupId: string;
  sortOrder: number;
  isActive: boolean;
  group: CatalogModifierGroup;
};

export type CatalogProductForOrder = {
  id: string;
  branchId: string;
  name: string;
  price: MoneyInput;
  isActive: boolean;
  inStock: boolean;
  productModifierGroups: CatalogProductModifierLink[];
};

export type ResolvedOrderItemModifier = {
  groupId: string;
  optionId: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
  sortOrder: number;
};

export type PricedOrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  /** Base catalog unit price at order time (excludes modifier deltas). */
  unitPrice: number;
  /** Modifier-inclusive line total. */
  totalPrice: number;
  modifiers: ResolvedOrderItemModifier[];
};

/** Convert Decimal/string/number to integer kuruş. */
export function moneyToMinor(value: MoneyInput): number {
  const amount = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(amount)) {
    throw new WexPayValidationError("Geçersiz tutar.");
  }
  return Math.round(amount * 100);
}

export function minorToMoney(minor: number): number {
  return Math.round(minor) / 100;
}

export function roundMoneyMinor(minor: number): number {
  return Math.round(minor);
}

/** Deduplicate + reject empty IDs; preserve first-seen order for stable validation messages. */
export function normalizeModifierOptionIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new WexPayValidationError("Modifier seçimleri geçersiz.");
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !value.trim()) {
      throw new WexPayValidationError("Modifier seçimi geçersiz.");
    }
    const id = value.trim();
    if (seen.has(id)) {
      throw new WexPayValidationError("Aynı seçenek birden fazla gönderilemez.");
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function activeLinkedGroups(product: CatalogProductForOrder): CatalogProductModifierLink[] {
  return product.productModifierGroups
    .filter((link) => link.isActive && link.group.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.group.sortOrder - b.group.sortOrder);
}

/**
 * Validates option IDs against a product's active linked groups and builds
 * immutable snapshots. Pure — no DB.
 */
export function resolveProductModifiers(
  product: CatalogProductForOrder,
  branchId: string,
  modifierOptionIds: string[],
): ResolvedOrderItemModifier[] {
  if (product.branchId !== branchId) {
    throw new WexPayValidationError("Seçilen ürün bu şubeye ait değil.");
  }

  const links = activeLinkedGroups(product);
  const optionById = new Map<string, { option: CatalogModifierOption; group: CatalogModifierGroup; linkSort: number }>();

  for (const link of links) {
    const group = link.group;
    if (group.branchId !== branchId || group.branchId !== product.branchId) {
      continue;
    }
    for (const option of group.options) {
      if (!option.isActive) continue;
      if (option.groupId !== group.id) continue;
      optionById.set(option.id, { option, group, linkSort: link.sortOrder });
    }
  }

  const selectedByGroup = new Map<string, CatalogModifierOption[]>();

  for (const optionId of modifierOptionIds) {
    const hit = optionById.get(optionId);
    if (!hit) {
      throw new WexPayValidationError("Seçilen ürün seçeneği geçersiz veya bu ürüne ait değil.");
    }
    const list = selectedByGroup.get(hit.group.id) ?? [];
    list.push(hit.option);
    selectedByGroup.set(hit.group.id, list);
  }

  for (const link of links) {
    const group = link.group;
    const selected = selectedByGroup.get(group.id) ?? [];
    const count = selected.length;
    const selectionType = String(group.selectionType);
    const minSelect = Math.max(0, group.minSelect);
    const maxSelect = Math.max(1, group.maxSelect);
    const effectiveMax = selectionType === "SINGLE" ? 1 : maxSelect;

    if (count < minSelect) {
      throw new WexPayValidationError(`“${group.name}” için en az ${minSelect} seçim yapılmalıdır.`);
    }
    if (count > effectiveMax) {
      throw new WexPayValidationError(
        selectionType === "SINGLE"
          ? `“${group.name}” için yalnızca bir seçim yapılabilir.`
          : `“${group.name}” için en fazla ${effectiveMax} seçim yapılabilir.`,
      );
    }
  }

  const snapshots: ResolvedOrderItemModifier[] = [];
  for (const link of links) {
    const selected = selectedByGroup.get(link.group.id) ?? [];
    for (const option of selected) {
      snapshots.push({
        groupId: link.group.id,
        optionId: option.id,
        groupName: link.group.name,
        optionName: option.name,
        priceDelta: minorToMoney(moneyToMinor(option.priceDelta)),
        sortOrder: link.sortOrder * 1000 + option.sortOrder,
      });
    }
  }

  snapshots.sort((a, b) => a.sortOrder - b.sortOrder || a.optionName.localeCompare(b.optionName));
  return snapshots;
}

export function priceOrderLine(input: {
  product: CatalogProductForOrder;
  branchId: string;
  quantity: number;
  modifierOptionIds?: string[];
}): PricedOrderLine {
  const { product, branchId, quantity } = input;
  if (!product.isActive) {
    throw new WexPayValidationError(`${product.name} pasif olduğu için siparişe eklenemez.`);
  }
  if (!product.inStock) {
    throw new WexPayValidationError(`${product.name} stokta olmadığı için siparişe eklenemez.`);
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
    throw new WexPayValidationError("Ürün adedi 1-999 arasında bir tam sayı olmalıdır.");
  }

  const optionIds = normalizeModifierOptionIds(input.modifierOptionIds ?? []);
  const modifiers = resolveProductModifiers(product, branchId, optionIds);

  const baseMinor = moneyToMinor(product.price);
  const deltaMinor = modifiers.reduce((sum, mod) => sum + moneyToMinor(mod.priceDelta), 0);
  const unitEffectiveMinor = roundMoneyMinor(baseMinor + deltaMinor);
  const totalMinor = roundMoneyMinor(unitEffectiveMinor * quantity);

  return {
    productId: product.id,
    productName: product.name,
    quantity,
    unitPrice: minorToMoney(baseMinor),
    totalPrice: minorToMoney(totalMinor),
    modifiers,
  };
}

export function sumPricedLinesSubtotal(lines: Array<{ totalPrice: MoneyInput }>): number {
  const minor = lines.reduce((sum, line) => sum + moneyToMinor(line.totalPrice), 0);
  return minorToMoney(roundMoneyMinor(minor));
}

/** Public-safe modifier DTO (no branch/org/timestamps). */
export type PublicMenuModifierOptionDto = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

export type PublicMenuModifierGroupDto = {
  id: string;
  name: string;
  selectionType: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: PublicMenuModifierOptionDto[];
};

export function toPublicMenuModifierGroups(
  links: CatalogProductModifierLink[] | undefined | null,
): PublicMenuModifierGroupDto[] {
  if (!links?.length) return [];
  return links
    .filter((link) => link.isActive && link.group.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.group.sortOrder - b.group.sortOrder)
    .map((link) => ({
      id: link.group.id,
      name: link.group.name,
      selectionType: String(link.group.selectionType),
      minSelect: link.group.minSelect,
      maxSelect: link.group.maxSelect,
      sortOrder: link.sortOrder,
      options: link.group.options
        .filter((option) => option.isActive && option.groupId === link.group.id)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: minorToMoney(moneyToMinor(option.priceDelta)),
          sortOrder: option.sortOrder,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

export type OrderItemModifierSnapshotDto = {
  groupName: string;
  optionName: string;
  priceDelta: number;
  sortOrder: number;
};
