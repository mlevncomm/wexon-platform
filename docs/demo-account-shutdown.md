# Demo / test account shutdown

## Goal

Production must not accept demo, fixture, or development login bypasses. Local and E2E fixtures remain available only under explicit non-production guards.

## Closed in production

| Path | Status |
|------|--------|
| `CUSTOMER_DEV_LOGIN_PASSWORD` bypass (users without `passwordHash`) | Runtime blocked when `NODE_ENV` or `VERCEL_ENV` is `production`; also blocked unless local/test E2E target |
| `WEXON_E2E_RELAX_RATE_LIMIT` | Ignored at runtime in production; `production:check` fails if set |
| Public interactive `/demo/wexpay*` sandbox | Already removed (marketing lead form `/demo-request` remains) |
| Hardcoded demo credentials on marketing pages | E2E asserts they are not advertised |
| Production E2E seed password fallback (`Wexon-Customer-2026`) | Disabled when `WEXON_E2E_TARGET=production` or base URL looks like `wexon.dev` |

## Forbidden production env vars

Must be **unset** on Vercel production:

- `CUSTOMER_DEV_LOGIN_PASSWORD`
- `WEXON_E2E_RELAX_RATE_LIMIT`

Enforced by:

- `npm run production:check` (`scripts/check-production-env.mjs`)
- `scripts/production-signoff-env-check.mjs`
- Runtime helpers in `lib/wexon-production-guards.ts`

Also keep PayTR live charge gated:

- `WEXPAY_PAYTR_ENABLE_API=false` unless intentional pilot + live merchant credentials

## Local / E2E fixture rules

Fixtures may run when **not** on hosted Vercel production:

1. `VERCEL_ENV` is not `production`
2. `WEXON_E2E_TARGET` is `local`, `test`, or unset (not `production`)
3. For rate-limit relax: `WEXON_E2E_RELAX_RATE_LIMIT=true`  
   Playwright local webServer sets this. Local `next start` uses `NODE_ENV=production`; relax is still allowed when target is local and `VERCEL_ENV` is unset.
4. For customer password fallback: only local/test targets may use seeded `Wexon-Customer-2026`
5. `CUSTOMER_DEV_LOGIN_PASSWORD` bypass remains off whenever `NODE_ENV=production` (including local `next start`)

Seed script:

- `npm run prisma:seed:real` — refuses production env
- Creates local org `wexpay-real-test` / user `real@wexon.dev` for E2E only

## Production DB fixtures

Do **not** auto-delete production rows.

Read-only audit:

```bash
npm run audit:demo-accounts
```

If `real@wexon.dev`, `wexpay-real-test`, or `WEXPAY-real-test-*` QR codes appear on a production database, disable/archive only after explicit approval.

## Marketing vs login

| Surface | Allowed in production? |
|---------|------------------------|
| `/demo-request`, `/book-demo` lead capture | Yes |
| `/products/wexpay` product marketing | Yes |
| Demo account login / shared fixture password | No |
| Dev login notice on customer login page | Only when `isCustomerDevLoginAllowed()` |

## Logout cleanup

Customer and admin logout now clear:

- `wexon_customer_session`
- `wexon_admin_session`
- `wexon_active_organization_id`
