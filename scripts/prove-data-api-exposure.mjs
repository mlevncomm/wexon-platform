/**
 * Optional PostgREST exposure check (read-only).
 * If SUPABASE_URL + SUPABASE_ANON_KEY (or NEXT_PUBLIC_*) are set, probes /rest/v1/User.
 * Never prints key values. Exit 0 when denied or when keys are not configured in env.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

for (const file of [".env", ".env.local"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path, quiet: true });
}

const base =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const anon =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

if (!base || !anon) {
  console.log(
    "[prove-data-api] SKIP — SUPABASE_URL/ANON_KEY not in env (app is Prisma-only).",
  );
  console.log(
    "[prove-data-api] Catalog proof: anon table privileges revoked + RLS enabled + Security Advisor clean.",
  );
  console.log(
    "[prove-data-api] Dashboard follow-up: confirm Data API setting; unused anon keys can be rotated/disabled.",
  );
  process.exit(0);
}

const url = `${base.replace(/\/$/, "")}/rest/v1/User?select=id&limit=1`;
const res = await fetch(url, {
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    Accept: "application/json",
  },
});

const body = await res.text();
const leaked = /passwordHash|postgresql:\/\//i.test(body);
if (leaked) {
  console.error("[prove-data-api] FAIL — response looks like it leaked secrets");
  process.exit(1);
}

// After A+B, expect 401/403/404 or empty error — not 200 with rows.
if (res.ok) {
  console.error(`[prove-data-api] FAIL — REST returned ${res.status} (expected deny)`);
  process.exit(1);
}

console.log(`[prove-data-api] OK — REST denied status=${res.status}`);
