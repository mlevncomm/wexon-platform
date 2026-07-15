# Isolated WexPay E2E environment

Fail-closed local Postgres for licensed WexPay fixture + mutation Playwright suites.

## Why

Shared/remote Supabase must never receive seed or test mutations. Mutation E2E only runs when **all** of these are true:

- `WEXON_E2E_TARGET=isolated`
- `WEXON_E2E_CONFIRM_ISOLATED=true`
- `DATABASE_URL` / `DIRECT_URL` point at the same local host + e2e database name (`wexon_e2e`)
- Host is `127.0.0.1` / `localhost` / `host.docker.internal` (not Supabase/Neon/pooler)
- `VERCEL_ENV` is not `production`
- Classification is not `production-confirmed`

`WEXON_E2E_TARGET=isolated` alone is **not** enough.

## Quick start

```bash
npm run e2e:db:up
npm run e2e:db:prepare
npm run test:e2e:wexpay-isolated
```

Or one shot (also runs the suite twice for cleanup/idempotency):

```bash
node scripts/run-wexpay-isolated-e2e.mjs --twice
```

`e2e:db:up` prefers Docker Compose (`docker-compose.e2e.yml`). If Docker is unavailable, it falls back to `embedded-postgres` on port `5433`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run e2e:db:up` | Start isolated Postgres |
| `npm run e2e:db:down` | Stop isolated Postgres |
| `npm run e2e:db:reset` | Wipe volume/data and restart |
| `npm run e2e:db:prepare` | Assert isolated → `prisma generate` → `migrate deploy` → licensed seed |
| `npm run test:e2e:wexpay-ops:mutation` | Ops mutation Playwright |
| `npm run test:e2e:wexpay-guest:mutation` | Guest mutation Playwright |
| `npm run test:e2e:wexpay-isolated` | Full orchestration |
| `npm run e2e:cleanup:wexpay` | Marker-scoped cleanup |

## Fixture

Deterministic org `wexpay-real-test`, user `real@wexon.dev`, QR `WEXPAY-real-test-MASA-01` (+ `MASA-02`), inactive sibling tenant. Seed refuses shared/production.

## Safety

- Production-confirmed: mutation hard-block (no allow-flag bypass)
- Shared remote-unverified: mutation 0 / seed 0
- Cleanup deletes only marker / fixture-scoped rows; never `deleteMany({})` globals

## Out of scope (PR 2 / PR 3)

Rate limits, opaque QR tokens, health endpoint, Vercel deployment, PayTR activation, modifiers/allergens/branding.
