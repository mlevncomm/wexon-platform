# PayTR recurring readiness

Date: 2026-07-13  
Status: **NOT ENABLED** (`PAYTR_RECURRING_ENABLE_API=false`)

## Why this pass does not enable recurring

- First production goal is a single iFrame subscription charge with verified callback/hash/idempotency.
- Stored-card / Non3D / utoken+ctoken requires explicit PayTR merchant permissions that are not assumed.
- Automatic monthly charge without those permissions would be unsafe and non-compliant with our go-live gates.
- `production:check` **fails** if `PAYTR_RECURRING_ENABLE_API=true`.

## Required PayTR capabilities (future)

1. Kart saklama yetkisi (merchant panel + contract).
2. Non3D / recurring charge permission for subsequent periods.
3. utoken / ctoken issuance and secure vaulting (never log raw tokens).
4. Separate recurring API endpoint integration + retry policy.

## Proposed future design (not built)

- After first iFrame PAID: optionally store PayTR card tokens if permitted.
- Cron / Workflow: due subscriptions → recurring charge attempt.
- Dunning: retry schedule, PAST_DUE status, grace period, cancel.
- Customer emails: invoice, failed payment, receipt.
- Proration / cancellation rules.

## Current period handling (this pass)

- On first PAID callback: set `Subscription.currentPeriodStart/End` from billing interval.
- Renewal date visible in admin/customer UIs via existing subscription fields.
- Next invoice / auto-charge: **out of scope**.

## Gate to reopen

Document verified merchant permissions, add recurring module + tests, then request product approval before flipping `PAYTR_RECURRING_ENABLE_API`.
