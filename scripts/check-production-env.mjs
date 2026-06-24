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
];

const PSP_OPTIONAL = ["WEXPAY_CREDENTIAL_ENCRYPTION_KEY", "WEXPAY_PAYTR_ENABLE_API"];

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

loadLocalEnvFiles();

const strictPsp = process.argv.includes("--strict-psp");
const missing = REQUIRED.filter((name) => !isSet(name));
const pspMissing = PSP_OPTIONAL.filter((name) => !isSet(name));

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

if (strictPsp && pspMissing.length > 0) {
  process.exit(1);
}

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
if (isProduction && isSet("CUSTOMER_DEV_LOGIN_PASSWORD")) {
  console.warn(
    "Warning: CUSTOMER_DEV_LOGIN_PASSWORD is set in production — dev login fallback should be disabled.",
  );
}

console.log("Production environment check passed.");
console.log(`Required: ${REQUIRED.length}/${REQUIRED.length}`);
console.log(`PSP optional checked: ${PSP_OPTIONAL.length - pspMissing.length}/${PSP_OPTIONAL.length}`);
