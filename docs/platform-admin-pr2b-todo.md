# PlatformAdmin PR2B — runbook TODO (docs only)

PR2A ships the `PlatformAdmin` table and management UI. Shared admin session (`wexon_admin_session_v2` + `ADMIN_LOGIN_PASSWORD` / `ADMIN_EMAILS`) remains the temporary access path.

## PR2B gates (do not implement in PR2A)

1. **JWT verify each request** — Validate Cloudflare Access JWT on every admin request (no cookie-only trust).
2. **Session v3 with `adminId`** — Cut over to a session that binds a concrete `PlatformAdmin.id` (not only allowlisted email).
3. **Remove shared password** — Delete runtime use of `ADMIN_LOGIN_PASSWORD` / allowlist-as-auth; login form changes land here.
4. **No runtime fallback** — Fail closed if Cloudflare identity is missing/invalid; no silent shared-password fallback in production.
5. **Subject bind on first login (fail-closed)** — On first successful Cloudflare login, bind `cloudflareSubject` to the matching `PlatformAdmin` by `emailNormalized`. Reject if email has no active PlatformAdmin, or if subject is already bound to another admin.

## Explicit non-goals for PR2A

- No `jose` dependency
- No proxy cookie name change
- No Vercel env / Cloudflare Access policy changes in this PR
- No production migrate from this branch alone without operator review
