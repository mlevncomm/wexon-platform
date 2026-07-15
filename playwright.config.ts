import { defineConfig, devices } from "@playwright/test";
import { parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName: string, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const entries = parseEnv(readFileSync(fullPath));
  const isolatedPinned = process.env.WEXON_E2E_CONFIRM_ISOLATED === "true";
  for (const [key, value] of Object.entries(entries)) {
    if (
      isolatedPinned &&
      (key === "DATABASE_URL" ||
        key === "DIRECT_URL" ||
        key === "WEXON_E2E_TARGET" ||
        key === "WEXON_E2E_CONFIRM_ISOLATED")
    ) {
      continue;
    }
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", { override: true });

const port = Number(process.env.SMOKE_PORT ?? 3100);
const baseURL =
  process.env.E2E_BASE_URL?.trim() ||
  process.env.SMOKE_BASE_URL?.trim() ||
  `http://localhost:${port}`;

const e2eTarget = (process.env.WEXON_E2E_TARGET ?? "local").trim().toLowerCase();
const productionConfirmed = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
const looksProduction =
  e2eTarget === "production" || /https?:\/\/([a-z0-9-]+\.)?wexon\.dev\b/i.test(baseURL);

if (looksProduction && !(e2eTarget === "production" && productionConfirmed)) {
  throw new Error(
    "E2E production target blocked. Set WEXON_E2E_TARGET=production and WEXON_E2E_CONFIRM_PRODUCTION=true, or use a local/preview base URL.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: resolve(__dirname, "e2e/global-setup.mjs"),
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.SMOKE_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: Boolean(process.env.SMOKE_REUSE_SERVER),
        timeout: 120_000,
        env: {
          ...process.env,
          // Relax in-memory auth rate limits for serial local E2E only.
          WEXON_E2E_RELAX_RATE_LIMIT: looksProduction ? process.env.WEXON_E2E_RELAX_RATE_LIMIT ?? "" : "true",
          WEXON_E2E_TARGET: looksProduction ? e2eTarget : process.env.WEXON_E2E_TARGET || "local",
        },
      },
});
