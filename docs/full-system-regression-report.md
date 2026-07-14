# Full system regression report

Date: 2026-07-13 (subscription pricing + E2E verify pass)  
Branch: `cursor/production-backend-hardening`  
HEAD at verify start: `d766e80536a66f271a7e2a5608714631c4a3590d` (pre-pricing commit); pricing/hardening changes uncommitted until this finalize commit.

## 1. Branch / PR

| Item | Value |
|------|-------|
| Branch | `cursor/production-backend-hardening` |
| Tracks | `origin/cursor/production-backend-hardening` |
| Direct push to `main` | **No** — work stays on feature branch |
| PR | `gh` CLI unauthenticated in this environment — create/update via GitHub UI or `gh auth login` |

## 2. Migration / seed DB target (redacted)

| Item | Value |
|------|-------|
| Command | `npx prisma migrate deploy` + `npm run prisma:seed` (2026-07-13 earlier session) |
| Connection key | `DIRECT_URL` via `prisma.config.ts` |
| Env files | `.env` (loaded), `.env.local` present but **does not override** DB URLs |
| Shell / Vercel production env | Not used for migrate/seed |
| Provider | Supabase |
| Host | `aws-1-eu-central-1.pooler.supabase.com` |
| Ports | DIRECT `5432` / DATABASE pooler `6543` |
| DB name | `postgres` |
| Project ref | `qoss…tlrv` (len=20) |
| Classification | **remote-unverified** (shared remote Supabase; `VERCEL_ENV` unset; `NEXT_PUBLIC_APP_URL=localhost:3000`) |
| Production-confirmed? | **No** — not proven as Vercel production env |

**Important:** This is a **remote shared** Supabase project used for local/dev E2E. Treat as production-like for fixture safety.

## 3. Production fixture disable audit (read-only, 2026-07-13)

| Entity | Expected | Observed |
|--------|----------|----------|
| `real@wexon.dev` isActive | false | **false** |
| `demo@wexon.dev` isActive | false | **false** |
| `wexpay-real-test` isActive / isDemo | false / true | **false / true** |
| `wexpay-inactive-test` isActive / isDemo | false / true | **false / true** |
| `mavi-bahce-demo` isActive / isDemo | false / true | **false / true** |
| `WEXPAY-real-test-MASA-01` isActive | false | **false** |

`prisma/seed.mjs` only upserts Product/Plan/Entitlement — **did not re-activate fixtures**.  
**No mutation applied.** No `PRODUCTION DISABLE ONAY` needed.

## 4. Pricing DB verification

| Plan | priceMonthly | priceYearly | currency | taxRatePct | isActive | isPublic |
|------|--------------|-------------|----------|------------|----------|----------|
| Basic | 1490 | 14900 | TRY | 20 | true | true |
| Standard | 2990 | 29900 | TRY | 20 | true | true |
| Pro | 5990 | 59900 | TRY | 20 | true | true |

Surfaces: checkout + admin + marketing home + `/products/wexpay` read DB via `computePlanPrice` / `getPublicWexPayPricingPlans`.  
Hardcoded leftovers: client-safe **fallback** labels in `lib/wexon-public-pricing-fallback.ts` + checkout render fallback if DB plan missing (aligned to seed). Seed values themselves are intentional bootstraps.

## 5. Targeted E2E (2026-07-13)

Command:

```bash
npx playwright test e2e/public.spec.ts e2e/security.spec.ts e2e/admin.spec.ts e2e/auth.spec.ts e2e/customer-dashboard.spec.ts e2e/qr-order-api.spec.ts e2e/public-checkout.spec.ts e2e/smoke.spec.ts
```

| Result | Count |
|--------|-------|
| Passed | **23** |
| Skipped | **28** |
| Failed | **0** |

Skip reason (global): fixtures disabled on shared DB (`fixturesReady=false` — org/user/QR not active). **Correct** — do not re-enable without approval.

### Coverage map

| Area | Status |
|------|--------|
| A Public/pricing | PASS — marketing/product/links/demo-request; `/demo/wexpay` expected gone |
| B Subscription/customer fixture flows | SKIP — needs active customer fixture |
| C Admin (CRM/login/logout) | PASS — org-detail fixture case skipped |
| D QR/order API full matrix | SKIP active QR; invalid QR 404 PASS |
| E Security (unauth redirect, seed routes closed, fake demo login fail) | PASS partial; customer→admin / cross-tenant SKIP |

## 6. Quality gates

| Gate | Result |
|------|--------|
| `npm run production:check` | PASS |
| `npm run test:unit` | PASS — 103 pass / 5 skip |
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Targeted `playwright` | PASS — 23/28 skip |
| Full `npm run test:e2e` | Equivalent targeted set run; fixture-dependent suite skipped by design |

## 7. Docs updated

- `docs/subscription-pricing-system.md` (new)
- `docs/backend-completion-audit.md`
- `docs/full-system-regression-report.md` (this file)

## Final decision

**READY WITH WARNINGS**

Reasons:

- Pricing source of truth = DB; admin editable; fixtures remain disabled after seed.
- Targeted E2E green where runnable; fixture-dependent QR/customer journeys intentionally skipped.
- Warnings: remote-unverified shared DB; no non-fixture customer smoke credential; live Core subscription gateway not built (mock/admin-manual only); in-memory rate limits remain.

## Merge conflict follow-up (2026-07-13)

- Merged `origin/main` into `cursor/production-backend-hardening`.
- `app/globals.css` resolved cleanly and is **identical to `origin/main`** (no conflict markers).
- Branch deletions of CSS-only hero marquee rules were superseded by main’s current global CSS; subscription/pricing/backend work did not depend on those deletions.
- Quality gates re-run after merge: production:check, unit, lint, tsc, build.

---

## PayTR Core subscription checkout (2026-07-13)

| Item | Value |
|------|-------|
| Branch | `cursor/paytr-real-subscription-checkout` (from `origin/main`) |
| Model | `SubscriptionPayment` + migration `20260713190000_add_subscription_payment` |
| Callback | `https://www.wexon.dev/api/billing/paytr/callback` |
| Deploy | `dpl_H9pXZnZEexrAAAD6PtMZaVNmAa5v` |
| SHA | `5aefae8` |
| Production status | READY |
| Flags | `PAYTR_SUBSCRIPTION_ENABLE_API=false`, `PAYTR_IFRAME_ENABLE_API=false`, `PAYTR_TEST_MODE=true`, `PAYTR_DEBUG_ON=true`, `PAYTR_RECURRING_ENABLE_API=false` |
| WexPay flag | Unchanged (`WEXPAY_PAYTR_ENABLE_API`) |
| Docs | `docs/paytr-subscription-checkout.md`, `docs/paytr-recurring-readiness.md` |

### Final decision (PayTR pass)

**READY FOR PAYTR TEST MODE WITH BLOCKERS**

- Merchant credentials missing → production ödeme akışı safe fallback’te.
- Canlı charge yok. `PAYTR LIVE TEST CHARGE ONAY` alınmadı.
- Checkout safe fallback (no broken iframe); iframe-token: unauth `401`, auth+disabled `403`.
- Callback fail-closed (no `OK` / no activate on invalid hash or missing credentials).
- Ready for test mode after merchant credentials + PayTR callback panel setup.
- `WEXPAY_PAYTR_ENABLE_API` left untouched; fixture QR/users remain disabled.

## 7. WexPay tiered pricing gating (2026-07-15)

Branch: `cursor/wexpay-tiered-pricing-gating-implementation`

| Check | Result |
|-------|--------|
| Public pricing tiers | Essential ₺7.000 / Growth ₺15.000 / Scale ₺35.000 + Business Suite |
| DB source of truth | `getPublicWexPayPricingPlans()` + admin `/admin/plans` |
| Entitlement soft-deactivate | Admin toggle; resolvers filter `isActive: true` |
| Migration preview | `/admin/plans/wexpay-migration` — no auto remap |
| Dashboard products | No `/checkout`; eligibility + packages CTAs |
| Billing success/fail | Links to packages + eligibility, not checkout |
| PayTR flags | Unchanged; closed by default |
| Unit tests | `npm run test -- lib/wexon-entitlement-lifecycle.test.ts lib/wexpay-tiered-pricing.test.ts` |

Optional read-only audit: `node scripts/audit-wexpay-plan-safety.mjs`
