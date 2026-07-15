#!/usr/bin/env node
/**
 * Isolated public API security E2E with forced low rate limits.
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

function run(cmd, args, env = {}) {
  console.log(`[public-security-e2e] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

async function main() {
  applyIsolatedE2eEnv();
  assertIsolatedWexPayDatabase("public-security-e2e");
  const url = isolatedE2eConnectionUrl();

  const env = {
    DATABASE_URL: url,
    DIRECT_URL: url,
    WEXON_E2E_TARGET: "isolated",
    WEXON_E2E_CONFIRM_ISOLATED: "true",
    E2E_BASE_URL: `http://localhost:${port}`,
    SMOKE_BASE_URL: `http://localhost:${port}`,
    SMOKE_PORT: port,
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    WEXPAY_PAYTR_ENABLE_API: "false",
    // Enforce limits even though Playwright usually relaxes them.
    WEXON_E2E_RELAX_RATE_LIMIT: "true",
    WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT: "true",
    WEXON_PUBLIC_QR_MENU_LIMIT: "5",
    WEXON_PUBLIC_QR_ORDER_LIMIT: "4",
    WEXON_PUBLIC_QR_WAITER_LIMIT: "20",
    WEXON_PUBLIC_QR_PAYMENT_REQUEST_LIMIT: "20",
    WEXON_PUBLIC_QR_CHECKOUT_LIMIT: "20",
    WEXON_PUBLIC_ASSIST_COOLDOWN_MS: "60000",
  };

  run("node", ["scripts/e2e-db.mjs", "up"], env);
  run("node", ["scripts/e2e-db.mjs", "prepare"], env);
  createRunArtifact(`sec${Date.now().toString(36)}`);

  run("npx", ["playwright", "test", "e2e/wexpay-public-api-security.spec.ts"], env);

  const report = await cleanupWexPayE2ERun();
  console.log("[public-security-e2e] cleanup", report.deleted);
}

main().catch((error) => {
  console.error("[public-security-e2e]", error instanceof Error ? error.message : error);
  process.exit(1);
});
