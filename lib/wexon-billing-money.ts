/**
 * Central TRY minor-unit (kuruş) money helpers for Core billing.
 * Avoid floating-point: convert via integer arithmetic where possible.
 */

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export const TRY_MINOR_UNITS_PER_MAJOR = 100;

/** Convert major currency units (TL) to minor (kuruş). Deterministic half-up via Math.round. */
export function minorFromMajor(major: number): number {
  if (!Number.isFinite(major)) throw new Error("Invalid major amount");
  return Math.round(major * TRY_MINOR_UNITS_PER_MAJOR);
}

/** Convert minor (kuruş) to major (TL) for Decimal columns / display. */
export function majorFromMinor(minor: number): number {
  if (!Number.isInteger(minor)) throw new Error("minor must be an integer");
  return minor / TRY_MINOR_UNITS_PER_MAJOR;
}

/** Parse Prisma Decimal / string / number into major units safely. */
export function parseMajorAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

export function parseMajorToMinor(value: unknown): number | null {
  const major = parseMajorAmount(value);
  if (major == null || major < 0) return null;
  return minorFromMajor(major);
}

/**
 * EXCLUSIVE tax: tax = round(net * bps / 10000); gross = net + tax.
 * When taxEnabled=false: tax=0, gross=net (bps still recorded on snapshot).
 */
export function computeExclusiveTax(input: {
  netAmountMinor: number;
  taxRateBps: number;
  taxEnabled: boolean;
}): { taxAmountMinor: number; grossAmountMinor: number } {
  if (!Number.isInteger(input.netAmountMinor) || input.netAmountMinor < 0) {
    throw new Error("netAmountMinor must be a non-negative integer");
  }
  if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0) {
    throw new Error("taxRateBps must be a non-negative integer");
  }
  if (!input.taxEnabled) {
    return { taxAmountMinor: 0, grossAmountMinor: input.netAmountMinor };
  }
  const taxAmountMinor = Math.round((input.netAmountMinor * input.taxRateBps) / 10_000);
  return { taxAmountMinor, grossAmountMinor: input.netAmountMinor + taxAmountMinor };
}
