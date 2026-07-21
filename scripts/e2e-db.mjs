#!/usr/bin/env node
/**
 * Local isolated Postgres lifecycle for WexPay E2E.
 * Prefers Docker Compose; falls back to embedded-postgres when Docker is unavailable.
 * Usage: node scripts/e2e-db.mjs <up|down|reset|prepare|wait>
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyIsolatedE2eEnv,
  assertIsolatedWexPayDatabase,
  describeDatabaseSafely,
  ISOLATED_E2E_DB,
  isolatedE2eConnectionUrl,
} from "./e2e-isolated-guards.mjs";

const root = process.cwd();
const composeFile = resolve(root, ISOLATED_E2E_DB.composeFile);
const command = (process.argv[2] || "").trim().toLowerCase();
const statePath = resolve(root, "e2e", ".db-runtime.json");
const embeddedDataDir = resolve(root, "e2e", ".pgdata");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...(options.env || {}) },
    ...options,
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function tryDocker() {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function writeState(state) {
  mkdirSync(resolve(root, "e2e"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

function readState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function compose(args) {
  if (!existsSync(composeFile)) {
    console.error(`[e2e-db] missing ${ISOLATED_E2E_DB.composeFile}`);
    process.exit(1);
  }
  run("docker", ["compose", "-f", composeFile, ...args]);
}

async function up() {
  applyIsolatedE2eEnv();
  if (tryDocker()) {
    compose(["up", "-d", "--wait"]);
    writeState({ engine: "docker", startedAt: new Date().toISOString() });
    console.log("[e2e-db] docker compose postgres is up");
    return;
  }

  console.warn("[e2e-db] Docker unavailable — using embedded-postgres fallback");
  // Spawn a detached supervisor that keeps the cluster alive.
  const supervisor = resolve(root, "scripts", "e2e-embedded-supervisor.mjs");
  const child = spawnSync(process.execPath, [supervisor, "start"], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if ((child.status ?? 1) !== 0) process.exit(child.status ?? 1);
}

async function down() {
  const state = readState();
  if (state?.engine === "embedded" || (!tryDocker() && existsSync(statePath))) {
    const supervisor = resolve(root, "scripts", "e2e-embedded-supervisor.mjs");
    spawnSync(process.execPath, [supervisor, "stop"], { stdio: "inherit", shell: false });
    return;
  }
  if (tryDocker()) {
    compose(["down"]);
  }
  if (existsSync(statePath)) rmSync(statePath, { force: true });
}

async function reset() {
  await down();
  if (existsSync(embeddedDataDir)) {
    rmSync(embeddedDataDir, { recursive: true, force: true });
  }
  if (tryDocker()) {
    compose(["down", "-v"]);
  }
  await up();
}

async function waitReady(timeoutMs = 90_000) {
  applyIsolatedE2eEnv();
  const started = Date.now();
  const { default: pg } = await import("pg");
  const url = isolatedE2eConnectionUrl();
  while (Date.now() - started < timeoutMs) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      const desc = describeDatabaseSafely(url);
      console.log(`[e2e-db] ready host=${desc?.host} port=${desc?.port} db=${desc?.database}`);
      return;
    } catch {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error("[e2e-db] Postgres did not become ready in time");
  process.exit(1);
}

async function ensureIsolatedTestRoles() {
  assertIsolatedWexPayDatabase("e2e:db:roles");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: isolatedE2eConnectionUrl() });
  await client.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wexon_app') THEN
          CREATE ROLE wexon_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT;
        END IF;
      END
      $$;
    `);
  } finally {
    await client.end();
  }
  console.log("[e2e-db] isolated RLS test roles ready");
}

async function prepare() {
  applyIsolatedE2eEnv();
  assertIsolatedWexPayDatabase("e2e:db:prepare");
  console.log("[e2e-db] isolated safety assertion passed");
  await ensureIsolatedTestRoles();

  run("npx", ["prisma", "generate"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
    },
  });

  run("npx", ["prisma", "migrate", "deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
    },
  });

  run("node", ["prisma/seed.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      WEXON_E2E_TARGET: "isolated",
      WEXON_E2E_CONFIRM_ISOLATED: "true",
    },
  });

  run("node", ["prisma/seed-real-tenant.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      WEXON_E2E_TARGET: "isolated",
      WEXON_E2E_CONFIRM_ISOLATED: "true",
      WEXON_E2E_SEED_ISOLATED: "true",
    },
  });

  console.log("[e2e-db] fixture prepare complete");
}

async function main() {
  switch (command) {
    case "up":
      await up();
      break;
    case "down":
      await down();
      break;
    case "reset":
      await reset();
      break;
    case "wait":
      await waitReady();
      break;
    case "prepare":
      await waitReady();
      await prepare();
      break;
    default:
      console.error("Usage: node scripts/e2e-db.mjs <up|down|reset|wait|prepare>");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("[e2e-db]", error instanceof Error ? error.message : error);
  process.exit(1);
});
