#!/usr/bin/env node
/**
 * Production environment readiness check.
 * Logs variable names only — never secret values.
 *
 * Local: loads `.env` then `.env.local` (does not override existing process.env).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import {
  DEPLOY_PSP_OPTIONAL_ENVS,
  DEPLOY_REQUIRED_ENVS,
  snapshotProcessEnv,
  validateDeployEnvironment,
} from "../lib/wexon-deploy-env";

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  const merged: Record<string, string> = {};

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

loadLocalEnvFiles();

const strictPsp = process.argv.includes("--strict-psp");
const report = validateDeployEnvironment(snapshotProcessEnv(), {
  strictPsp,
  requirePaytrOff: true,
});

if (report.missing.length > 0) {
  console.error("Missing required production environment variables:");
  for (const name of report.missing) {
    console.error(`  - ${name}`);
  }
}

if (report.pspMissing.length > 0) {
  const label = strictPsp
    ? "Missing PSP-required variables:"
    : "PSP warnings (optional unless using virtual POS):";
  console.warn(label);
  for (const name of report.pspMissing) {
    console.warn(`  - ${name}`);
  }
}

if (report.missing.length > 0) {
  process.exit(1);
}

const nonPspIssues = report.issues.filter((issue) => issue.code !== "psp_required");
if (nonPspIssues.length > 0) {
  console.error("Weak, forbidden, or invalid production environment variables:");
  for (const issue of nonPspIssues) {
    console.error(`  - ${issue.message}`);
  }
  process.exit(1);
}

if (strictPsp) {
  const pspIssues = report.issues.filter((issue) => issue.code === "psp_required");
  if (pspIssues.length > 0 || report.pspMissing.length > 0) {
    for (const issue of pspIssues) {
      console.error(`  - ${issue.message}`);
    }
    process.exit(1);
  }
}

if (!report.ok && strictPsp) {
  process.exit(1);
}

const paytrSubEnabled = (process.env.PAYTR_SUBSCRIPTION_ENABLE_API ?? "").trim() === "true";
const paytrRecurringEnabled = (process.env.PAYTR_RECURRING_ENABLE_API ?? "").trim() === "true";

console.log("Production environment check passed.");
console.log(`Required: ${DEPLOY_REQUIRED_ENVS.length}/${DEPLOY_REQUIRED_ENVS.length}`);
console.log(
  `PSP optional checked: ${DEPLOY_PSP_OPTIONAL_ENVS.length - report.pspMissing.length}/${DEPLOY_PSP_OPTIONAL_ENVS.length}`,
);
console.log(
  `PayTR WexPay API: off | subscription: ${paytrSubEnabled ? "enabled-gated" : "disabled"} (recurring=${paytrRecurringEnabled ? "BLOCKED" : "off"})`,
);
