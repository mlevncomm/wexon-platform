/**
 * Typed errors for admin mutation guard — safe messages may reach the UI.
 */

export type AdminMutationDenyCode =
  | "rate_limit_denied"
  | "rate_limit_unavailable"
  | "idempotency_conflict"
  | "idempotency_in_progress"
  | "idempotency_replay"
  | "invalid_state_transition"
  | "stale_version"
  | "inactive_admin"
  | "tenant_mismatch"
  | "confirmation_missing"
  | "finance_invariant_failed"
  | "mutation_key_invalid"
  | "cleanup_forbidden";

export class AdminMutationGuardError extends Error {
  readonly code: AdminMutationDenyCode;
  readonly safeMessage: string;
  readonly cause?: unknown;

  constructor(code: AdminMutationDenyCode, safeMessage: string, options?: { cause?: unknown }) {
    super(safeMessage);
    this.name = "AdminMutationGuardError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.cause = options?.cause;
  }
}

export const ADMIN_MUTATION_GENERIC_USER_MESSAGE =
  "İşlem tamamlanamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
