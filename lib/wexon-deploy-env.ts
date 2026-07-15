/**
 * Deploy / production environment validation (fail-closed).
 * Shared by production:check and unit tests — never logs or returns secret values.
 */

import { PRODUCTION_FORBIDDEN_ENVS } from "@/lib/wexon-production-guards";

export const DEPLOY_REQUIRED_ENVS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "ADMIN_EMAILS",
  "ADMIN_LOGIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "API_KEY_HASH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "MAINTENANCE_MODE",
  "WEXPAY_PAYTR_ENABLE_API",
] as const;

export const DEPLOY_PSP_OPTIONAL_ENVS = ["WEXPAY_CREDENTIAL_ENCRYPTION_KEY"] as const;

export const DEPLOY_LONG_SECRET_ENVS = [
  "ADMIN_SESSION_SECRET",
  "CUSTOMER_SESSION_SECRET",
  "API_KEY_HASH_SECRET",
] as const;

const SECRET_MIN_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 12;

const PLACEHOLDER_PATTERNS = [
  /change-me/i,
  /change-before-production/i,
  /placeholder/i,
  /example/i,
  /secret-here/i,
  /your-/i,
  /^test$/i,
];

const WEAK_SECRET_PATTERNS = [
  /^(.)\1{15,}$/, // repeated single character
  /password/i,
  /123456/,
  /qwerty/i,
  /abcdef/i,
];

export type EnvMap = Record<string, string | undefined>;

export type DeployEnvIssue = {
  code: string;
  message: string;
};

export type DeployEnvReport = {
  ok: boolean;
  missing: string[];
  pspMissing: string[];
  issues: DeployEnvIssue[];
};

function trim(env: EnvMap, name: string) {
  return env[name]?.trim() ?? "";
}

function isSet(env: EnvMap, name: string) {
  return trim(env, name).length > 0;
}

export function isPlaceholderSecret(value: string) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

export function isWeakPredictableSecret(value: string) {
  if (WEAK_SECRET_PATTERNS.some((pattern) => pattern.test(value))) return true;
  // Alphabet / sequential-looking short alphabet scraps
  if (/^[a-z]{8,}$/i.test(value) && new Set(value.toLowerCase()).size <= 4) return true;
  return false;
}

/** Mask secret-looking fragments in error messages (never echo raw values). */
export function maskSecretInMessage(message: string, secrets: string[] = []) {
  let out = message;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join("[REDACTED]");
  }
  // Scrub common postgres URL credentials if somehow interpolated
  out = out.replace(/postgresql:\/\/[^\s)]+/gi, "postgresql://[REDACTED]");
  out = out.replace(/postgres:\/\/[^\s)]+/gi, "postgres://[REDACTED]");
  return out;
}

export function validateBooleanFlagValue(name: string, value: string): DeployEnvIssue | null {
  if (!value) return null;
  if (value !== "true" && value !== "false") {
    return {
      code: "invalid_boolean",
      message: `${name} must be explicitly set to true or false (got a non-boolean activation value).`,
    };
  }
  return null;
}

export function validateLongSecretValue(name: string, value: string): DeployEnvIssue | null {
  if (!value) return null;
  if (value.length < SECRET_MIN_LENGTH) {
    return {
      code: "secret_too_short",
      message: `${name} must be at least ${SECRET_MIN_LENGTH} characters.`,
    };
  }
  if (isPlaceholderSecret(value) || isWeakPredictableSecret(value)) {
    return {
      code: "secret_weak",
      message: `${name} still looks like a placeholder or predictable secret.`,
    };
  }
  return null;
}

export function validatePasswordValue(name: string, value: string): DeployEnvIssue | null {
  if (!value) return null;
  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      code: "password_too_short",
      message: `${name} must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (isPlaceholderSecret(value)) {
    return {
      code: "password_placeholder",
      message: `${name} still looks like a placeholder.`,
    };
  }
  return null;
}

export function validateCredentialEncryptionKeyValue(value: string): DeployEnvIssue | null {
  if (!value) return null;
  const isHex32Bytes = value.length === 64 && /^[0-9a-f]+$/i.test(value);
  const isRaw32Bytes = Buffer.byteLength(value, "utf8") === 32;
  const isProbablyBase64 = Buffer.from(value, "base64").length === 32;
  if (!isHex32Bytes && !isRaw32Bytes && !isProbablyBase64) {
    return {
      code: "encryption_key_invalid",
      message:
        "WEXPAY_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes (64-char hex, 32-byte raw, or base64).",
    };
  }
  if (isPlaceholderSecret(value)) {
    return {
      code: "encryption_key_placeholder",
      message: "WEXPAY_CREDENTIAL_ENCRYPTION_KEY still looks like a placeholder.",
    };
  }
  return null;
}

/**
 * Production-facing public origin rules.
 * When runtime is production (or requireProductionUrl), reject localhost/http.
 */
export function validatePublicAppUrl(
  value: string,
  options: { requireProductionUrl: boolean },
): DeployEnvIssue | null {
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      code: "app_url_invalid",
      message: "NEXT_PUBLIC_APP_URL must be a valid absolute URL.",
    };
  }

  if (!options.requireProductionUrl) return null;

  if (parsed.protocol !== "https:") {
    return {
      code: "app_url_not_https",
      message: "NEXT_PUBLIC_APP_URL must use https in production.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
    return {
      code: "app_url_localhost",
      message: "NEXT_PUBLIC_APP_URL must not point at localhost in production.",
    };
  }

  return null;
}

/**
 * WexPay virtual POS API must stay off for this readiness stage.
 * Accepts only the string "false"; true / 1 / yes already fail boolean validation.
 */
export function validatePaytrOffForReadiness(value: string): DeployEnvIssue | null {
  if (!value) return null;
  const boolErr = validateBooleanFlagValue("WEXPAY_PAYTR_ENABLE_API", value);
  if (boolErr) return boolErr;
  if (value !== "false") {
    return {
      code: "paytr_must_be_off",
      message:
        "WEXPAY_PAYTR_ENABLE_API must be false for WexPay deployment readiness (live PayTR stays blocked).",
    };
  }
  return null;
}

export function isProductionLikeEnv(env: EnvMap) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export type ValidateDeployEnvironmentOptions = {
  strictPsp?: boolean;
  /** Force https + non-localhost APP_URL even when not production-like */
  requireProductionUrl?: boolean;
  /** Require WEXPAY_PAYTR_ENABLE_API === "false" (default true for deploy readiness) */
  requirePaytrOff?: boolean;
};

/**
 * Pure validation against an env map. Does not read or mutate process.env.
 */
export function validateDeployEnvironment(
  env: EnvMap,
  options: ValidateDeployEnvironmentOptions = {},
): DeployEnvReport {
  const requirePaytrOff = options.requirePaytrOff !== false;
  const requireProductionUrl =
    options.requireProductionUrl === true || isProductionLikeEnv(env);

  const missing = DEPLOY_REQUIRED_ENVS.filter((name) => !isSet(env, name));
  const pspMissing = DEPLOY_PSP_OPTIONAL_ENVS.filter((name) => !isSet(env, name));
  const issues: DeployEnvIssue[] = [];

  for (const name of DEPLOY_LONG_SECRET_ENVS) {
    const issue = validateLongSecretValue(name, trim(env, name));
    if (issue) issues.push(issue);
  }

  const passwordIssue = validatePasswordValue("ADMIN_LOGIN_PASSWORD", trim(env, "ADMIN_LOGIN_PASSWORD"));
  if (passwordIssue) issues.push(passwordIssue);

  for (const name of ["MAINTENANCE_MODE", "WEXPAY_PAYTR_ENABLE_API"] as const) {
    const issue = validateBooleanFlagValue(name, trim(env, name));
    if (issue) issues.push(issue);
  }

  if (requirePaytrOff) {
    const paytrIssue = validatePaytrOffForReadiness(trim(env, "WEXPAY_PAYTR_ENABLE_API"));
    if (paytrIssue && paytrIssue.code !== "invalid_boolean") issues.push(paytrIssue);
  }

  const urlIssue = validatePublicAppUrl(trim(env, "NEXT_PUBLIC_APP_URL"), { requireProductionUrl });
  if (urlIssue) issues.push(urlIssue);

  const encIssue = validateCredentialEncryptionKeyValue(trim(env, "WEXPAY_CREDENTIAL_ENCRYPTION_KEY"));
  if (encIssue) issues.push(encIssue);

  if (isProductionLikeEnv(env)) {
    for (const name of PRODUCTION_FORBIDDEN_ENVS) {
      if (isSet(env, name)) {
        issues.push({
          code: "forbidden_env",
          message: `${name} must be unset in production.`,
        });
      }
    }
  }

  // Subscription / recurring PayTR gates (subscription may be separate from WexPay table POS)
  const paytrSubEnabled = trim(env, "PAYTR_SUBSCRIPTION_ENABLE_API") === "true";
  const paytrIframeEnabled = trim(env, "PAYTR_IFRAME_ENABLE_API") === "true";
  const paytrRecurringEnabled = trim(env, "PAYTR_RECURRING_ENABLE_API") === "true";

  for (const name of [
    "PAYTR_SUBSCRIPTION_ENABLE_API",
    "PAYTR_IFRAME_ENABLE_API",
    "PAYTR_RECURRING_ENABLE_API",
    "PAYTR_TEST_MODE",
    "PAYTR_DEBUG_ON",
  ] as const) {
    if (isSet(env, name)) {
      const issue = validateBooleanFlagValue(name, trim(env, name));
      if (issue) issues.push(issue);
    }
  }

  if (paytrSubEnabled) {
    for (const name of ["PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT"] as const) {
      if (!isSet(env, name)) {
        issues.push({
          code: "paytr_sub_missing",
          message: `${name} is required when PAYTR_SUBSCRIPTION_ENABLE_API=true.`,
        });
      } else if (isPlaceholderSecret(trim(env, name))) {
        issues.push({
          code: "paytr_sub_placeholder",
          message: `${name} still looks like a placeholder.`,
        });
      }
    }
    if (!paytrIframeEnabled) {
      issues.push({
        code: "paytr_iframe_required",
        message: "PAYTR_IFRAME_ENABLE_API must be true when PAYTR_SUBSCRIPTION_ENABLE_API=true.",
      });
    }
    const publicOrigin = trim(env, "NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN") || trim(env, "NEXT_PUBLIC_APP_URL");
    if (requireProductionUrl && publicOrigin && !publicOrigin.startsWith("https://")) {
      issues.push({
        code: "paytr_origin_https",
        message:
          "NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN (or NEXT_PUBLIC_APP_URL) must be https in production when PayTR subscription is enabled.",
      });
    }
    if (trim(env, "PAYTR_TEST_MODE") === "false" && trim(env, "PAYTR_DEBUG_ON") !== "false") {
      issues.push({
        code: "paytr_debug_live",
        message: "PAYTR_DEBUG_ON must be false when PAYTR_TEST_MODE=false (live mode).",
      });
    }
  }

  if (paytrRecurringEnabled) {
    issues.push({
      code: "paytr_recurring_blocked",
      message:
        "PAYTR_RECURRING_ENABLE_API=true is blocked until recurring readiness is verified (see docs/paytr-recurring-readiness.md).",
    });
  }

  if (options.strictPsp && pspMissing.length > 0) {
    for (const name of pspMissing) {
      issues.push({
        code: "psp_required",
        message: `${name} is required with --strict-psp.`,
      });
    }
  }

  const ok = missing.length === 0 && issues.length === 0;
  return { ok, missing, pspMissing, issues };
}

/** Snapshot process.env into a plain map for validation. */
export function snapshotProcessEnv(env: NodeJS.ProcessEnv = process.env): EnvMap {
  const out: EnvMap = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = value;
  }
  return out;
}
