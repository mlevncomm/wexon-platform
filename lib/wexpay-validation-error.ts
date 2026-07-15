/**
 * Shared validation error for WexPay domain helpers.
 * Kept in a lightweight module so server pricing can throw it without
 * pulling Prisma / PSP credential graphs into callers.
 */
export class WexPayValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WexPayValidationError";
  }
}
