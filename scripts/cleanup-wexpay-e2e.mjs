#!/usr/bin/env node
import { applyIsolatedE2eEnv } from "./e2e-isolated-guards.mjs";
import { cleanupWexPayE2ERun } from "../e2e/wexpay-cleanup.mjs";

applyIsolatedE2eEnv();
const report = await cleanupWexPayE2ERun({ dryRun: process.argv.includes("--dry-run") });
console.log("[cleanup-wexpay-e2e]", JSON.stringify(report.deleted ?? report.planned, null, 2));
