# Demo / test account shutdown

## Goal

Production must not accept demo, fixture, or development login bypasses. Local and E2E fixtures remain available only under explicit non-production guards.

## Closed in production (code + env)

| Path | Status |
|------|--------|
| `CUSTOMER_DEV_LOGIN_PASSWORD` bypass (users without `passwordHash`) | Runtime blocked when `NODE_ENV` or `VERCEL_ENV` is `production` |
| `WEXON_E2E_RELAX_RATE_LIMIT` | Ignored on hosted Vercel production; `production:check` fails if set |
| Public interactive `/demo/wexpay*` sandbox | **Removed** (marketing lead form `/demo-request` remains; product page `/products/wexpay`) |
| Hardcoded demo credentials on marketing pages | E2E asserts they are not advertised |
| Production E2E seed password fallback | Disabled when targeting production hosts |

## Production DB disable / archive (2026-07-12)

Applied after `PRODUCTION DISABLE ONAY` and live production proof.  
**Non-destructive only** — rows were **not** permanently deleted; password hashes were **not** removed; no cascade deletes.

| Entity | Change |
|--------|--------|
| User `real@wexon.dev` | `isActive=false` |
| User `demo@wexon.dev` | `isActive=false` |
| Org `wexpay-real-test` | `isActive=false`, `isDemo=true` |
| Org `wexpay-inactive-test` | `isActive=false`, `isDemo=true` |
| Org `mavi-bahce-demo` | `isActive=false`, `isDemo=true` |
| QR `WEXPAY-real-test-MASA-01` | `isActive=false` |

Verified on production:

- Fixture QR page shows invalid/closed state
- QR API returns 404 `Masa bulunamadı.`
- `real@` / `demo@` login blocked
- Public marketing routes still healthy
- `admin.wexon.dev` Cloudflare Access challenge still active

Rollback requires a **separate** explicit approval (do not treat seed as silent rollback).

## Forbidden production env vars

Must be **unset** on Vercel production:

- `CUSTOMER_DEV_LOGIN_PASSWORD`
- `WEXON_E2E_RELAX_RATE_LIMIT`

Enforced by:

- `npm run production:check` (`scripts/check-production-env.mjs`)
- `scripts/production-signoff-env-check.mjs`
- Runtime helpers in `lib/wexon-production-guards.ts`

Also keep PayTR live charge gated:

- `WEXPAY_PAYTR_ENABLE_API=false` unless an intentional Canlıya Geçiş with verified LIVE merchant credentials is approved

## Local / E2E fixture rules

Fixtures may run when **not** on hosted Vercel production:

1. `VERCEL_ENV` is not `production`
2. `WEXON_E2E_TARGET` is `local`, `test`, or unset (not `production`)
3. For rate-limit relax: `WEXON_E2E_RELAX_RATE_LIMIT=true`  
   Playwright local webServer sets this. Local `next start` uses `NODE_ENV=production`; relax is still allowed when target is local and `VERCEL_ENV` is unset.
4. For customer password fallback: only local/test targets may use seeded `Wexon-Customer-2026`
5. `CUSTOMER_DEV_LOGIN_PASSWORD` bypass remains off whenever `NODE_ENV=production` (including local `next start`)

Seed script:

- `npm run prisma:seed:real` — refuses when `NODE_ENV`/`VERCEL_ENV` is `production`
- Upserts org `wexpay-real-test` / user `real@wexon.dev` for E2E

### Warning — shared remote DB

If local `.env` `DIRECT_URL` points at the **same** Supabase project used by production (as in this rollout), then:

- Production fixture disable will make local E2E fixtures appear inactive (`fixturesReady=false` / skips).
- Running `npm run prisma:seed:real` against that URL can **re-activate** fixture users/orgs/QR on the shared DB.
- Prefer a dedicated local/staging database for E2E. Never seed production intentionally.

Read-only audit:

```bash
npm run audit:demo-accounts
```

## Marketing vs login

| Surface | Allowed in production? |
|---------|------------------------|
| `/demo-request`, `/book-demo` lead capture | Yes |
| `/products/wexpay` product marketing | Yes |
| `/links` directory | Yes (no demo login credentials) |
| `/demo/wexpay` interactive sandbox | No — removed |
| Demo account login / shared fixture password | No |
| Dev login notice on customer login page | Only when `isCustomerDevLoginAllowed()` |

## Logout cleanup

Customer and admin logout now clear:

- `wexon_customer_session`
- `wexon_admin_session_v2` (legacy `wexon_admin_session` ignored)
- `wexon_active_organization_id`
