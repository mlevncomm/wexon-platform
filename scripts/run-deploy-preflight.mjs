#!/usr/bin/env node
/**
 * Deploy preflight — validate env, compile, test. No migrate/seed/charge/mutation.
 */
import { spawnSync } from "node:child_process";

const root = process.cwd();

/** @type {Array<[string, string, string[]]>} */
const steps = [
  ["production:check", "npx", ["tsx", "scripts/check-production-env.ts"]],
  ["prisma generate", "npx", ["prisma", "generate"]],
  ["tsc", "npx", ["tsc", "--noEmit"]],
  ["lint", "npm", ["run", "lint"]],
  ["build", "npm", ["run", "build"]],
  ["unit", "npm", ["run", "test:unit"]],
  ["health unit", "npx", ["tsx", "--import", "./scripts/load-local-env.mjs", "--test", "lib/wexon-health.test.ts", "lib/wexon-deploy-env.test.ts"]],
];

function run(label, cmd, args) {
  console.log(`\n[deploy:preflight] ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`[deploy:preflight] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    console.error(`[deploy:preflight] ${label} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("[deploy:preflight] starting (no migrate / seed / PayTR charge / DB mutation).");

for (const [label, cmd, args] of steps) {
  run(label, cmd, args);
}

console.log("\n[deploy:preflight] passed.");
console.log("[deploy:preflight] Next (manual): DB inspection → migrate deploy if needed → Vercel deploy → deploy:smoke against production.");
