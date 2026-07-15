# WexPay deployment readiness

This document describes how to prepare a **Vercel production** deploy for Wexon/WexPay **with PayTR virtual POS still off**. It does not authorize live PayTR charges, schema changes, or production seeds.

## A. Vercel environment matrix

### Production

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Runtime / serverless pooler connection (e.g. Supabase pooler) |
| `DIRECT_URL` | Direct Postgres for Prisma migrate and admin tooling |
| `ADMIN_EMAILS` | Allowlisted admin emails |
| `ADMIN_LOGIN_PASSWORD` | Admin bootstrap password (min 12, no placeholders) |
| `ADMIN_SESSION_SECRET` | Signed admin session (≥32, non-placeholder) |
| `CUSTOMER_SESSION_SECRET` | Signed customer session (≥32, non-placeholder) |
| `API_KEY_HASH_SECRET` | **Required** — API key hashing (≥32, no fallback) |
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS public origin (no localhost) |
| `MAINTENANCE_MODE` | Explicit `true` / `false` |
| `WEXPAY_PAYTR_ENABLE_API` | **Must be `false`** for this readiness stage |

Forbidden in production (must be unset): `CUSTOMER_DEV_LOGIN_PASSWORD`, `WEXON_E2E_RELAX_RATE_LIMIT`, `WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT`, `WEXON_PUBLIC_ASSIST_COOLDOWN_MS`.

PSP optional until virtual POS: `WEXPAY_CREDENTIAL_ENCRYPTION_KEY` (use `production:check:psp` when enabling).

### Preview

- Do **not** reuse production secrets or production database URLs.
- Point at an isolated/preview database with non-customer data.
- Keep `WEXPAY_PAYTR_ENABLE_API=false`.

### Development

- Local `.env` / `.env.local`.
- Isolated E2E DB (`wexon_e2e` on `127.0.0.1:5433`) is separate from developer app DB — see `docs/wexpay-isolated-e2e.md`.

## B. Release sequence

1. `main` clean and green CI
2. `npm run deploy:preflight` (env + generate + tsc + lint + build + unit; **no migrate**)
3. Confirm Vercel Production env matches the matrix (`npm run production:check` with production-like `VERCEL_ENV` where applicable)
4. Database backup / inspection on the ops side
5. **Only if pending migrations exist:** `npx prisma migrate deploy` using `DIRECT_URL` (never `db push` / `migrate reset`)
6. Promote / deploy on Vercel (`prisma generate && next build` already in `npm run build`)
7. `GET /api/health` → `{ status: "ok", service: "wexon-platform" }`
8. `GET /api/health/ready` → `{ status: "ready" }` (503 `not_ready` is generic on failure)
9. `DEPLOY_SMOKE_BASE_URL=https://… npm run deploy:smoke` (read-only)
10. Check Vercel / application logs for errors (no secret dumps)
11. Rollback decision if health/ready/smoke fail

## C. Rollback

- Instant: revert to the previous Vercel deployment.
- Schema rollback is **not** automatic. This readiness PR ships **zero** Prisma migrations; if a future migration was applied, plan a manual reverse migration before rolling app code that depends on it.
- Do not run `prisma migrate reset` against production.

## D. Distributed rate-limit warning

Public QR + health probes use an **in-memory, per-process** limiter (`lib/wexon-rate-limit.ts`). On multi-instance Vercel:

- Limits do not coordinate across isolates
- Cold starts reset counters
- Attackers can amplify effective quotas

Before high public QR traffic, decide on Redis/Upstash, Cloudflare WAF rate limiting, or an equivalent edge control. See `docs/wexpay-public-api-rate-limits.md`.

## DATABASE_URL vs DIRECT_URL

| URL | Use |
|-----|-----|
| `DATABASE_URL` | App runtime (`lib/prisma.ts` pool, default `PRISMA_PG_POOL_MAX=1` for serverless) |
| `DIRECT_URL` | Migrations / tooling that must bypass pooler |

Connection reuse: Prisma client is stored on `globalThis` to survive warm serverless invocations. Keep pool `max` low (1–3) on serverless to avoid exhaustion.

## Migration policy

- `prisma generate` — safe in build
- `prisma migrate deploy` — **controlled release step**, not wired into `deploy:preflight`
- Never: `prisma db push`, `migrate reset`, automatic seed, `prisma:seed:real` on production (hard-blocked in seed scripts)

Do **not** auto-run migrations inside the Vercel build command.

## Health endpoints

| Route | Meaning | Status |
|-------|---------|--------|
| `GET /api/health` | Process liveness | 200 |
| `GET /api/health/ready` | Read-only `SELECT 1` | 200 ready / 503 not_ready |

Responses never include connection strings, hostnames, stacks, or Prisma messages. Rate-limited (`healthProbe` 120/min/IP). `Cache-Control: no-store`.

## Commands

```bash
npm run production:check
npm run deploy:preflight
DEPLOY_SMOKE_BASE_URL=https://www.example.com npm run deploy:smoke
```

## Node / Vercel runtime

- `package.json` `engines.node`: `>=20`
- GitHub CI uses Node **24**
- Prefer Node 20 LTS or 22/24 on Vercel — match CI when possible
- API routes that use Prisma / `pg` require the **nodejs** runtime (health/ready set `runtime = "nodejs"`)
- Embedded Postgres and Docker Compose E2E files are local-only; they are not part of the production runtime

## Security headers

Configured in `next.config.ts` (CSP, HSTS in production, frame-ancestors none, etc.). Do not loosen CSP with `unsafe-eval` in production. Health routes add explicit `no-store`.

## Trusted proxy / base URL

Canonical absolute URLs come from `NEXT_PUBLIC_APP_URL` (and related public origin env), not from untrusted `Host` headers. Public rate-limit IP resolution prefers platform headers (`x-vercel-forwarded-for` → `cf-connecting-ip` → `x-real-ip` → rightmost `x-forwarded-for`) — see PR #26.

## PayTR-off production behavior

With `WEXPAY_PAYTR_ENABLE_API=false`:

- Public menu / order / waiter / payment-request notification paths remain available per product rules
- Checkout returns honest **503** `checkout_unavailable` (no provider call, no fake paid UX)
