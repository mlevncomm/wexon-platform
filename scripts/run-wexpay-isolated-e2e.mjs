#!/usr/bin/env node
/**
 * Full isolated WexPay E2E orchestration:
 * DB up → prepare → build → ops+guest mutation → cleanup → (optional) DB down
 *
 * Runs the suite twice when --twice is passed (idempotency / cleanup check).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyIsolatedE2eEnv,
  assertIsolatedWexPayDatabase,
  isolatedE2eConnectionUrl,
} from "./e2e-isolated-guards.mjs";
import { createRunArtifact, cleanupWexPayE2ERun } from "../e2e/wexpay-cleanup.mjs";

const root = process.cwd();
const twice = process.argv.includes("--twice");
const keepDb = process.argv.includes("--keep-db");
const port = process.env.SMOKE_PORT || "3100";

function run(cmd, args, env = {}) {
  console.log(`[isolated-e2e] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isolatedEnv() {
  applyIsolatedE2eEnv();
  const url = isolatedE2eConnectionUrl();
  return {
    DATABASE_URL: url,
    DIRECT_URL: url,
    WEXON_E2E_TARGET: "isolated",
    WEXON_E2E_CONFIRM_ISOLATED: "true",
    E2E_BASE_URL: `http://localhost:${port}`,
    SMOKE_BASE_URL: `http://localhost:${port}`,
    SMOKE_PORT: port,
    WEXPAY_PAYTR_ENABLE_API: "false",
    WEXON_E2E_RELAX_RATE_LIMIT: "true",
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  };
}

async function runOnce(label) {
  const env = isolatedEnv();
  assertIsolatedWexPayDatabase(`isolated-e2e ${label}`);
  createRunArtifact(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);

  run(
    "npx",
    [
      "playwright",
      "test",
      "e2e/wexpay-ops-mutation.spec.ts",
      "e2e/wexpay-guest-mutation.spec.ts",
      "e2e/wexpay-active-table.spec.ts",
    ],
    env,
  );

  const report = await cleanupWexPayE2ERun();
  writeFileSync(
    resolve(root, "e2e", `.cleanup-report-${label}.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  console.log(`[isolated-e2e] ${label} cleanup:`, report.deleted);
}

async function main() {
  const env = isolatedEnv();

  run("node", ["scripts/e2e-db.mjs", "up"], env);
  run("node", ["scripts/e2e-db.mjs", "prepare"], env);

  // Build against isolated DB so server actions hit the right schema.
  run("npm", ["run", "build"], env);

  await runOnce("run1");
  if (twice) {
    run("node", ["scripts/e2e-db.mjs", "prepare"], env);
    await runOnce("run2");
  }

  if (!keepDb) {
    run("node", ["scripts/e2e-db.mjs", "down"], env);
  }

  console.log("[isolated-e2e] complete");
}

main().catch((error) => {
  console.error("[isolated-e2e]", error instanceof Error ? error.message : error);
  process.exit(1);
});
