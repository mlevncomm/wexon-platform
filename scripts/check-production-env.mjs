#!/usr/bin/env node
/**
 * Compatibility shim — forwards to TypeScript check via tsx.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["tsx", "scripts/check-production-env.ts", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
