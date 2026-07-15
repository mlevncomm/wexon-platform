#!/usr/bin/env node
/**
 * Compatibility wrapper — forwards to tsx implementation.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsx", "scripts/run-deploy-smoke.ts", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
