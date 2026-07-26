/**
 * Admin mutation risk catalog, rate-limit windows, and high-risk confirmation rules.
 * Browser/server-safe (no Prisma).
 */

export const ADMIN_MUTATION_RISK_CLASSES = ["NORMAL", "SECURITY", "FINANCIAL", "DESTRUCTIVE"] as const;
export type AdminMutationRiskClass = (typeof ADMIN_MUTATION_RISK_CLASSES)[number];

export const ADMIN_MUTATION_REASON_MIN = 8;
export const ADMIN_MUTATION_REASON_MAX = 500;

/** Global backstop: mutations per admin per minute across all risk classes. */
export const ADMIN_MUTATION_GLOBAL_PER_MINUTE = 60;

export type AdminRateLimitWindow = {
  windowSeconds: number;
  maxCount: number;
};

export const ADMIN_MUTATION_RATE_LIMITS: Record<
  AdminMutationRiskClass,
  { short: AdminRateLimitWindow; long: AdminRateLimitWindow }
> = {
  NORMAL: {
    short: { windowSeconds: 60, maxCount: 30 },
    long: { windowSeconds: 3600, maxCount: 200 },
  },
  SECURITY: {
    short: { windowSeconds: 60, maxCount: 10 },
    long: { windowSeconds: 3600, maxCount: 40 },
  },
  FINANCIAL: {
    short: { windowSeconds: 60, maxCount: 8 },
    long: { windowSeconds: 3600, maxCount: 30 },
  },
  DESTRUCTIVE: {
    short: { windowSeconds: 60, maxCount: 4 },
    long: { windowSeconds: 3600, maxCount: 12 },
  },
};

/**
 * Canonical admin mutation action keys → risk class.
 * Unknown actions default to NORMAL.
 */
export const ADMIN_MUTATION_ACTION_RISK: Record<string, AdminMutationRiskClass> = {
  "invoice.create": "FINANCIAL",
  "invoice.status_change": "FINANCIAL",
  "billing_payment.create": "FINANCIAL",
  "billing_payment.status_change": "FINANCIAL",
  "subscription.create": "FINANCIAL",
  "subscription.status_change": "FINANCIAL",
  "license.create": "FINANCIAL",
  "license.status_change": "FINANCIAL",
  "license.details_change": "FINANCIAL",
  "license.plan_change": "FINANCIAL",
  "activation_fee.waive": "FINANCIAL",

  "api_key.create": "SECURITY",
  "api_key.revoke": "SECURITY",
  "webhook.create": "SECURITY",
  "webhook.toggle": "SECURITY",
  "user.password_reset": "SECURITY",
  "user.active_change": "SECURITY",
  "membership.role_change": "SECURITY",
  "membership.status_change": "SECURITY",

  "organization.deactivate": "DESTRUCTIVE",
  "organization.reactivate": "DESTRUCTIVE",
  "organization.permanent_delete": "DESTRUCTIVE",
  "test_organization.bulk_delete": "DESTRUCTIVE",
  "product.disable": "DESTRUCTIVE",
  "plan.disable": "DESTRUCTIVE",
  "entitlement.disable": "DESTRUCTIVE",
};

/** Creates that require durable AdminMutationIdempotency. */
export const ADMIN_MUTATION_IDEMPOTENT_ACTIONS = new Set([
  "invoice.create",
  "billing_payment.create",
  "subscription.create",
  "license.create",
  "api_key.create",
  "webhook.create",
  "organization.permanent_delete",
]);

export const ADMIN_MUTATION_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export const ADMIN_BILLING_PAYMENT_PROVIDERS = ["admin_manual"] as const;
export type AdminBillingPaymentProvider = (typeof ADMIN_BILLING_PAYMENT_PROVIDERS)[number];

export function resolveAdminMutationRiskClass(action: string): AdminMutationRiskClass {
  return ADMIN_MUTATION_ACTION_RISK[action] ?? "NORMAL";
}

export function requiresHighRiskConfirmation(riskClass: AdminMutationRiskClass): boolean {
  return riskClass === "FINANCIAL" || riskClass === "DESTRUCTIVE";
}

export function requiresAdminRowLock(riskClass: AdminMutationRiskClass): boolean {
  return riskClass === "SECURITY" || riskClass === "FINANCIAL" || riskClass === "DESTRUCTIVE";
}

export function isAdminMutationIdempotentAction(action: string): boolean {
  return ADMIN_MUTATION_IDEMPOTENT_ACTIONS.has(action);
}

export function isAllowedAdminBillingPaymentProvider(
  value: string | null | undefined,
): value is AdminBillingPaymentProvider {
  return value != null && (ADMIN_BILLING_PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export function sanitizeAdminMutationReason(
  raw: string | null | undefined,
  label = "İşlem gerekçesi",
  min = ADMIN_MUTATION_REASON_MIN,
  max = ADMIN_MUTATION_REASON_MAX,
): string {
  const reason = (raw ?? "").trim().replace(/\s+/g, " ");
  if (reason.length < min) {
    throw new Error(`${label} en az ${min} karakter olmalıdır.`);
  }
  if (reason.length > max) {
    throw new Error(`${label} en fazla ${max} karakter olabilir.`);
  }
  return reason;
}

/** UUID v4 format check for server-issued mutation keys. */
export function isValidAdminMutationKey(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * Developer cleanup (bulk test org delete) must stay fail-closed on hosted
 * environments — never rely on NODE_ENV alone.
 */
export function isHostedDeploymentCleanupForbidden(
  env: { NODE_ENV?: string; VERCEL_ENV?: string } = process.env,
): boolean {
  const vercel = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel === "production" || vercel === "preview") return true;
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  return nodeEnv === "production";
}
