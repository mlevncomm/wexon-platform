#!/usr/bin/env node
/**
 * Isolated public API security E2E with forced low rate limits.
 *
 * Security/rate-limit pins are passed only to spawned children — never left on
 * this process's environment for subsequent npm scripts in the same shell.
 */
import { spawnSync } from "node:child_process";
import {
  applyIsolatedE2eEnv,
  assertIsolatedWexPayDatabase,
  isolatedE2eConnectionUrl,
} from "./e2e-isolated-guards.mjs";
import { createRunArtifact, cleanupWexPayE2ERun } from "../e2e/wexpay-cleanup.mjs";

const root = process.cwd();
const port = process.env.SMOKE_PORT || "3100";

/** Keys we may temporarily pin for assert/cleanup — restored in finally. */
const PARENT_PIN_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "WEXON_E2E_TARGET",
  "WEXON_E2E_CONFIRM_ISOLATED",
  "WEXON_E2E_CONFIRM_PRODUCTION",
  "SMOKE_BASE_URL",
  "E2E_BASE_URL",
];

/** Must never linger on the orchestrator process (child-only). */
const CHILD_ONLY_SECURITY_KEYS = [
  "WEXON_E2E_RELAX_RATE_LIMIT",
  "WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT",
  "WEXON_PUBLIC_QR_MENU_LIMIT",
  "WEXON_PUBLIC_QR_ORDER_LIMIT",
  "WEXON_PUBLIC_QR_WAITER_LIMIT",
  "WEXON_PUBLIC_QR_PAYMENT_REQUEST_LIMIT",
  "WEXON_PUBLIC_QR_CHECKOUT_LIMIT",
  "WEXON_PUBLIC_QR_BILL_LIMIT",
  "WEXON_PUBLIC_QR_WINDOW_MS",
  "WEXON_PUBLIC_ASSIST_COOLDOWN_MS",
];

function snapshotEnv(keys) {
  /** @type {Map<string, string | undefined>} */
  const snap = new Map();
  for (const key of keys) {
    snap.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
  }
  return snap;
}

function restoreEnv(snap) {
  for (const [key, value] of snap) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function run(cmd, args, env) {
  console.log(`[public-security-e2e] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  return result.status ?? 1;
}

async function main() {
  const parentSnap = snapshotEnv([...PARENT_PIN_KEYS, ...CHILD_ONLY_SECURITY_KEYS]);
  let exitCode = 0;

  try {
    // Temporary DB isolation pins for assert + cleanup only (restored in finally).
    applyIsolatedE2eEnv();
    assertIsolatedWexPayDatabase("public-security-e2e");
    const url = isolatedE2eConnectionUrl();

    // Build child env without assigning security pins onto process.env.
    const childEnv = {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: url,
      WEXON_E2E_TARGET: "isolated",
      WEXON_E2E_CONFIRM_ISOLATED: "true",
      E2E_BASE_URL: `http://localhost:${port}`,
      SMOKE_BASE_URL: `http://localhost:${port}`,
      SMOKE_PORT: port,
      NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
      WEXPAY_PAYTR_ENABLE_API: "false",
      // Enforce public QR limits even though Playwright usually relaxes them.
      WEXON_E2E_RELAX_RATE_LIMIT: "true",
      WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
      WEXON_PUBLIC_QR_MENU_LIMIT: "5",
      WEXON_PUBLIC_QR_ORDER_LIMIT: "4",
      WEXON_PUBLIC_QR_WAITER_LIMIT: "20",
      WEXON_PUBLIC_QR_PAYMENT_REQUEST_LIMIT: "20",
      WEXON_PUBLIC_QR_CHECKOUT_LIMIT: "20",
      WEXON_PUBLIC_ASSIST_COOLDOWN_MS: "60000",
    };

    // Ensure orchestrator itself never holds FORCE / override pins mid-run.
    for (const key of CHILD_ONLY_SECURITY_KEYS) {
      delete process.env[key];
    }

    exitCode = run("node", ["scripts/e2e-db.mjs", "up"], childEnv);
    if (exitCode !== 0) return;

    exitCode = run("node", ["scripts/e2e-db.mjs", "prepare"], childEnv);
    if (exitCode !== 0) return;

    createRunArtifact(`sec${Date.now().toString(36)}`);

    exitCode = run(
      "npx",
      ["playwright", "test", "e2e/wexpay-public-api-security.spec.ts"],
      childEnv,
    );
    if (exitCode !== 0) return;

    const report = await cleanupWexPayE2ERun();
    console.log("[public-security-e2e] cleanup", report.deleted);
  } finally {
    restoreEnv(parentSnap);
    // Belt-and-suspenders: security pins must not remain if they were unset before.
    for (const key of CHILD_ONLY_SECURITY_KEYS) {
      const previous = parentSnap.get(key);
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }

  if (exitCode !== 0) process.exit(exitCode);
}

main().catch((error) => {
  console.error("[public-security-e2e]", error instanceof Error ? error.message : error);
  process.exit(1);
});
