#!/usr/bin/env node
/**
 * Read-only audit of known demo/test fixture accounts in the connected database.
 * Does NOT delete or mutate any rows. Report-only — ask for approval before cleanup.
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
    if (override || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(".env");
loadLocalEnvFile(".env.local", { override: true });

const KNOWN_FIXTURE_EMAILS = ["real@wexon.dev", "inactive@wexon.dev", "demo@wexon.dev"];
const KNOWN_FIXTURE_ORG_SLUGS = ["wexpay-real-test", "wexpay-inactive-test", "mavi-bahce-demo"];
const KNOWN_FIXTURE_QR_PREFIXES = ["WEXPAY-real-test", "WEXPAY-demo"];

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DIRECT_URL or DATABASE_URL required.");
    process.exit(1);
  }

  const adapter = new PrismaPg(connectionString);
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany({
      where: { email: { in: KNOWN_FIXTURE_EMAILS } },
      select: {
        id: true,
        email: true,
        isActive: true,
        passwordHash: true,
        memberships: {
          select: {
            organizationId: true,
            status: true,
            role: true,
            organization: { select: { slug: true, name: true } },
          },
        },
      },
    });

    const orgs = await prisma.organization.findMany({
      where: { slug: { in: KNOWN_FIXTURE_ORG_SLUGS } },
      select: { id: true, slug: true, name: true, status: true },
    });

    const tables = await prisma.restaurantTable.findMany({
      where: {
        OR: KNOWN_FIXTURE_QR_PREFIXES.map((prefix) => ({ qrCode: { startsWith: prefix } })),
      },
      select: { id: true, qrCode: true, label: true, isActive: true, branchId: true },
      take: 50,
    });

    console.log("=== Demo / fixture account audit (READ-ONLY) ===");
    console.log(`Users matched: ${users.length}`);
    for (const user of users) {
      console.log(
        `  - ${user.email} active=${user.isActive} hasHash=${Boolean(user.passwordHash)} memberships=${user.memberships.length}`,
      );
      for (const m of user.memberships) {
        console.log(`      org=${m.organization.slug} status=${m.status} role=${m.role}`);
      }
    }
    console.log(`Organizations matched: ${orgs.length}`);
    for (const org of orgs) {
      console.log(`  - ${org.slug} (${org.name}) status=${org.status}`);
    }
    console.log(`QR tables matched: ${tables.length}`);
    for (const table of tables) {
      console.log(`  - ${table.qrCode} label=${table.label} active=${table.isActive}`);
    }
    console.log("");
    console.log("No rows were deleted. Request explicit approval before any production cleanup.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
