# Subscription pricing system

Date: 2026-07-15  
Branch: `cursor/wexpay-tiered-pricing-gating-implementation`

## Source of truth

**Plan pricing lives in the database** on the `Plan` model. Marketing, admin, dashboard and eligibility surfaces read from DB; static fallback only when the query fails or returns no public plans.

| Field | Type | Notes |
|-------|------|-------|
| `priceMonthly` | `Decimal?` | List price before tax |
| `priceYearly` | `Decimal?` | List price before tax |
| `priceOneTime` | `Decimal?` | Optional one-time |
| `setupFee` | `Decimal?` | One-time setup |
| `processingFeePct` | `Decimal?` | Starting processing rate |
| `minimumTransactionCommitment` | `Decimal?` | Monthly transaction-fee floor |
| `tierKey` | `String?` | `essential` \| `growth` \| `scale` \| `business_suite` |
| `currency` | `String` | Default `TRY` |
| `taxRatePct` | `Int` | Default `20` (KDV) |

Checkout totals (when checkout is used in non-production flows) are computed by `computePlanPrice(plan, interval)` in `lib/wexon-checkout-validation.ts`.

## Current WexPay package prices (seeded, four tiers)

| Tier | Plan key | Monthly (TRY) | Setup (TRY) | Public |
|------|----------|---------------|-------------|--------|
| Essential | `wexpay_essential` | 7.000 | 12.000 | yes |
| Growth | `wexpay_growth` | 15.000 | 25.000 | yes |
| Scale | `wexpay_scale` | 35.000 | 45.000 | yes |
| Business Suite | `wexpay_business_suite` | sözleşmeye özel | 75.000+ | yes (manual review) |

Legacy Basic / Standard / Pro (`wexpay_basic`, `wexpay_standard`, `wexpay_pro`) are retired from public catalog (`isPublic: false`). They remain `isActive: true` only while active license or subscription rows still reference them.

## Entitlement soft-deactivation

`Entitlement.isActive` + `deactivatedAt` — admin never physically deletes entitlement rows.

- Admin UI: **Devre Dışı Bırak** / **Yeniden Etkinleştir** with optional note (`setAdminEntitlementActiveAction` → `setEntitlementActiveState`).
- Runtime resolvers (`evaluateProductAccess`, dashboard include, public pricing) filter `entitlements: { where: { isActive: true } }`.
- Physical delete is blocked (`assertEntitlementPhysicalDeleteForbidden`).

## Migration preview (read-only)

`/admin/plans/wexpay-migration` — `buildWexPayPlanMigrationReport()` lists active WexPay licenses with:

- suggested tier, capabilities, capabilities at risk, grandfathering recommendation
- `migrationStatus`: `migrated` when already on suggested tier; else `not_reviewed`
- subscription snapshot (status, interval, period end)

**No production remap** — report is preview-only; license/plan changes require explicit admin action.

## PayTR / checkout posture

- **PayTR Core subscription iFrame** remains behind `PAYTR_SUBSCRIPTION_ENABLE_API` + `PAYTR_IFRAME_ENABLE_API` (default false). Env flags/secrets unchanged in this pass.
- Public customer journey: **no `/checkout` links** on dashboard products or billing success/fail pages — routes to `/packages`, `/demo-request?intent=eligibility`, `/on-basvuru`.
- WexPay operational diner→restaurant PayTR remains separate (`WEXPAY_PAYTR_ENABLE_API` + tenant credentials).

## Surfaces

| Surface | Source |
|---------|--------|
| Admin `/admin/plans` | Create/update prices; soft-deactivate entitlements |
| Admin `/admin/plans/wexpay-migration` | Read-only migration preview |
| Marketing `/products/wexpay`, `/packages`, home pricing | `getPublicWexPayPricingPlans()` (DB; fallback if empty) |
| Customer dashboard `/dashboard/products` | Eligibility / görüşme CTAs; no self-serve checkout |
| Customer dashboard billing | Real `Subscription.status` + invoices/payments |
| Pre-application | Rejects `preferredTier` when plan is inactive or not public |

## Subscription checkout (non-production / gated)

- **Mock** checkout (`createMockCheckoutSubscriptionAction`) — disabled in production.
- **Admin-manual** subscription/invoice/payment recording via admin portal (audit note required on status changes).
- **PayTR iFrame for Core subscriptions:** see `docs/paytr-subscription-checkout.md`.
- Recurring / stored card: **not enabled** — `docs/paytr-recurring-readiness.md`.

## Fallbacks (intentional)

- `lib/wexon-public-pricing-fallback.ts` — client-safe static labels from `WEXPAY_TIER_SEED_DEFAULTS` (used only if DB read fails).
- `checkoutPrice()` narrow fallback when a DB plan row is missing during checkout render.

## Entitlement keys (canonical)

`branch_limit`, `table_limit`, `product_limit`, `staff_limit`, `monthly_order_limit`, `api_request_limit`, `reporting_level`, `integration_level`, `support_level`, `role_level`, plus `feature_*` capability flags.
