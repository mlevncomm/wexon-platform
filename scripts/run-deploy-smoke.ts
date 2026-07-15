/**
 * Read-only PayTR-off deployment smoke against a running origin.
 *
 * Usage: tsx scripts/run-deploy-smoke.ts
 * Base URL: DEPLOY_SMOKE_BASE_URL || SMOKE_BASE_URL || E2E_BASE_URL || NEXT_PUBLIC_APP_URL
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

function loadLocalEnvFiles() {
  for (const rel of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const parsed = dotenv.parse(readFileSync(path, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadLocalEnvFiles();

const PAGE_LEAK_PATTERNS = [
  /DATABASE_URL/i,
  /DIRECT_URL/i,
  /API_KEY_HASH_SECRET/i,
  /ADMIN_SESSION_SECRET/i,
  /CUSTOMER_SESSION_SECRET/i,
  /postgresql:\/\/[^"'\s]+/i,
  /merchant_salt/i,
  /merchant_key/i,
];

const API_LEAK_PATTERNS = [
  ...PAGE_LEAK_PATTERNS,
  /"organizationId"/,
  /"riskReasons"/,
  /PrismaClient/,
  /prisma\.postgres/i,
  /at Object\./,
];

function resolveBaseUrl() {
  const raw =
    process.env.DEPLOY_SMOKE_BASE_URL?.trim() ||
    process.env.SMOKE_BASE_URL?.trim() ||
    process.env.E2E_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "deploy:smoke requires DEPLOY_SMOKE_BASE_URL (or SMOKE_BASE_URL / E2E_BASE_URL / NEXT_PUBLIC_APP_URL).",
    );
  }
  return raw.replace(/\/$/, "");
}

function assertNoLeaks(label: string, body: string, api = false) {
  const patterns = api ? API_LEAK_PATTERNS : PAGE_LEAK_PATTERNS;
  for (const pattern of patterns) {
    if (pattern.test(body)) {
      throw new Error(`[deploy:smoke] ${label}: possible secret/internal leak matching ${pattern}`);
    }
  }
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    headers: {
      Accept: "application/json, text/html;q=0.9,*/*;q=0.8",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  return { response, text };
}

function assertMutationBlocked() {
  const target = (process.env.WEXON_E2E_TARGET ?? "").trim().toLowerCase();
  const confirmProduction = process.env.WEXON_E2E_CONFIRM_PRODUCTION === "true";
  if (target === "production" || confirmProduction || process.env.VERCEL_ENV === "production") {
    console.log("[deploy:smoke] production-confirmed — mutation probes skipped (read-only).");
    return true;
  }
  return false;
}

async function main() {
  const base = resolveBaseUrl();
  console.log(`[deploy:smoke] base=${base}`);
  assertMutationBlocked();

  const checks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: "GET /",
      run: async () => {
        const { response, text } = await fetchText(`${base}/`);
        if (response.status >= 500) throw new Error(`GET / → ${response.status}`);
        assertNoLeaks("/", text);
      },
    },
    {
      name: "GET /products/wexpay",
      run: async () => {
        const { response, text } = await fetchText(`${base}/products/wexpay`);
        if (response.status >= 500) throw new Error(`/products/wexpay → ${response.status}`);
        assertNoLeaks("/products/wexpay", text);
      },
    },
    {
      name: "GET /packages",
      run: async () => {
        const { response, text } = await fetchText(`${base}/packages`);
        if (response.status >= 500) throw new Error(`/packages → ${response.status}`);
        assertNoLeaks("/packages", text);
      },
    },
    {
      name: "GET /dashboard/login",
      run: async () => {
        const { response, text } = await fetchText(`${base}/dashboard/login`);
        if (response.status >= 500) throw new Error(`/dashboard/login → ${response.status}`);
        assertNoLeaks("/dashboard/login", text);
      },
    },
    {
      name: "GET /admin/login",
      run: async () => {
        const { response, text } = await fetchText(`${base}/admin/login`);
        if (response.status >= 500) throw new Error(`/admin/login → ${response.status}`);
        assertNoLeaks("/admin/login", text);
      },
    },
    {
      name: "GET /api/health",
      run: async () => {
        const { response, text } = await fetchText(`${base}/api/health`);
        if (response.status !== 200) throw new Error(`/api/health → ${response.status}`);
        const json = JSON.parse(text) as { status?: string; service?: string };
        if (json.status !== "ok" || json.service !== "wexon-platform") {
          throw new Error(`/api/health unexpected body`);
        }
        const cache = response.headers.get("cache-control") ?? "";
        if (!/no-store/i.test(cache)) {
          console.warn("[deploy:smoke] warning: /api/health missing Cache-Control no-store");
        }
        assertNoLeaks("/api/health", text, true);
      },
    },
    {
      name: "GET /api/health/ready",
      run: async () => {
        const { response, text } = await fetchText(`${base}/api/health/ready`);
        if (![200, 503].includes(response.status)) {
          throw new Error(`/api/health/ready → ${response.status}`);
        }
        const json = JSON.parse(text) as { status?: string };
        if (response.status === 200 && json.status !== "ready") {
          throw new Error(`/api/health/ready expected status ready`);
        }
        if (response.status === 503 && json.status !== "not_ready") {
          throw new Error(`/api/health/ready expected status not_ready`);
        }
        if (Object.keys(json).length !== 1) {
          throw new Error(`/api/health/ready must only expose status`);
        }
        assertNoLeaks("/api/health/ready", text, true);
      },
    },
    {
      name: "invalid public QR",
      run: async () => {
        const { response, text } = await fetchText(
          `${base}/api/wexpay/public/definitely-invalid-qr-token-zzzz`,
        );
        if (![403, 404].includes(response.status)) {
          throw new Error(`invalid QR → ${response.status}`);
        }
        assertNoLeaks("invalid QR", text, true);
      },
    },
    {
      name: "PayTR-off checkout probe (invalid QR only)",
      run: async () => {
        // Do not create checkout intents against real tables in production.
        const { response, text } = await fetchText(
          `${base}/api/wexpay/public/definitely-invalid-qr-token-zzzz/checkout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `deploy-smoke-${Date.now()}`,
            },
            body: JSON.stringify({}),
          },
        );
        // Invalid QR should 404/403 before provider — still assert no leak / no 5xx stack.
        if (response.status >= 500 && response.status !== 503) {
          throw new Error(`checkout invalid QR → ${response.status}`);
        }
        assertNoLeaks("checkout invalid QR", text, true);
        if (text.includes("token") && /paytr/i.test(text) && /merchant/i.test(text)) {
          throw new Error("checkout response appears to expose provider secrets");
        }
      },
    },
  ];

  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`[deploy:smoke] ok — ${check.name}`);
    } catch (error) {
      failed += 1;
      console.error(
        `[deploy:smoke] FAIL — ${check.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (failed > 0) {
    console.error(`[deploy:smoke] ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log("[deploy:smoke] passed (read-only, PayTR-off).");
}

main().catch((error) => {
  console.error("[deploy:smoke]", error instanceof Error ? error.message : error);
  process.exit(1);
});
