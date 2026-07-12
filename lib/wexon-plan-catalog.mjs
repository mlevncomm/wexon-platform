// @ts-check

/**
 * Canonical WexPay subscription package catalog.
 *
 * This is the single source of truth for package prices, entitlement limits
 * and marketing copy. It is intentionally authored as a plain ESM module so it
 * can be imported by BOTH:
 *   - the TypeScript application (via `@/lib/wexon-plan-catalog.mjs`), and
 *   - the Prisma seed scripts which run under plain Node (`prisma/seed.mjs`,
 *     `prisma/seed-real-tenant.mjs`).
 *
 * Because seed data and runtime pricing are derived from the same list, the
 * checkout price, seeded DB plans and marketing pages can never silently drift.
 * Prices are in TRY (kurus excluded); tax (KDV) is applied on top at checkout.
 */

/** WexPay plan keys as used across checkout, dashboard and marketing. */
export const WEXPAY_PLAN_KEYS = /** @type {const} */ (["basic", "standard", "pro"]);

/** KDV (VAT) rate applied on top of the subtotal at checkout. */
export const WEXPAY_TAX_RATE = 0.2;

/** Default billing currency for all WexPay packages. */
export const WEXPAY_CURRENCY = "TRY";

/**
 * @typedef {"basic" | "standard" | "pro"} WexPayPlanKey
 * @typedef {number | string | boolean} EntitlementValue
 *
 * @typedef {Object} WexPayPlanCatalogEntry
 * @property {WexPayPlanKey} planKey            Short key (basic/standard/pro).
 * @property {string} dbKey                     Prisma `Plan.key` (wexpay_basic ...).
 * @property {string} name                      Canonical plan name (Basic ...).
 * @property {string} description               Internal description.
 * @property {string} audience                  Short marketing audience line.
 * @property {number} sortOrder                 Catalog ordering.
 * @property {number} priceMonthly              Monthly subtotal (TRY, pre-tax).
 * @property {number} priceYearly               Yearly subtotal (TRY, pre-tax).
 * @property {string} currency                  Billing currency (TRY).
 * @property {boolean} highlighted              Whether it is the featured plan.
 * @property {Record<string, EntitlementValue>} entitlements  Limits/feature levels.
 * @property {string[]} features                Marketing bullet list.
 */

/** @type {WexPayPlanCatalogEntry[]} */
export const WEXPAY_PLAN_CATALOG = [
  {
    planKey: "basic",
    dbKey: "wexpay_basic",
    name: "Basic",
    description: "Starter package for single-branch cafes.",
    audience: "Küçük kafe ve tek şubeli işletmeler için temel operasyon limitleri.",
    sortOrder: 1,
    priceMonthly: 1490,
    priceYearly: 14900,
    currency: WEXPAY_CURRENCY,
    highlighted: false,
    entitlements: {
      branch_limit: 1,
      table_limit: 20,
      product_limit: 50,
      staff_limit: 3,
      monthly_transaction_limit: 2000,
      api_request_limit: 10000,
      reporting_level: "basic",
      integration_level: "standard",
      support_level: "standard",
      role_level: "basic",
    },
    features: [
      "1 şube kullanımı",
      "20 masaya kadar QR",
      "50 ürüne kadar menü",
      "3 personel hesabı",
      "Temel raporlar",
      "Standart destek",
    ],
  },
  {
    planKey: "standard",
    dbKey: "wexpay_standard",
    name: "Standard",
    description: "Standard operations package for growing restaurants.",
    audience: "Yoğun restoranlar ve büyüyen ekipler için daha geniş kullanım hakları.",
    sortOrder: 2,
    priceMonthly: 2990,
    priceYearly: 29900,
    currency: WEXPAY_CURRENCY,
    highlighted: true,
    entitlements: {
      branch_limit: 2,
      table_limit: 75,
      product_limit: 250,
      staff_limit: 10,
      monthly_transaction_limit: 10000,
      api_request_limit: 50000,
      reporting_level: "standard",
      integration_level: "standard",
      support_level: "priority",
      role_level: "standard",
    },
    features: [
      "2 şube kullanımı",
      "75 masaya kadar QR",
      "250 ürüne kadar menü",
      "10 personel hesabı",
      "Gelişmiş raporlar",
      "Rol bazlı yetkilendirme",
      "Öncelikli destek",
    ],
  },
  {
    planKey: "pro",
    dbKey: "wexpay_pro",
    name: "Pro",
    description: "Advanced package for multi-branch restaurant operations.",
    audience: "Çok şubeli işletmeler ve ileri operasyon ihtiyaçları için.",
    sortOrder: 3,
    priceMonthly: 5990,
    priceYearly: 59900,
    currency: WEXPAY_CURRENCY,
    highlighted: false,
    entitlements: {
      branch_limit: 10,
      table_limit: 300,
      product_limit: 1000,
      staff_limit: 50,
      monthly_transaction_limit: 50000,
      api_request_limit: 250000,
      reporting_level: "advanced",
      integration_level: "advanced",
      support_level: "priority",
      role_level: "advanced",
    },
    features: [
      "10 şubeye kadar kullanım",
      "300 masaya kadar QR",
      "1000 ürüne kadar menü",
      "50 personel hesabı",
      "İleri raporlama",
      "Geniş entegrasyon seviyesi",
      "Gelişmiş yetkilendirme",
      "Öncelikli destek",
    ],
  },
];

/**
 * Look up a WexPay catalog entry by its short plan key.
 * @param {string} planKey
 * @returns {WexPayPlanCatalogEntry | null}
 */
export function getWexPayPlan(planKey) {
  return WEXPAY_PLAN_CATALOG.find((plan) => plan.planKey === planKey) ?? null;
}

/**
 * Compute the subtotal / tax / total breakdown for a given pre-tax subtotal.
 * @param {number} subtotal
 * @returns {{ subtotal: number; tax: number; total: number; currency: string }}
 */
export function withTax(subtotal) {
  const tax = Math.round(subtotal * WEXPAY_TAX_RATE);
  return { subtotal, tax, total: subtotal + tax, currency: WEXPAY_CURRENCY };
}
