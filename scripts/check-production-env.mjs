#!/usr/bin/env node
/**
 * Production environment readiness check.
 * Logs variable names only — never secret values.
 *
 * Local: loads `.env` then `.env.local` (local overrides file vars).
 * Host/production: existing process.env always wins over file values.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

const REQUIRED = [
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
];

const PSP_OPTIONAL = ["WEXPAY_CREDENTIAL_ENCRYPTION_KEY"];
const SECRET_MIN_LENGTH = 32;
const LONG_SECRET_NAMES = ["ADMIN_SESSION_SECRET", "CUSTOMER_SESSION_SECRET", "API_KEY_HASH_SECRET"];
const PLACEHOLDER_PATTERNS = [/change-me/i, /change-before-production/i, /placeholder/i, /example/i, /secret-here/i, /your-/i];

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  const merged = {};

  for (const rel of [".env", ".env.local"]) {
    const path = resolve(cwd, rel);
    if (!existsSync(path)) continue;
    const parsed = dotenv.parse(readFileSync(path, "utf8"));
    Object.assign(merged, parsed);
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isSet(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function getValue(name) {
  return process.env[name]?.trim() ?? "";
}

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function validateLongSecret(name) {
  const value = getValue(name);
  if (!value) return null;
  if (value.length < SECRET_MIN_LENGTH) {
    return `${name} must be at least ${SECRET_MIN_LENGTH} characters.`;
  }
  if (isPlaceholder(value)) {
    return `${name} still looks like a placeholder.`;
  }
  return null;
}

function validatePassword(name) {
  const value = getValue(name);
  if (!value) return null;
  if (value.length < 12) {
    return `${name} must be at least 12 characters.`;
  }
  if (isPlaceholder(value)) {
    return `${name} still looks like a placeholder.`;
  }
  return null;
}

function validateCredentialEncryptionKey() {
  const value = getValue("WEXPAY_CREDENTIAL_ENCRYPTION_KEY");
  if (!value) return null;
  const isHex32Bytes = value.length === 64 && /^[0-9a-f]+$/i.test(value);
  const isRaw32Bytes = Buffer.byteLength(value, "utf8") === 32;
  const isProbablyBase64 = Buffer.from(value, "base64").length === 32;
  if (!isHex32Bytes && !isRaw32Bytes && !isProbablyBase64) {
    return "WEXPAY_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes (64-char hex, 32-byte raw, or base64).";
  }
  if (isPlaceholder(value)) {
    return "WEXPAY_CREDENTIAL_ENCRYPTION_KEY still looks like a placeholder.";
  }
  return null;
}

function validateBooleanFlag(name) {
  const value = getValue(name);
  if (!value) return null;
  if (value !== "true" && value !== "false") {
    return `${name} must be explicitly set to true or false.`;
  }
  return null;
}

loadLocalEnvFiles();

const strictPsp = process.argv.includes("--strict-psp");
const missing = REQUIRED.filter((name) => !isSet(name));
const pspMissing = PSP_OPTIONAL.filter((name) => !isSet(name));
const weak = [
  ...LONG_SECRET_NAMES.map(validateLongSecret),
  validatePassword("ADMIN_LOGIN_PASSWORD"),
  validateBooleanFlag("MAINTENANCE_MODE"),
  validateBooleanFlag("WEXPAY_PAYTR_ENABLE_API"),
  validateCredentialEncryptionKey(),
].filter(Boolean);

if (missing.length > 0) {
  console.error("Missing required production environment variables:");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
}

if (pspMissing.length > 0) {
  const label = strictPsp ? "Missing PSP-required variables:" : "PSP warnings (optional unless using virtual POS):";
  console.warn(label);
  for (const name of pspMissing) {
    console.warn(`  - ${name}`);
  }
}

if (missing.length > 0) {
  process.exit(1);
}

if (weak.length > 0) {
  console.error("Weak or placeholder production environment variables:");
  for (const item of weak) {
    console.error(`  - ${item}`);
  }
  process.exit(1);
}

if (strictPsp && pspMissing.length > 0) {
  process.exit(1);
}

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

const FORBIDDEN_IN_PRODUCTION = ["CUSTOMER_DEV_LOGIN_PASSWORD", "WEXON_E2E_RELAX_RATE_LIMIT"];

if (isProduction) {
  const forbiddenSet = FORBIDDEN_IN_PRODUCTION.filter((name) => isSet(name));
  if (forbiddenSet.length > 0) {
    console.error("Forbidden environment variables must be unset in production:");
    for (const name of forbiddenSet) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }
}

const paytrSubErrors = [];
const paytrSubEnabled = getValue("PAYTR_SUBSCRIPTION_ENABLE_API") === "true";
const paytrIframeEnabled = getValue("PAYTR_IFRAME_ENABLE_API") === "true";
const paytrRecurringEnabled = getValue("PAYTR_RECURRING_ENABLE_API") === "true";
const paytrTestMode = getValue("PAYTR_TEST_MODE");
const paytrDebugOn = getValue("PAYTR_DEBUG_ON");

for (const name of [
  "PAYTR_SUBSCRIPTION_ENABLE_API",
  "PAYTR_IFRAME_ENABLE_API",
  "PAYTR_RECURRING_ENABLE_API",
  "PAYTR_TEST_MODE",
  "PAYTR_DEBUG_ON",
]) {
  if (isSet(name)) {
    const err = validateBooleanFlag(name);
    if (err) paytrSubErrors.push(err);
  }
}

if (paytrSubEnabled) {
  for (const name of ["PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT"]) {
    if (!isSet(name)) paytrSubErrors.push(`${name} is required when PAYTR_SUBSCRIPTION_ENABLE_API=true.`);
    else if (isPlaceholder(getValue(name))) paytrSubErrors.push(`${name} still looks like a placeholder.`);
  }
  if (!paytrIframeEnabled) {
    paytrSubErrors.push("PAYTR_IFRAME_ENABLE_API must be true when PAYTR_SUBSCRIPTION_ENABLE_API=true.");
  }
  const appUrl = getValue("NEXT_PUBLIC_APP_URL");
  const publicOrigin = getValue("NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN") || appUrl;
  if (!publicOrigin.startsWith("https://") && isProduction) {
    paytrSubErrors.push("NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN (or NEXT_PUBLIC_APP_URL) must be https in production when PayTR subscription is enabled.");
  }
  if (paytrTestMode === "false" && paytrDebugOn !== "false") {
    paytrSubErrors.push("PAYTR_DEBUG_ON must be false when PAYTR_TEST_MODE=false (live mode).");
  }
}

if (paytrRecurringEnabled) {
  paytrSubErrors.push(
    "PAYTR_RECURRING_ENABLE_API=true is blocked until recurring readiness is verified (see docs/paytr-recurring-readiness.md).",
  );
}

if (paytrSubErrors.length > 0) {
  console.error("PayTR subscription environment check failed:");
  for (const item of paytrSubErrors) {
    console.error(`  - ${item}`);
  }
  process.exit(1);
}

console.log("Production environment check passed.");
console.log(`Required: ${REQUIRED.length}/${REQUIRED.length}`);
console.log(`PSP optional checked: ${PSP_OPTIONAL.length - pspMissing.length}/${PSP_OPTIONAL.length}`);
console.log(
  `PayTR subscription API: ${paytrSubEnabled ? "enabled-gated" : "disabled"} (recurring=${paytrRecurringEnabled ? "BLOCKED" : "off"})`,
);
