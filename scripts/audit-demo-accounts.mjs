#!/usr/bin/env node
/**
 * Read-only audit of known demo/test fixture accounts in the connected database.
 * Does NOT delete or mutate any rows. Never prints full connection strings/secrets.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadLocalEnvFile(fileName, { override = false } = {}) {
  const fullPath = resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return { loaded: false, keys: [] };
  const parsed = dotenv.parse(readFileSync(fullPath));
  const keys = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) {
      process.env[key] = value;
      keys.push(key);
    }
  }
  return { loaded: true, keys };
}

function redactConnection(connectionString, preferredKey, provenance) {
  try {
    const u = new URL(connectionString);
    const host = u.hostname;
    const port = u.port || "5432";
    const dbName = (u.pathname || "").replace(/^\//, "") || "(none)";
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(host);
    const isSupabase = host.includes("supabase.com") || host.includes("supabase.co");
    let provider = "postgres";
    if (isSupabase) provider = "supabase";
    else if (host.includes("neon.tech")) provider = "neon";
    else if (isLocalHost) provider = "local-postgres";

    let projectRefRedacted = null;
    let userShape = "(none)";
    if (u.username) {
      if (u.username.includes(".")) {
        const [role, ref] = u.username.split(".", 2);
        userShape = `${role}.<project-ref>`;
        if (ref) {
          projectRefRedacted =
            ref.length <= 8 ? `${ref[0]}… (len=${ref.length})` : `${ref.slice(0, 4)}…${ref.slice(-4)} (len=${ref.length})`;
        }
      } else {
        userShape = "<user>";
      }
    }

    return {
      preferredKey,
      source: provenance[preferredKey] || "unknown",
      protocol: u.protocol.replace(":", ""),
      provider,
      host,
      port,
      dbName,
      userShape,
      projectRefRedacted,
      localOrRemote: isLocalHost ? "local" : "remote",
      passwordPresent: Boolean(u.password),
    };
  } catch {
    return { preferredKey, source: provenance[preferredKey] || "unknown", parseError: true };
  }
}

function classifyTarget(redacted, meta) {
  const reasons = [];
  let label = "UNKNOWN";

  if (redacted.localOrRemote === "local") {
    label = "LOCAL";
    reasons.push("DB host is localhost");
  } else {
    reasons.push(`DB host is remote (${redacted.host})`);
  }

  if (meta.nextPublicAppUrlHost === "localhost:3000" || meta.nextPublicAppUrlHost?.startsWith("localhost:")) {
    reasons.push(`NEXT_PUBLIC_APP_URL points to ${meta.nextPublicAppUrlHost}`);
  }
  if (!meta.vercelEnv) reasons.push("VERCEL_ENV unset");
  if (meta.vercelEnv === "production") reasons.push("VERCEL_ENV=production");
  if (meta.connectionSource !== "vercel-production-env") {
    reasons.push(`connection source is ${meta.connectionSource}, not Vercel production env`);
  }

  // Hard rule: remote Supabase alone is NOT proof of production.
  const provenProduction =
    meta.vercelEnv === "production" && meta.connectionSource === "vercel-production-env";
  const provenLocal = redacted.localOrRemote === "local";

  if (provenProduction) label = "PRODUCTION";
  else if (provenLocal) label = "LOCAL";
  else label = "REMOTE_UNVERIFIED"; // shared/staging/prod-like — not proven

  return { label, provenProduction, provenLocal, reasons };
}

const envLoad = loadLocalEnvFile(".env");
const localLoad = loadLocalEnvFile(".env.local", { override: true });

const provenance = {};
if (envLoad.loaded) {
  for (const key of ["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_ENV", "NODE_ENV"]) {
    if (envLoad.keys.includes(key) || (existsSync(resolve(process.cwd(), ".env")) && dotenv.parse(readFileSync(resolve(process.cwd(), ".env")))[key])) {
      // resolve carefully: if key came from .env and wasn't overridden by .env.local
      if (!localLoad.keys.includes(key)) provenance[key] = ".env";
    }
  }
}
if (localLoad.loaded) {
  for (const key of localLoad.keys) {
    if (["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_ENV", "NODE_ENV"].includes(key)) {
      provenance[key] = ".env.local";
    }
  }
}
// Shell/CI wins if already set before script (this script only fills when unset, except .env.local override)
// After loads above, report file presence for URL keys:
const envHas = envLoad.loaded
  ? dotenv.parse(readFileSync(resolve(process.cwd(), ".env")))
  : {};
const localHas = localLoad.loaded
  ? dotenv.parse(readFileSync(resolve(process.cwd(), ".env.local")))
  : {};

if (localHas.DATABASE_URL) provenance.DATABASE_URL = ".env.local";
else if (envHas.DATABASE_URL) provenance.DATABASE_URL = ".env";
if (localHas.DIRECT_URL) provenance.DIRECT_URL = ".env.local";
else if (envHas.DIRECT_URL) provenance.DIRECT_URL = ".env";
if (localHas.NEXT_PUBLIC_APP_URL) provenance.NEXT_PUBLIC_APP_URL = ".env.local";
else if (envHas.NEXT_PUBLIC_APP_URL) provenance.NEXT_PUBLIC_APP_URL = ".env";

const KNOWN_FIXTURE_EMAILS = ["real@wexon.dev", "inactive@wexon.dev", "demo@wexon.dev"];
const KNOWN_FIXTURE_ORG_SLUGS = ["wexpay-real-test", "wexpay-inactive-test", "mavi-bahce-demo"];
const KNOWN_FIXTURE_QR_PREFIXES = ["WEXPAY-real-test", "WEXPAY-demo"];

async function main() {
  const preferredKey = process.env.DIRECT_URL ? "DIRECT_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : null;
  const connectionString = preferredKey ? process.env[preferredKey] : null;
  if (!connectionString) {
    console.error("DIRECT_URL or DATABASE_URL required.");
    process.exit(1);
  }

  let nextPublicAppUrlHost = null;
  try {
    nextPublicAppUrlHost = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : null;
  } catch {
    nextPublicAppUrlHost = "(invalid)";
  }

  const redacted = redactConnection(connectionString, preferredKey, provenance);
  const meta = {
    connectionSource: provenance[preferredKey] || "unknown",
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    nextPublicAppUrlHost,
    nextPublicAppUrlSource: provenance.NEXT_PUBLIC_APP_URL || null,
    filesPresent: { env: envLoad.loaded, envLocal: localLoad.loaded },
    urlKeysInEnv: {
      DATABASE_URL: Boolean(envHas.DATABASE_URL),
      DIRECT_URL: Boolean(envHas.DIRECT_URL),
    },
    urlKeysInEnvLocal: {
      DATABASE_URL: Boolean(localHas.DATABASE_URL),
      DIRECT_URL: Boolean(localHas.DIRECT_URL),
    },
  };
  const target = classifyTarget(redacted, meta);

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
            organization: { select: { id: true, slug: true, name: true, isActive: true, isDemo: true } },
          },
        },
      },
    });

    const orgs = await prisma.organization.findMany({
      where: { slug: { in: KNOWN_FIXTURE_ORG_SLUGS } },
      select: { id: true, slug: true, name: true, isActive: true, isDemo: true },
    });

    const tables = await prisma.restaurantTable.findMany({
      where: {
        OR: KNOWN_FIXTURE_QR_PREFIXES.map((prefix) => ({ qrCode: { startsWith: prefix } })),
      },
      select: { id: true, qrCode: true, label: true, isActive: true, branchId: true },
      take: 50,
    });

    console.log("=== Connection provenance (READ-ONLY, redacted) ===");
    console.log(`preferredKey: ${redacted.preferredKey}`);
    console.log(`source: ${redacted.source}`);
    console.log(`provider: ${redacted.provider}`);
    console.log(`host: ${redacted.host}`);
    console.log(`port: ${redacted.port}`);
    console.log(`dbName: ${redacted.dbName}`);
    console.log(`userShape: ${redacted.userShape}`);
    console.log(`projectRefRedacted: ${redacted.projectRefRedacted}`);
    console.log(`localOrRemote: ${redacted.localOrRemote}`);
    console.log(`files: .env=${meta.filesPresent.env} .env.local=${meta.filesPresent.envLocal}`);
    console.log(`url in .env: DATABASE_URL=${meta.urlKeysInEnv.DATABASE_URL} DIRECT_URL=${meta.urlKeysInEnv.DIRECT_URL}`);
    console.log(
      `url in .env.local: DATABASE_URL=${meta.urlKeysInEnvLocal.DATABASE_URL} DIRECT_URL=${meta.urlKeysInEnvLocal.DIRECT_URL}`,
    );
    console.log(`NEXT_PUBLIC_APP_URL host: ${meta.nextPublicAppUrlHost} (source=${meta.nextPublicAppUrlSource})`);
    console.log(`VERCEL_ENV: ${meta.vercelEnv ?? "(unset)"}`);
    console.log(`NODE_ENV: ${meta.nodeEnv ?? "(unset)"}`);
    console.log(`targetClassification: ${target.label}`);
    for (const reason of target.reasons) console.log(`  - ${reason}`);
    console.log(`provenProduction: ${target.provenProduction}`);
    console.log("");

    console.log("=== Demo / fixture account audit (READ-ONLY) ===");
    console.log(`Users matched: ${users.length}`);
    for (const user of users) {
      console.log(
        `  - id=${user.id} email=${user.email} isActive=${user.isActive} hasHash=${Boolean(user.passwordHash)}`,
      );
      for (const m of user.memberships) {
        console.log(
          `      membership orgId=${m.organization.id} slug=${m.organization.slug} orgActive=${m.organization.isActive} orgDemo=${m.organization.isDemo} status=${m.status} role=${m.role}`,
        );
      }
    }
    console.log(`Organizations matched: ${orgs.length}`);
    for (const org of orgs) {
      console.log(
        `  - id=${org.id} slug=${org.slug} name=${org.name} isActive=${org.isActive} isDemo=${org.isDemo}`,
      );
    }
    console.log(`QR tables matched: ${tables.length}`);
    for (const table of tables) {
      console.log(
        `  - id=${table.id} qrCode=${table.qrCode} label=${table.label} isActive=${table.isActive} branchId=${table.branchId}`,
      );
    }
    console.log("");
    console.log("No rows were deleted or modified.");

    if (!target.provenProduction) {
      console.log("");
      console.log("BLOCKED: DB target production olarak doğrulanamadı.");
      process.exitCode = 0;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.name || "Error", error?.message || error);
  process.exit(1);
});
