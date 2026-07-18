# PayTR subscription checkout (Core billing)

Date: 2026-07-13  
Branch: `cursor/paytr-real-subscription-checkout`

## Scope

Platform **Core subscription** payments via PayTR iFrame API.

This is **not** WexPay restaurant/QR PayTR (`WEXPAY_PAYTR_ENABLE_API` + tenant `WexPayProviderCredential`).

## Flow

1. Authenticated customer selects plan on `/checkout`.
2. `POST /api/billing/paytr/iframe-token` loads **DB Plan** price (`computePlanPrice`), creates `SubscriptionPayment`, calls PayTR `get-token`.
3. Client embeds iframe (`https://www.paytr.com/odeme/guvenli/{token}`).
4. User returns to `/billing/paytr/success|fail` (informational only — **no activation**).
5. PayTR posts to callback; hash verified; on success subscription/license/app install activate **once**.

## Callback URL (production)

`https://www.wexon.dev/api/billing/paytr/callback`

- No login / Cloudflare Access (www public API).
- Response: `text/plain` `OK` when accepted (including duplicate).
- Invalid hash → non-OK.

## Env (names only)

| Variable | Default | Notes |
|----------|---------|-------|
| `PAYTR_MERCHANT_ID` | unset | Platform merchant |
| `PAYTR_MERCHANT_KEY` | unset | Server-only |
| `PAYTR_MERCHANT_SALT` | unset | Server-only |
| `PAYTR_TEST_MODE` | `true` | Prefer true until live sign-off |
| `PAYTR_DEBUG_ON` | `false` | Must be false when live (`TEST_MODE=false`) |
| `PAYTR_IFRAME_ENABLE_API` | `false` | Must be true with subscription flag |
| `PAYTR_SUBSCRIPTION_ENABLE_API` | `false` | Master gate |
| `PAYTR_RECURRING_ENABLE_API` | `false` | Blocked in production:check if true |
| `PAYTR_CALLBACK_SECRET` | optional | Extra header guard; does not replace hash |
| `NEXT_PUBLIC_WEXON_PUBLIC_ORIGIN` | `https://www.wexon.dev` | Callback + return URLs |

## State machine (`SubscriptionPayment.status`)

`INITIATED` → `TOKEN_CREATED`/`PENDING_CALLBACK` → `PAID` | `FAILED` | `CANCELED` | `EXPIRED`

## Security

- Client amount ignored; price from DB Plan only.
- Timing-safe callback hash compare.
- Duplicate `merchant_oid` success callback returns OK without second entitlement.
- Failed callback never activates subscription.
- Secrets never in client bundle.

## Go-live checklist (self-serve)

1. Merchant id/key/salt in Vercel Production (platform merchant; merchant id e.g. `725404`).
2. PayTR panel Bildirim URL = `https://www.wexon.dev/api/billing/paytr/callback`.
3. Unit + callback tests PASS (`npm run test:paytr`, `npm run test:unit:db`).
4. Public/dashboard CTAs already point Essential/Growth to `/checkout`.
5. Set `PAYTR_SUBSCRIPTION_ENABLE_API=true` + `PAYTR_IFRAME_ENABLE_API=true`.
6. Start with `PAYTR_TEST_MODE=true` (and `PAYTR_DEBUG_ON=false` once live).
7. Confirm one test-mode charge activates License + AppInstallation.
8. Live charge only after explicit approval: `PAYTR LIVE TEST CHARGE ONAY`.
9. Keep `PAYTR_RECURRING_ENABLE_API=false` (renewals are manual / admin until recurring module ships).

## Production status (safe-blocked record)

| Field | Value |
|-------|-------|
| Deploy | `dpl_H9pXZnZEexrAAAD6PtMZaVNmAa5v` |
| SHA | `5aefae8` |
| Production status | READY |
| Decision | **READY FOR PAYTR TEST MODE WITH BLOCKERS** |

**PayTR subscription flags (Production — verify in Vercel before flip):**

- `PAYTR_SUBSCRIPTION_ENABLE_API` — must be enabled for self-serve
- `PAYTR_IFRAME_ENABLE_API` — must be enabled with subscription flag
- `PAYTR_TEST_MODE=true` until live sign-off
- `PAYTR_DEBUG_ON=false` when live
- `PAYTR_RECURRING_ENABLE_API=false`

**Notes:**

- Code path activates subscription only on verified callback (browser success/fail pages are informational).
- Mock checkout remains blocked in production.
- Scale / Business Suite CTAs stay meeting-based (`/randevu-ai`).
- Canlı charge yok without explicit operator approval after test-mode success.