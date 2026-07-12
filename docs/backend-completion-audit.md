# Backend completion audit

Date: 2026-07-12  
Branch: `cursor/production-backend-hardening`

## Summary

Core customer, admin, and WexPay QR backends are real (DB-backed, server-priced, rate-limited). This pass hardened production guards, completed public QR response contracts, and improved ops visibility for assist notifications. No Prisma schema migration was required.

## Auth / session

| Area | Status | Notes |
|------|--------|-------|
| Customer login | OK | Hashed passwords; membership required |
| Admin login | OK (MVP) | Shared `ADMIN_LOGIN_PASSWORD` + `ADMIN_EMAILS`; Cloudflare Access expected |
| Dev password bypass | Hardened | `isCustomerDevLoginAllowed()` — never in production |
| Org context | OK | Membership-gated; foreign org → unauthorized |
| Cookie flags | OK | HttpOnly, Secure (prod), SameSite=Lax, Path=/; `.wexon.dev` domain in prod |
| Logout | Fixed | Clears customer + admin + active-org cookies |
| Rate limit | Hardened | E2E relax ignored in production |
| Cross-tenant | OK | App-layer asserts; E2E covered |

## Customer / Core

| Area | Status |
|------|--------|
| Dashboard org data | Real membership/org data |
| Org switching | Membership-validated |
| WexPay entitlement | Core product access gate |

## WexPay / QR

| Area | Status | Notes |
|------|--------|-------|
| QR resolve | Done | Invalid / closed states |
| Menu | Done | Active categories/products from DB |
| Order submit | Done | Server price; client money fields rejected; idempotency key |
| Bill | Done | Session-scoped totals + paymentAvailability |
| Payment request | Done | Notification only — **no live charge** |
| Waiter call | Done | Notification + rate limit |
| PayTR live charge | Gated | Requires `WEXPAY_PAYTR_ENABLE_API=true` + credentials; diner UI still “yakında” |

## Admin / ops

| Area | Status | Notes |
|------|--------|-------|
| Demo request CRM | Existing | Lead + follow-up |
| Organizations / customers / apps | Existing | Admin actions guarded |
| QR order visibility | Ops panel | Orders board + live events |
| Payment / waiter requests | Improved | Live-events badges for `[ÖDEME TALEBİ]` / `[GARSON ÇAĞRISI]` |
| Dedicated assist cards | TODO (P3) | No schema migration; title-prefix approach kept |

## Public API

| Area | Status |
|------|--------|
| Demo request | Validated + rate limited |
| QR public APIs | Method-scoped routes; 404/403/429 |
| Seed endpoints | Not exposed |
| Validation | Note length, quantity, item caps, price-field rejection |

## Fixes in this branch

1. Production-safe env/runtime guards for demo login + rate-limit relax  
2. Logout clears all session/org cookies  
3. Public order response: `orderId`, `orderNo`, `tableName`, `total`, `status`  
4. Bill `paymentAvailability` + aliases (`subtotal`/`paid`/`remaining`)  
5. Payment-request returns `charged: false`  
6. Note length + cart size limits; reject client price fields  
7. Optional `Idempotency-Key` for public orders  
8. Ops live-event badges for assist/QR order  
9. Docs + unit/API/E2E coverage expansion  
10. Read-only `npm run audit:demo-accounts`  
11. Production fixture disable/archive after live app proof + verify

## Remaining TODOs

| Item | Priority | Notes |
|------|----------|-------|
| Production fixture disable/archive | **Done** | Non-destructive disable applied 2026-07-12 after `PRODUCTION DISABLE ONAY`; verify PASS |
| Permanent delete of disabled fixture rows | P3 (ops) | Only with separate approval; hashes retained today |
| Non-fixture production customer smoke credential | P1 (ops) | Blocked until a dedicated non-fixture test user is provisioned |
| Distributed rate limits (Redis/WAF) | P2 | In-memory per process today |
| Per-admin hashed credentials + MFA | P2 | Shared admin password MVP |
| Signup rate limit | P2 | Open signup still unthrottled |
| Typed `WAITER_CALL` / `PAYMENT_REQUEST` notification enums | P3 | Would need migration |
| Wire diner UI to PayTR `/checkout` | P3 | API exists; product decision |
| Dedicated assist UI cards in ops | P3 | Badges sufficient for now |

## Risk level

**Low for pilot launch**, assuming:

- Cloudflare Access on admin (verified challenge still active post-disable)  
- Forbidden env vars unset  
- `WEXPAY_PAYTR_ENABLE_API=false` until pilot  
- Production fixture accounts disabled (completed)
