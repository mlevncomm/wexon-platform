#!/usr/bin/env node
/**
 * Full isolated WexPay E2E orchestration:
 * DB up → prepare → build → ops+guest mutation → cleanup → (optional) DB down
 *
 * Runs the suite twice when --twice is passed (idempotency / cleanup check).
 * Fail-closed: never treat 0-pass / all-skip as success.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
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
const orchestratorRunId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const mandatoryPr4Tests = [
  "PR4 mandatory: full owner journey opens operations only after explicit go-live",
  "PR4 mandatory: PayTR TEST stays encrypted and network-disabled",
  "PR4 mandatory: admin block unblock and assisted launch reuse validation",
];

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
  const adminPassword = randomBytes(24).toString("base64url");
  return {
    DATABASE_URL: url,
    DIRECT_URL: url,
    WEXON_E2E_TARGET: "isolated",
    WEXON_E2E_CONFIRM_ISOLATED: "true",
    E2E_BASE_URL: `http://localhost:${port}`,
    SMOKE_BASE_URL: `http://localhost:${port}`,
    SMOKE_PORT: port,
    SMOKE_SKIP_WEB_SERVER: "",
    SMOKE_REUSE_SERVER: "",
    WEXPAY_PAYTR_ENABLE_API: "false",
    WEXPAY_PAYTR_ENABLE: "false",
    PAYTR_ENABLED: "false",
    WEXPAY_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    WEXON_E2E_RELAX_RATE_LIMIT: "true",
    WEXON_EMAIL_PROVIDER: "fake",
    ADMIN_EMAILS: "pr4-isolated-admin@example.test",
    E2E_ADMIN_EMAIL: "pr4-isolated-admin@example.test",
    ADMIN_LOGIN_PASSWORD: adminPassword,
    E2E_ADMIN_PASSWORD: adminPassword,
    ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN: `http://localhost:${port}`,
  };
}

async function runOnce(label) {
  const env = isolatedEnv();
  assertIsolatedWexPayDatabase(`isolated-e2e ${label}`);
  createRunArtifact(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);

  // Unique names preserve prior untracked reports from earlier isolated runs.
  const reportPath = resolve(root, "e2e", `.isolated-report-${orchestratorRunId}-${label}.txt`);
  console.log(`[isolated-e2e] $ npx playwright test (isolated specs)`);
  const result = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      "e2e/wexpay-ops-mutation.spec.ts",
      "e2e/wexpay-guest-mutation.spec.ts",
      "e2e/wexpay-active-table.spec.ts",
      "e2e/wexpay-modifiers.spec.ts",
      "e2e/wexpay-table-qr.spec.ts",
      "e2e/wexpay-paytr-return-ux.spec.ts",
      "e2e/wexpay-activation-gate.spec.ts",
      "e2e/wexpay-activation-wizard.spec.ts",
      "e2e/wexpay-opaque-qr.spec.ts",
      "e2e/wexpay-auth-tenant.spec.ts",
      "e2e/wexpay-app-wide-workspace.spec.ts",
      "e2e/wexpay-pricing-parity.spec.ts",
      "e2e/wexpay-final-closure.spec.ts",
      "e2e/wexpay-pr4-full-journey.spec.ts",
      "e2e/core-canonical-routing.spec.ts",
      "--reporter=list",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  writeFileSync(reportPath, combined, "utf8");
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  const passed = Number((combined.match(/(\d+)\s+passed/) || [])[1] || 0);
  const failed = Number((combined.match(/(\d+)\s+failed/) || [])[1] || 0);
  const skipped = Number((combined.match(/(\d+)\s+skipped/) || [])[1] || 0);
  console.log(`[isolated-e2e] ${label} results: passed=${passed} failed=${failed} skipped=${skipped}`);
  if (failed > 0) {
    throw new Error(`[isolated-e2e] ${label}: ${failed} failed test(s)`);
  }
  // Includes activation, auth/tenant, pricing, workspace, final closure, routing, and core specs.
  const MIN_ISOLATED_PASSES = 31;
  if (passed < MIN_ISOLATED_PASSES) {
    throw new Error(
      `[isolated-e2e] ${label}: fail-closed — need ≥${MIN_ISOLATED_PASSES} passing tests (got passed=${passed}, skipped=${skipped})`,
    );
  }
  for (const mandatoryTitle of mandatoryPr4Tests) {
    const resultLine = combined
      .split(/\r?\n/)
      .find((line) => line.includes(mandatoryTitle));
    if (!resultLine) {
      throw new Error(
        `[isolated-e2e] ${label}: mandatory PR-4 test did not run: ${mandatoryTitle}`,
      );
    }
    if (/\b(skipped|fixme)\b/i.test(resultLine) || /^\s*-\s/.test(resultLine)) {
      throw new Error(
        `[isolated-e2e] ${label}: mandatory PR-4 test must not skip: ${mandatoryTitle}`,
      );
    }
  }

  const report = await cleanupWexPayE2ERun();
  writeFileSync(
    resolve(root, "e2e", `.cleanup-report-${orchestratorRunId}-${label}.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  console.log(`[isolated-e2e] ${label} cleanup:`, report.deleted);
}

async function main() {
  run("node", ["scripts/e2e-db.mjs", "up"], isolatedEnv());
  run("node", ["scripts/e2e-db.mjs", "prepare"], isolatedEnv());

  // Build against isolated DB so server actions hit the right schema.
  run("npm", ["run", "build"], isolatedEnv());

  await runOnce("run1");
  if (twice) {
    run("node", ["scripts/e2e-db.mjs", "prepare"], isolatedEnv());
    await runOnce("run2");
  }

  if (!keepDb) {
    run("node", ["scripts/e2e-db.mjs", "down"], isolatedEnv());
  }

  console.log("[isolated-e2e] complete");
}

main().catch((error) => {
  console.error("[isolated-e2e]", error instanceof Error ? error.message : error);
  process.exit(1);
});
