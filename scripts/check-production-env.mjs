#!/usr/bin/env node
/**
 * Production environment readiness check.
 * Logs variable names only — never secret values.
 */

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

function isSet(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

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

console.log("Production environment check passed.");
console.log(`Required: ${REQUIRED.length}/${REQUIRED.length}`);
console.log(`PSP optional checked: ${PSP_OPTIONAL.length - pspMissing.length}/${PSP_OPTIONAL.length}`);
