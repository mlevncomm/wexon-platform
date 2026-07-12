# Full system regression report

Date: 2026-07-12  
Branch: `cursor/production-backend-hardening`

## Scope tested

- Public marketing (`/`, `/links`, `/products/wexpay`, `/demo-request`)
- Demo account shutdown / no public fixture credentials
- Auth (customer, admin, wrong password, cookies)
- Customer dashboard + cross-tenant block + logout
- QR diner UX + public QR APIs (order, bill, payment-request, waiter)
- Public checkout validation / amount ignore / PSP unavailable
- Admin CRM / demo lead / logout
- Security routes + seed endpoint closure
- WexPay licensed / inactive license flows
- Unit: production guards, rate limits, validation, idempotency, PayTR helpers

## Quality gates

| Gate | Result |
|------|--------|
| `npm run production:check` | PASS |
| `npm run test:unit` | PASS (98 pass, 5 skip — PSP key optional) |
| `npm run lint` | PASS (0 errors; 2 pre-existing unused-import warnings in scripts) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS (**60/60**) after rebuild with rate-limit guard |

## Findings

### P0
None.

### P1
| Finding | Status |
|---------|--------|
| Production DB may still contain seed fixtures (`real@wexon.dev`, etc.) | **Open — needs human approval** before delete. Use `npm run audit:demo-accounts` (read-only). |

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

## Fixes shipped

- Production env/runtime guards for demo login + rate-limit relax (Vercel-safe; local Playwright compatible)
- Logout clears customer + admin + active-org cookies
- QR order validation hardening + idempotency + richer responses
- Bill paymentAvailability; payment-request `charged: false`
- Ops live-event badges for QR/assist
- Docs + expanded unit/API/E2E coverage

## Final decision

**READY WITH WARNINGS**

Reasons:

- All automated quality gates pass; no P0 auth/payment/order security breaks found in code paths covered.
- Remaining: manual production DB fixture audit + Cloudflare Access / cookie sign-off on live hosts (ops checklist).
- PayTR live charge remains disabled by feature flag (correct for launch).
