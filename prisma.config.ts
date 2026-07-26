import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env", quiet: true });
// Isolated E2E already pins DATABASE_URL/DIRECT_URL — do not let .env.local
// (often production Supabase) clobber them for prisma migrate/generate.
const isolatedPinnedDb =
  process.env.WEXON_E2E_CONFIRM_ISOLATED === "true" &&
  Boolean(process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim());
loadEnv({
  path: ".env.local",
  override: !isolatedPinnedDb,
  quiet: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
