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

## E. Eligibility admin görünümü — demo/lead detail (`/admin/support`, `/admin/applications`)

- [x] Lead kartında **WexPay Uygunluk Değerlendirmesi** bölümü görünüyor — **PASS** (Cloudflare Access manuel smoke)
- [x] `recommendedTier` (Önerilen paket) görünüyor — **PASS**
- [x] `reviewStatus` badge: Ön uygunluk / Manuel inceleme / Uygun değil / Değerlendirilmedi — **PASS**
- [x] Liste veya badge’de önerilen paket + inceleme durumu kısaca görünüyor — **PASS**
- [x] `riskReasons` yalnızca admin kartında Türkçe notlar olarak görünüyor — **PASS** (raw JSON / risk key sızıntısı yok)
- [x] Applicant success mesajında `riskReasons` / internal key yok (network/UI) — **PASS** (unit + e2e)
- [x] “Ön uygunluk nihai onay değildir” disclaimer kartta var — **PASS**

Code references: `lib/wexpay-eligibility.ts`, `lib/wexpay-eligibility-admin-display.ts`, `components/marketing/WexPayEligibilityAdminCard.tsx`.

### Access smoke — confirmed 2026-07-15

| Check | Result |
|------|--------|
| Cloudflare Access smoke | **PASS** |
| Eligibility admin list/detail | **PASS** |
| riskReasons admin-only | **PASS** |
| Layout / no raw JSON dump | **PASS** |

## E2E lead hygiene (do not auto-delete on shared remote)

Local Playwright can write DemoRequest audit rows into the **shared remote-unverified** Supabase DB used by admin CRM.

- Inventory/dry-run: `node --import ./scripts/load-local-env.mjs scripts/cleanup-e2e-demo-leads.mjs`
- Apply (requires explicit dual confirm on shared remote):
  `$env:CONFIRM_E2E_LEAD_CLEANUP="true"; $env:ALLOW_SHARED_REMOTE_E2E_CLEANUP="true"; node --import ./scripts/load-local-env.mjs scripts/cleanup-e2e-demo-leads.mjs`
- Lead-mutating eligibility e2e is skipped on shared remote unless `WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION=true`, and always cleans its own marker rows when it runs.

## Public pricing parity (non-Access)

- [x] `/packages` and `/products/wexpay` share `WexPayPricingGrid` + `PricingCard` commercial fields
- [x] Disclaimer present on both surfaces
- [x] No direct WexPay `/checkout` CTA

## Sign-off

| Area | Result | Notes |
|------|--------|-------|
| Plans commercial | | |
| Legacy safety | | |
| Migration preview | | |
| Entitlement lifecycle | | |
| Eligibility admin | **PASS** | Access manual smoke 2026-07-15 |
| Access smoke | **PASS** | |
| riskReasons admin-only | **PASS** | |

**Automated note:** CI agents cannot complete Access-protected admin routes without a scoped service token. Temporary sign-off tokens must be deleted after use per `docs/production-signoff.md`.
