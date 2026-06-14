# WexPay Payment Provider Adapters

Status: Phase 5 skeleton — manual provider only. PSP adapters are registered stubs.

## Payment vs BillingPayment

| Concern | WexPay `Payment` | Core `BillingPayment` |
| --- | --- | --- |
| Purpose | In-venue table/checkout operations | Platform subscription & license billing |
| Tenant scope | Restaurant branch / table session | Organization subscription |
| Access decisions | Never used for Core license/entitlement | Source of truth for billing state |
| Provider field | `Payment.provider` / `Payment.providerRef` | Separate Core billing models |

WexPay operational payments must not drive Core access, license, or subscription logic.

## Adapter registry

Implementation: `lib/wexpay-payment-provider.ts`

| Provider key | Status | Behaviour |
| --- | --- | --- |
| `manual` | Active | Operator-recorded payment; no external checkout |
| `paytr` | Stub | Throws `Provider adapter not configured.` |
| `iyzico` | Stub | Throws `Provider adapter not configured.` |
| `param` | Stub | Throws `Provider adapter not configured.` |

### Common adapter interface

Each adapter implements:

- `createPaymentIntent` — reserve or confirm an operational payment intent
- `createCheckoutSession` — produce redirect / hosted checkout when required
- `verifyCallback` — validate PSP webhook or return payload
- `mapProviderStatus` — map provider-specific status strings to `PaymentStatus`

Response types (`WexPayPaymentIntentResult`, `WexPayProviderCallbackResult`) live in the adapter module.

## Manual provider (current production path)

- Default when `provider` is omitted or empty.
- Does not emit `externalCheckoutUrl`.
- `createPayment` in `lib/wexpay-service.ts` records the payment immediately with operator-selected `PaymentStatus` (typically `PAID`).
- `providerRef` remains `null`.

Operator UI and server actions continue to use manual flow unchanged.

## Public QR boundary (not enabled)

Public diners use:

- `POST /api/wexpay/public/[qrCode]/order` — order creation only (no PSP redirect)

Future checkout (not wired):

1. Diner completes order (or selects pay-at-table).
2. A dedicated checkout route resolves the branch/tenant provider adapter.
3. `createPublicQrCheckoutSessionBoundary` calls `createCheckoutSession`.
4. Client redirects to `externalCheckoutUrl` when `requiresExternalCheckout` is true.
5. PSP callback/webhook updates `Payment` via `verifyCallback` + `mapProviderStatus`.

Do not add PSP calls to the order route.

## PayTR / iyzico / Param — next steps

For each PSP adapter:

1. **Tenant credentials** — store encrypted keys per organization/branch (not in repo).
2. **Adapter implementation** — replace stub with real API client in `lib/wexpay-payment-provider.ts` or split per-provider modules.
3. **Webhook routes** — e.g. `/api/wexpay/webhooks/paytr` (production only; keep demo routes untouched).
4. **Idempotency** — pass stable `idempotencyKey` on intent creation; dedupe webhook processing (see `docs/webhook-event-idempotency-design.md`).
5. **Audit** — log `wexpay.payment.created`, callback verification, and status transitions inside transactions.
6. **Status sync** — after callback, update `Payment.providerRef`, `Payment.status`, `paidAt`, then `syncTableStatus`.

Stub adapters intentionally throw `Provider adapter not configured.` if selected before steps 1–2 are complete.

## Webhook and idempotency requirements

Before enabling PSP providers in production:

- **Verify signatures** in `verifyCallback` (never trust raw POST body).
- **Idempotency key** — use `{organizationId}:{provider}:{providerRef}` or PSP-supplied event id; reject duplicates.
- **Transactional updates** — payment row + table status + audit log in one DB transaction.
- **Out-of-order events** — `mapProviderStatus` should tolerate late `PENDING` after `PAID` without corrupting closed sessions.
- **Tenant isolation** — resolve payment by `providerRef` scoped to organization/branch chain.

Refer to `docs/webhook-event-idempotency-design.md` for platform-wide webhook delivery design (separate from WexPay adapter stubs).

## Schema

Existing `Payment` fields are sufficient — no migration required for Phase 5:

- `provider` — normalized adapter key (`manual`, `paytr`, …)
- `providerRef` — PSP transaction / session id when external checkout is used
