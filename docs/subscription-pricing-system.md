# Subscription pricing system

Date: 2026-07-13  
Branch: `cursor/production-backend-hardening`

## Source of truth

**Plan pricing lives in the database** on the `Plan` model:

| Field | Type | Notes |
|-------|------|-------|
| `priceMonthly` | `Decimal?` | List price before tax |
| `priceYearly` | `Decimal?` | List price before tax |
| `priceOneTime` | `Decimal?` | Optional one-time |
| `currency` | `String` | Default `TRY` |
| `taxRatePct` | `Int` | Default `20` (KDV) |

Checkout totals are computed by `computePlanPrice(plan, interval)` in `lib/wexon-checkout-validation.ts` (subtotal + tax + total).

## Current WexPay package prices (seeded)

| Plan | Monthly | Yearly | Currency | Tax |
|------|---------|--------|----------|-----|
| Basic (`wexpay_basic`) | 1490 | 14900 | TRY | 20% |
| Standard (`wexpay_standard`) | 2990 | 29900 | TRY | 20% |
| Pro (`wexpay_pro`) | 5990 | 59900 | TRY | 20% |

## Surfaces

| Surface | Source |
|---------|--------|
| Admin `/admin/plans` | Create/update prices in DB |
| Checkout `/checkout` | Loads plan from DB → `computePlanPrice` |
| Marketing home pricing | `getPublicWexPayPricingPlans()` (DB; static fallback if query fails) |
| `/products/wexpay` | Same DB helper |
| Customer dashboard billing | Real `Subscription.status` + invoices/payments |

## Subscription checkout

- **Mock** checkout (`createMockCheckoutSubscriptionAction`) — disabled in production (`NODE_ENV=production`).
- **Admin-manual** subscription/invoice/payment recording via admin portal.
- **Live PayTR / Stripe for org subscriptions:** out of scope (not built).
- PayTR adapters remain for **operational** diner→restaurant payments only, gated by `WEXPAY_PAYTR_ENABLE_API`.

## Fallbacks (intentional)

- `lib/wexon-public-pricing-fallback.ts` — client-safe static labels matching seed prices (used only if DB read fails).
- `checkoutPrice()` narrow fallback when a DB plan row is missing during checkout render.

## Entitlement keys (canonical)

`branch_limit`, `table_limit`, `product_limit`, `staff_limit`, `monthly_order_limit`, `api_request_limit`, `reporting_level`, `integration_level`, `support_level`, `role_level`.
