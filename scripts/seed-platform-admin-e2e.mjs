#!/usr/bin/env node
/**
 * Upsert an ACTIVE PlatformAdmin for local/CI admin E2E.
 * Uses E2E_ADMIN_EMAIL / ADMIN_EMAILS — never for production cutover.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  const parsed = dotenv.parse(readFileSync(fullPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

if (process.env.VERCEL_ENV === "production") {
  throw new Error("Refusing to seed PlatformAdmin E2E fixture on Vercel production.");
}

const email =
  process.env.E2E_ADMIN_EMAIL?.trim() ||
  (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ||
  "";

if (!email) {
  console.log("[seed-platform-admin-e2e] skip — no E2E_ADMIN_EMAIL / ADMIN_EMAILS");
  process.exit(0);
}

const emailNormalized = email.trim().toLowerCase();
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL required");
}

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
