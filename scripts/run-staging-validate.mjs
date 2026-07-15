#!/usr/bin/env node
/**
 * staging:validate — unit + smoke build.
 * Seed only runs when the active DATABASE_URL is a confirmed isolated e2e DB.
 * Shared remote mutation/seed is refused (fail-closed).
 */
import { spawnSync } from "node:child_process";
import { classifyE2EDatabase, wexPayMutationBlockedReason } from "./e2e-isolated-guards.mjs";

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const classification = classifyE2EDatabase();
const blocked = wexPayMutationBlockedReason();

if (!blocked && classification === "isolated") {
  console.log("[staging:validate] isolated DB confirmed — running prisma:seed:real");
  run("npm", ["run", "prisma:seed:real"]);
} else {
  console.warn(
    `[staging:validate] skipping prisma:seed:real (${classification})${blocked ? `: ${blocked}` : ""}`,
  );
}

run("npm", ["run", "test:unit"]);
run("npm", ["run", "test:smoke:build"]);
