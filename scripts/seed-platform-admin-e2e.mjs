#!/usr/bin/env node
/**
 * Upsert an ACTIVE PlatformAdmin for local/CI admin E2E.
 * Fail-closed: only runs against loopback `_test`/`_e2e` DBs with
 * `WEXON_ALLOW_LOCAL_DB_TESTS=1` (see lib/wexon-local-db-test-guard.ts).
 * Uses E2E_ADMIN_EMAIL / ADMIN_EMAILS — never for production cutover.
 *
 * Prefer: `node --import tsx scripts/seed-platform-admin-e2e.mjs`
 */
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Allow plain `node scripts/seed-platform-admin-e2e.mjs` to import the TS guard.
try {
  register("tsx/esm", pathToFileURL(join(root, "package.json")));
} catch {
  // Already registered via `node --import tsx`, or tsx unavailable (guard import will fail loudly).
}

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  for (const [key, value] of Object.entries(parsed)) {
    // Never override caller/CI-injected env (especially DATABASE_URL / DIRECT_URL).
    if (override || !process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local");

// Guard MUST run before any Prisma import/client/query.
const { assertLocalDbTestGuard } = await import(
  pathToFileURL(join(root, "lib/wexon-local-db-test-guard.ts")).href
);

let allowed;
try {
  allowed = assertLocalDbTestGuard(process.env);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "[db-test-guard] seed PlatformAdmin E2E reddedildi.",
  );
  process.exit(1);
}

console.error(
  `[seed-platform-admin-e2e] guard OK: host=${allowed.host} database=${allowed.database}`,
);

const email =
  process.env.E2E_ADMIN_EMAIL?.trim() ||
  (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ||
  "";

if (!email) {
  console.log("[seed-platform-admin-e2e] skip — no E2E_ADMIN_EMAIL / ADMIN_EMAILS");
  process.exit(0);
}

const emailNormalized = email.trim().toLowerCase();
// Prefer DIRECT_URL for admin tooling when present; both already passed the guard.
const databaseUrl = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("[seed-platform-admin-e2e] DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

// Prisma only after guard passes.
const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

async function main() {
  const existing = await prisma.platformAdmin.findUnique({ where: { emailNormalized } });
  if (existing) {
    if (!existing.isActive) {
      await prisma.platformAdmin.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      console.log("[seed-platform-admin-e2e] reactivated", emailNormalized);
    } else {
      console.log("[seed-platform-admin-e2e] exists", emailNormalized);
    }
    return;
  }

  await prisma.platformAdmin.create({
    data: {
      email,
      emailNormalized,
      displayName: "E2E Platform Admin",
      isActive: true,
    },
  });
  console.log("[seed-platform-admin-e2e] created", emailNormalized);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
