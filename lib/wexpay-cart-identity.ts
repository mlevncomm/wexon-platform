/**
 * Deterministic cart / line identity for modifier-aware lines.
 * Pure — safe for client and unit tests. Option order must not change identity.
 */
export function buildModifierCartIdentity(
  productId: string,
  modifierOptionIds: string[] | undefined | null,
  note = "",
): string {
  const product = productId.trim();
  const options = [...new Set((modifierOptionIds ?? []).map((id) => id.trim()).filter(Boolean))].sort();
  const normalizedNote = note.trim().toLowerCase();
  return `${product}::${options.join(",")}::${normalizedNote}`;
}
