#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const steps = [
  ["production:check", "node scripts/check-production-env.mjs"],
  ["db:check:payment-provider-ref", "node scripts/check-payment-provider-ref-duplicates.mjs"],
  ["prisma:migrate:deploy", "npx.cmd prisma migrate deploy"],
];

for (const [label, command] of steps) {
  console.log(`\n[production:preflight] ${label}`);
  const result = spawnSync(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[production:preflight] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[production:preflight] ${label} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[production:preflight] passed.");
