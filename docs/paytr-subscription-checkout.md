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

## Go-live checklist

1. Merchant id/key/salt in Vercel Production.
2. PayTR panel Bildirim URL = callback above.
3. Unit + callback tests PASS.
4. `PAYTR_SUBSCRIPTION_ENABLE_API=true` + `PAYTR_IFRAME_ENABLE_API=true`.
5. Start with `PAYTR_TEST_MODE=true`.
6. Live charge only after exact approval: `PAYTR LIVE TEST CHARGE ONAY`.

## Production status (safe-blocked record)

| Field | Value |
|-------|-------|
| Deploy | `dpl_H9pXZnZEexrAAAD6PtMZaVNmAa5v` |
| SHA | `5aefae8` |
| Production status | READY |
| Decision | **READY FOR PAYTR TEST MODE WITH BLOCKERS** |

**PayTR subscription flags (Production):**

- `PAYTR_SUBSCRIPTION_ENABLE_API=false`
- `PAYTR_IFRAME_ENABLE_API=false`
- `PAYTR_TEST_MODE=true`
- `PAYTR_DEBUG_ON=true`
- `PAYTR_RECURRING_ENABLE_API=false`

**Notes:**

- Merchant credentials missing → production ödeme akışı safe fallback’te (no broken iframe; “yapılandırılıyor” + demo-request CTA).
- `POST /api/billing/paytr/iframe-token`: unauth → `401`; auth + flags off → `403` disabled (no token).
- Callback fail-closed when credentials missing / invalid hash (never plain `OK`, no subscription activate).
- Canlı charge yok. `PAYTR LIVE TEST CHARGE ONAY` alınmadı.
- Ready for PayTR **test mode** only after merchant credentials + PayTR panel Bildirim URL + flag enablement (still start with `PAYTR_TEST_MODE=true`).
