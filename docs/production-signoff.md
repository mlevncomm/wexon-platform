# Production Sign-off

**Date:** 2026-07-12  
**Final decision:** READY  
**Production SHA:** `ae8f2ca9bb367395665284fe5a7242c4a692882f`  
**Deployment:** `dpl_Htwgs52XCR43yuFavjZoKagY7iQ5` (Ready)

## Gate results

| Gate | Result |
|------|--------|
| Vercel production SHA matches merge | PASS |
| Env values (non-empty production config) | PASS |
| Public routes | PASS |
| Cloudflare Access challenge (`admin.wexon.dev`) | PASS |
| Access → Wexon admin login | PASS |
| Admin login → dashboard | PASS |
| Customer login | PASS |
| Cookie domain `.wexon.dev` | PASS |
| Core / app session carry | PASS |
| Logout cleanup | PASS |
| Temporary Access service token/policy removed | PASS |

## Public routes verified

- `https://wexon.dev/` → canonical redirect to `https://www.wexon.dev/`
- `https://www.wexon.dev/` → 200
- `https://www.wexon.dev/links` → 200
- `https://www.wexon.dev/products/wexpay` → 200
- `https://www.wexon.dev/demo/wexpay` → 200
- `https://www.wexon.dev/demo-request` → 200

## Auth / session notes

- Unauthenticated `core` / `app` routes redirect to `www.wexon.dev` login.
- Customer session cookie: domain `.wexon.dev`, Secure, HttpOnly, SameSite=Lax, Path `/`.
- After login, `core.wexon.dev/dashboard` and `app.wexon.dev/apps/wexpay` open without re-login.
- Logout clears subdomain sessions; protected routes return to login.
- Admin chain: Cloudflare Access → Wexon admin login form → admin password → `/applications`.
- Admin session cookie uses domain `.wexon.dev` with Secure / HttpOnly / SameSite=Lax.

## Production env checks (names only)

Confirmed present and non-empty:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN`
- `MAINTENANCE_MODE`
- `WEXPAY_PAYTR_ENABLE_API`

Confirmed unset in Production:

- `CUSTOMER_DEV_LOGIN_PASSWORD`
- `WEXON_E2E_RELAX_RATE_LIMIT`

## Cleanup

- Temporary Cloudflare Access **service tokens** and **Signoff Service Auth** policies created for automation were deleted after verification.
- Remaining Access policy on `admin.wexon.dev`: `Wexon Admin Allowlist` (allow) only.
- Access challenge remains active for normal browser traffic.
- Cloudflare **user API tokens** (`cfut_*`) previously used in local shells cannot be revoked with the current token permissions (`9109`). Rotate/delete those tokens in Cloudflare → My Profile → API Tokens.

## Follow-up

See [production-monitoring-checklist.md](./production-monitoring-checklist.md) for the first 24h post-launch monitoring plan.
