import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WEXPAY_PRICING_FALLBACK } from "@/lib/wexon-public-pricing-fallback";
import { WEXPAY_PROCESSING_DISCLAIMER } from "@/lib/wexpay-tier-config";

const EXPECTED_PRICES = ["₺7.000/ay", "₺15.000/ay", "₺35.000/ay", "₺99.000/ay"] as const;
const EXPECTED_RATES = ["%2,89", "%2,59", "%2,35", "%2,05"] as const;

describe("wexon public pricing commercial content", () => {
  it("fallback exposes four tiers with DB-aligned monthly prices", () => {
    assert.equal(WEXPAY_PRICING_FALLBACK.length, 4);
    WEXPAY_PRICING_FALLBACK.forEach((plan, index) => {
      assert.equal(plan.priceLabel, EXPECTED_PRICES[index]);
    });
  });

  it("processing labels use başlayan language for all tiers", () => {
    WEXPAY_PRICING_FALLBACK.forEach((plan, index) => {
      assert.ok(plan.processingFeeLabel?.includes("başlayan"), plan.processingFeeLabel);
      assert.ok(plan.processingFeeLabel?.includes(EXPECTED_RATES[index]), plan.processingFeeLabel);
    });
  });

  it("CTAs use self-serve checkout for Essential/Growth and meeting for Scale/Suite", () => {
    const essential = WEXPAY_PRICING_FALLBACK.find((p) => p.id === "essential");
    const growth = WEXPAY_PRICING_FALLBACK.find((p) => p.id === "growth");
    const scale = WEXPAY_PRICING_FALLBACK.find((p) => p.id === "scale");
    const suite = WEXPAY_PRICING_FALLBACK.find((p) => p.id === "business_suite");

    assert.equal(essential?.cta, "Paketi satın al");
    assert.equal(growth?.cta, "Paketi satın al");
    assert.equal(scale?.cta, "Görüşme Planla");
    assert.equal(suite?.cta, "Görüşme Planla");

    assert.ok(essential?.ctaHref?.includes("/checkout"), essential?.ctaHref);
    assert.ok(growth?.ctaHref?.includes("/checkout"), growth?.ctaHref);
    assert.ok(!scale?.ctaHref?.includes("/checkout"), scale?.ctaHref);
    assert.ok(!suite?.ctaHref?.includes("/checkout"), suite?.ctaHref);
  });

  it("includes shared processing disclaimer on every plan model", () => {
    assert.match(WEXPAY_PROCESSING_DISCLAIMER, /İşlem oranları;/);
    assert.match(WEXPAY_PROCESSING_DISCLAIMER, /ödeme sağlayıcısı onayına bağlıdır/);
    for (const plan of WEXPAY_PRICING_FALLBACK) {
      assert.equal(plan.processingDisclaimer, WEXPAY_PROCESSING_DISCLAIMER);
    }
  });

  it("does not expose pilot or marketplace payout claims in feature copy", () => {
    for (const plan of WEXPAY_PRICING_FALLBACK) {
      const blob = [plan.name, plan.audience, ...plan.features, plan.processingFeeLabel ?? ""].join(" ");
      assert.doesNotMatch(blob, /WexPay Pilot/i);
      assert.doesNotMatch(blob, /marketplace|split payout|fon dağıtım/i);
    }
  });
});
