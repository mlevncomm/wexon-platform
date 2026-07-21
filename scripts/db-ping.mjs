import { resolve } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

function loadEnv() {
  const root = process.cwd();
  for (const file of [".env", ".env.local"]) {
    const path = resolve(root, file);
    try {
      dotenv.config({ path, override: file === ".env.local", quiet: true });
    } catch {
      // ignore missing files
    }
  }
}

function describeDatabaseUrl(name, value) {
  if (!value) {
    console.log(`${name}: (not set)`);
    return null;
  }

  try {
    const url = new URL(value);
    console.log(`${name}: ${url.hostname}:${url.port || "5432"}${url.pathname} (user: ${url.username})`);
    return url;
  } catch {
    console.log(`${name}: (invalid URL)`);
    return null;
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;
const runtimeUrl = databaseUrl ?? directUrl;

console.log("[db:ping] Environment");
describeDatabaseUrl("DATABASE_URL", databaseUrl);
describeDatabaseUrl("DIRECT_URL", directUrl);

if (!runtimeUrl) {
  console.error("\n[db:ping] FAILED: DATABASE_URL or DIRECT_URL is required.");
  process.exit(1);
}

if (runtimeUrl.includes("localhost") || runtimeUrl.includes("127.0.0.1")) {
  console.warn(
    "\n[db:ping] WARNING: connection string points to localhost.",
    "If you use Supabase, copy DATABASE_URL + DIRECT_URL from Vercel or Supabase Dashboard → Connect.",
  );
}

const pool = new pg.Pool({
  connectionString: runtimeUrl,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ssl: runtimeUrl.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
});

try {
  const result = await pool.query("select 1 as ok");
  console.log(`\n[db:ping] OK — connected (${result.rows[0]?.ok})`);
  process.exit(0);
} catch (error) {
  console.error("\n[db:ping] FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end().catch(() => undefined);
}
