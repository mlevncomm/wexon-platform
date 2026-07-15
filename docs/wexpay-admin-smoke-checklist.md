# WexPay admin manual smoke (Cloudflare Access)

Use this checklist behind an authenticated Cloudflare Access session on `https://admin.wexon.dev`. Do **not** log service token secrets, API tokens, or `.env` values.

## Preconditions

- [ ] Branch deployed to preview or production admin host matches the PR under test.
- [ ] `WEXPAY_PAYTR_ENABLE_API=false` (verify via `npm run production:check` locally; no change during smoke).
- [ ] No production plan migration apply actions exist in UI (read-only preview only).

## A. Plan commercial görünümü — `/admin/plans`

- [ ] Essential monthly price shows **7000** TRY
- [ ] Growth monthly price shows **15000** TRY
- [ ] Scale monthly price shows **35000** TRY
- [ ] Business Suite monthly price shows **99000** TRY
- [ ] Setup fee values match tier seed defaults
- [ ] Processing starting rates: 2.89 / 2.59 / 2.35 / 2.05
- [ ] Public tiers: `isPublic=true`, `isActive=true`
- [ ] Legacy `wexpay_standard`: `isActive=true`, `isPublic=false`

## B. Legacy güvenliği

- [ ] `wexpay_standard` remains active and non-public
- [ ] Exactly **2** active license/subscription references still point at legacy plan (no auto remap)
- [ ] No bulk migration or “Apply All” control on migration screen

## C. Migration preview — `/admin/plans/wexpay-migration`

- [ ] Page loads without error
- [ ] Copy states read-only / no production mutation
- [ ] **Apply All** button absent
- [ ] Per-row links to organization detail only (no apply/migrate action)

## D. Entitlement lifecycle (fixture only)

If a **demo/inactive** org with safe test entitlement exists:

- [ ] **Devre Dışı Bırak** requires reason
- [ ] Audit log entry created
- [ ] **Yeniden Etkinleştir** restores resolver behavior

If no safe fixture: verify UI forms and server actions exist in code only; **do not mutate production customers**.

## E. Eligibility admin görünümü — demo/lead detail

- [ ] `recommendedTier` visible on eligibility-enriched lead metadata (when present)
- [ ] `reviewStatus` visible
- [ ] `riskReasons` admin-only (not returned in applicant-facing API responses)

Code references: `lib/wexpay-eligibility.ts` (`toApplicantEligibilitySummary`), `lib/wexon-pre-application-persistence.ts`.

## Public pricing parity (non-Access)

- [ ] `/packages` and `/products/wexpay` share `WexPayPricingGrid` + `PricingCard` commercial fields
- [ ] Disclaimer present on both surfaces
- [ ] No direct WexPay `/checkout` CTA

## Sign-off

| Area | Result | Notes |
|------|--------|-------|
| Plans commercial | | |
| Legacy safety | | |
| Migration preview | | |
| Entitlement lifecycle | | |
| Eligibility admin | | |

**Automated note:** CI agents cannot complete Access-protected admin routes without a scoped service token. Temporary sign-off tokens must be deleted after use per `docs/production-signoff.md`.
