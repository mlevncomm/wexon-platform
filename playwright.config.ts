import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const port = Number(process.env.SMOKE_PORT ?? 3100);
const baseURL = process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`;

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
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
