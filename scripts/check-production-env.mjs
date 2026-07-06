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
if (isProduction && isSet("CUSTOMER_DEV_LOGIN_PASSWORD")) {
  console.error("CUSTOMER_DEV_LOGIN_PASSWORD must be unset in production.");
  process.exit(1);
}

console.log("Production environment check passed.");
console.log(`Required: ${REQUIRED.length}/${REQUIRED.length}`);
console.log(`PSP optional checked: ${PSP_OPTIONAL.length - pspMissing.length}/${PSP_OPTIONAL.length}`);
