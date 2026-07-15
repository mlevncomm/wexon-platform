# WexPay public API rate limits

## In-memory limiter (current)

`lib/wexon-rate-limit.ts` uses a **per-process** sliding window. On Vercel serverless / multi-instance:

- Limits do **not** coordinate across isolates
- Cold starts reset counters
- Attackers can amplify effective quotas by spreading requests

Use these limits as a first line of defense only.

## Recommended production upgrade

Before high-traffic public QR launch, add a **distributed** limiter:

1. **Upstash Redis** + `@upstash/ratelimit` (works well on Vercel), or
2. **Cloudflare WAF / Rate Limiting** on `/api/wexpay/public/*`, or
3. Shared Redis behind an adapter implementing the same `enforceRateLimit(scope, id, config)` shape

Keep the public helper (`lib/wexpay-public-rate-limit.ts`) as the call site so swapping the store does not rewrite route files.

## Endpoint matrix (IP, per minute unless noted)

| Endpoint | Limit | Why |
|----------|-------|-----|
| `GET .../public/[qrCode]` (menu) | 90/min | Browse + scrape resistance |
| `POST .../order` | 20/min | Write / cost control |
| `GET .../bill` | 90/min | Status polling headroom |
| `POST .../call-waiter` | 8/min IP + 1 / 45s per table | Staff spam |
| `POST .../payment-request` | 8/min IP + 1 / 60s per table | Separate from waiter |
| `POST .../checkout` | 15/min + Idempotency-Key per table | Expensive intents |

Waiter and payment-request use **separate** IP buckets and **separate** table cooldowns.

## Client IP trust

`getRequestIpAddress` prefers `x-vercel-forwarded-for` → `cf-connecting-ip` → `x-real-ip` → **rightmost** `x-forwarded-for`. Leftmost XFF alone is not trusted.

## Checkout idempotency

`POST /checkout` stores responses in existing `PublicIdempotencyRecord` scoped as `qr-checkout:{tableId}` (including honest `503 checkout_unavailable` when PayTR is off). No schema change.

## Isolated security E2E

```bash
npm run test:e2e:wexpay-public-security
```

Sets `WEXON_E2E_FORCE_PUBLIC_QR_RATE_LIMIT=true` and low override limits so 429s are observable without waiting a full minute.
