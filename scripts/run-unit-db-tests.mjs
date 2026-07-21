#!/usr/bin/env node
/**
 * Fail-closed runner for DB-backed unit tests.
 *
 * 1) Load local env
 * 2) Validate DATABASE_URL / DIRECT_URL via shared guard (no Prisma)
 * 3) Only then spawn the test process
 *
 * Remote / production / preview targets exit before any test module (and thus
 * before `lib/prisma.ts`) is loaded.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await import(pathToFileURL(join(root, "scripts/load-local-env.mjs")).href);

const { assertLocalDbTestGuard } = await import(
  pathToFileURL(join(root, "lib/wexon-local-db-test-guard.ts")).href
);
const allowed = assertLocalDbTestGuard(process.env);
console.error(
  `[db-test-guard] OK: host=${allowed.host} database=${allowed.database} (opt-in local test/e2e only)`,
);

const files = [
  "lib/wexon-subscription-lifecycle.db.test.ts",
  "lib/wexon-active-owner.db.test.ts",
  "lib/paytr/paytr-callback.db.test.ts",
  "lib/paytr/paytr-callback-recovery.db.test.ts",
  "lib/paytr/paytr-callback-retry-contract.db.test.ts",
  "lib/wexon-entitlement-lifecycle.db.test.ts",
  "lib/wexpay-paytr-webhook.db.test.ts",
  "lib/wexpay-concurrency.db.test.ts",
  "lib/wexon-activation-fee.db.test.ts",
  "lib/wexon-activation-fee-security.db.test.ts",
  "lib/wexpay-smart-activation.db.test.ts",
  "lib/wexpay-staff-invite.db.test.ts",
  "lib/wexpay-activation-wizard.db.test.ts",
  "lib/wexpay-menu-import.db.test.ts",
];

const credentialEncryptionKey = randomBytes(32).toString("hex");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-reporter=spec", ...files], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  env: {
    ...process.env,
    WEXPAY_CREDENTIAL_ENCRYPTION_KEY: credentialEncryptionKey,
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const skipped = Number((combined.match(/(?:ℹ|#)\s*skipped\s+(\d+)/i) || [])[1] || 0);
if (skipped > 0) {
  console.error(`[db-test-guard] fail-closed: ${skipped} skipped DB test(s)`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
