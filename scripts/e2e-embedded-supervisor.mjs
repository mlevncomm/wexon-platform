#!/usr/bin/env node
/**
 * Keeps embedded-postgres alive across npm script boundaries.
 * Usage: node scripts/e2e-embedded-supervisor.mjs <start|stop>
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ISOLATED_E2E_DB } from "./e2e-isolated-guards.mjs";

const root = process.cwd();
const dataDir = resolve(root, "e2e", ".pgdata");
const pidPath = resolve(root, "e2e", ".embedded-pg.pid");
const statePath = resolve(root, "e2e", ".db-runtime.json");
const command = (process.argv[2] || "").trim().toLowerCase();

function stopByPid() {
  if (!existsSync(pidPath)) return;
  const raw = readFileSync(pidPath, "utf8").trim();
  const pid = Number(raw);
  if (Number.isFinite(pid) && pid > 0) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
    } catch {
      /* already gone */
    }
  }
  rmSync(pidPath, { force: true });
}

async function runServer() {
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const { user, password, port, database } = ISOLATED_E2E_DB;
  mkdirSync(dataDir, { recursive: true });

  // Windows Turkish locale names can break initdb (non-ASCII). Force C locale.
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port: Number(port),
    persistent: true,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    onLog: () => undefined,
    onError: (message) => console.error("[embedded-pg]", message),
  });

  if (!existsSync(resolve(dataDir, "PG_VERSION"))) {
    console.log("[embedded-pg] initialise cluster…");
    await pg.initialise();
  }

  console.log(`[embedded-pg] start port=${port}`);
  await pg.start();

  try {
    await pg.createDatabase(database);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(msg)) throw error;
  }

  writeFileSync(
    statePath,
    JSON.stringify({ engine: "embedded", pid: process.pid, startedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  writeFileSync(pidPath, String(process.pid), "utf8");
  console.log(`[embedded-pg] ready pid=${process.pid}`);

  const shutdown = async () => {
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    rmSync(pidPath, { force: true });
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep event loop alive.
  setInterval(() => undefined, 60_000);
}

async function main() {
  if (command === "stop") {
    stopByPid();
    if (existsSync(statePath)) rmSync(statePath, { force: true });
    console.log("[embedded-pg] stopped");
    return;
  }

  if (command === "start") {
    stopByPid();
    const child = spawn(process.execPath, [resolve(root, "scripts", "e2e-embedded-supervisor.mjs"), "serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    // Wait briefly for readiness file.
    const started = Date.now();
    while (Date.now() - started < 60_000) {
      if (existsSync(pidPath) && existsSync(statePath)) {
        console.log("[embedded-pg] supervisor started");
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.error("[embedded-pg] failed to start supervisor");
    process.exit(1);
  }

  if (command === "serve") {
    await runServer();
    return;
  }

  console.error("Usage: node scripts/e2e-embedded-supervisor.mjs <start|stop|serve>");
  process.exit(1);
}

main().catch((error) => {
  console.error("[embedded-pg]", error instanceof Error ? error.message : error);
  process.exit(1);
});
