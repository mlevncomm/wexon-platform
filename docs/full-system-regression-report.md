# Full system regression report

Date: 2026-07-12  
Branch: `cursor/production-backend-hardening`

## Scope tested

- Public marketing (`/`, `/links`, `/products/wexpay`, `/demo-request`)
- Demo account shutdown / production fixture disable
- Auth (customer, admin, wrong password, cookies)
- Customer dashboard + cross-tenant block + logout
- QR diner UX + public QR APIs (order, bill, payment-request, waiter)
- Public checkout validation / amount ignore / PSP unavailable
- Admin CRM / demo lead / logout
- Security routes + seed endpoint closure
- WexPay licensed / inactive license flows
- Unit: production guards, rate limits, validation, idempotency, PayTR helpers
- Production fixture disable + live verify

## Production fixture disable (2026-07-12)

Approved with exact phrase `PRODUCTION DISABLE ONAY` after production app behavior proof
(`PRODUCTION_APP_FIXTURE_ACTIVE_CONFIRMED` via live QR + demo login evidence).

| Entity | After |
|--------|-------|
| User `real@wexon.dev` | `isActive=false` (hash retained) |
| User `demo@wexon.dev` | `isActive=false` (hash retained) |
| Org `wexpay-real-test` | `isActive=false`, `isDemo=true` |
| Org `wexpay-inactive-test` | `isActive=false`, `isDemo=true` |
| Org `mavi-bahce-demo` | `isActive=false`, `isDemo=true` |
| QR `WEXPAY-real-test-MASA-01` | `isActive=false` |

Constraints honored: **no row delete**, **no password hash delete**, **no cascade**.

### Production verify — PASS

| Check | Result |
|-------|--------|
| Fixture QR page | Invalid/closed state (no restaurant/order CTA) |
| QR API | **404** `Masa bulunamadı.` |
| `real@` / `demo@` login | Blocked |
| Public `/`, `/links`, `/products/wexpay`, `/demo-request` | 200 |
| `/demo/wexpay` | 404 (intentionally removed earlier) |
| `admin.wexon.dev` | 302 → Cloudflare Access |
| Unified `/login` | 200 |

**Rollback:** only with a separate explicit approval (restore prior `isActive` / `isDemo` flags). Do not re-run `prisma:seed:real` against production.

## Quality gates

| Gate | Result |
|------|--------|
| `npm run production:check` | PASS |
| `npm run test:unit` | PASS |
| `npm run lint` | PASS (0 errors; 2 pre-existing script warnings) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — **25 passed, 35 skipped** (fixture-dependent cases skipped while production fixtures stay disabled on shared DB) |

## Findings

### P0
None.

### P1
| Finding | Status |
|---------|--------|
| Production seed fixtures were active on shared DB | **Fixed** — non-destructive disable applied + verify PASS |
| Non-fixture production customer smoke credential | **Open** — `BLOCKED: gerçek production customer smoke için non-fixture test credential yok` |

### P2
| Finding | Status |
|---------|--------|
| In-memory rate limits (multi-instance) | Documented TODO |
| Shared admin password MVP | Documented; CF Access expected |
| Open signup without rate limit | Documented TODO |

### P3
| Finding | Status |
|---------|--------|
| Dedicated waiter/payment-request UI cards | Ops badges added; dedicated cards TODO |
| Diner online PayTR UI wiring | API exists; UI “yakında” intentional |
| Typed notification enums (schema) | Deferred — no migration this PR |
| Permanent delete of disabled fixture rows | Not done (by design); needs separate approval |

## Fixes shipped

- Production env/runtime guards for demo login + rate-limit relax
- Logout clears customer + admin + active-org cookies
- QR order validation hardening + idempotency + richer responses
- Bill paymentAvailability; payment-request `charged: false`
- Ops live-event badges for QR/assist
- Docs + expanded unit/API/E2E coverage
- Production fixture disable/archive after live proof

## Manual sign-off references

- Cloudflare Access + `.wexon.dev` cookie chain: previously **PASS** in `docs/production-signoff.md`
- Re-checked Access challenge after fixture disable: `admin.wexon.dev` → 302 Cloudflare Access (**PASS**)

## Final decision

**READY WITH WARNINGS**

Reasons:

- Automated gates + production fixture disable verify PASS; no P0 auth/payment/order security breaks.
- Warning: no non-fixture production customer credential available for live customer journey smoke.
- PayTR live charge remains disabled by feature flag (correct for launch).
- Fixture rows still exist (disabled only); permanent delete requires separate approval.
