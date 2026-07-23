# Security Hardening Notes

Wexon Platform is built with defense-in-depth. No web system can be made
"unhackable"; production safety depends on code controls, rotated secrets,
monitoring, backups, and fast incident response.

## Production blockers

- Rotate the Supabase database password before public launch if it was ever
  pasted into chat, issue trackers, logs, or shared documents.
- Keep `CUSTOMER_DEV_LOGIN_PASSWORD` unset in production.
- Keep `MAINTENANCE_MODE=false` for live service; use `true` only for controlled
  pre-application mode.
- Keep `WEXPAY_PAYTR_ENABLE_API=false` for the first public launch unless a
  Kurucu İşletmeler Programı PayTR merchant has been verified end-to-end.
- Run `npm run production:check` and `npm run production:preflight` before each
  deploy.
- Run `npm audit --omit=dev` before release and review any remaining advisories.
- Enable PayTR only after TEST merchant verification and webhook confirmation.
- Put `admin.wexon.dev` behind Cloudflare Access and add Cloudflare WAF/rate
  limits for login, admin, public WexPay API, and PayTR webhook paths.

## Dependency audit policy

- `npm audit fix` may be used for non-breaking remediation.
- Do not run `npm audit fix --force` unless the proposed major downgrade/upgrade
  has been reviewed and tested.
- Current accepted residual risk: Next.js bundles a PostCSS version flagged by
  npm audit. The automated fix suggests a breaking Next downgrade, so this is
  tracked until an upstream Next patch is available.

## Runtime protections

- Security headers are configured in `next.config.ts`:
  - CSP
  - HSTS in production
  - frame denial
  - nosniff
  - strict referrer policy
  - permissions policy
  - cross-origin opener/resource policy
- Runtime Prisma uses `DATABASE_URL` first. Use Supabase pooler for app traffic.
- `DIRECT_URL` is reserved for migrate, seed, and preflight work.

## Authentication and sessions

- Admin and customer sessions are HTTP-only cookies.
- Production session secrets must be at least 32 characters and non-placeholder.
- Current admin shared-password auth is MVP-only. Before broader production use,
  replace it with per-admin credentials and MFA.
- Admin sessions use host-only cookie `wexon_admin_session_v2` on `admin.wexon.dev`
  (not shared via `Domain=.wexon.dev`). Legacy `wexon_admin_session` is ignored.
  After deploy, admins must sign in once on `admin.wexon.dev`.
  Unified public login must not mint admin cookies. Production `loginAdminAction`
  rejects non-admin hosts before credential checks.

## Rate limiting

Current rate limiting is in-memory and process-local. It protects local and
single-instance deployments, but it does not coordinate across multiple server
instances.

Before multi-instance production traffic, move rate limit storage to Redis,
Upstash, or a managed edge/WAF rate limiter for:

- admin login
- customer login
- public QR order and checkout
- PayTR webhook
- WexPay API

## Payments

WexPay does not hold money. Restaurants connect their own virtual POS provider.

- PayTR webhook processing verifies signature, amount, duplicate delivery, and
  terminal payment state.
- PayTR provider credentials are encrypted before storage.
- iyzico and Param adapters are stubs until implemented and tested.

## Incident response

If compromise is suspected:

1. Disable affected API keys / provider credentials.
2. Rotate Supabase password and all session/API secrets.
3. Disable PayTR live API if payment integrity is uncertain.
4. Review audit logs for admin override, entitlement, API key, payment, and
   webhook actions.
5. Re-run `production:preflight`, unit tests, and smoke tests before re-enabling
   traffic.
