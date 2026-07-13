import type { PricingPlan } from "@/types/wexon";

/** Static fallback only — safe for client bundles. Prefer DB via getPublicWexPayPricingPlans on the server. */
export const WEXPAY_PRICING_FALLBACK: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    audience: "Tek şubeli kafe ve küçük işletmeler",
    priceLabel: "₺1.490/ay",
    billingNote: "WexPay · aylık veya yıllık",
    features: ["1 şube", "20 masa", "50 ürün", "Temel raporlar", "Standart destek"],
    cta: "Abonelik Başlat",
  },
  {
    id: "standard",
    name: "Standard",
    audience: "Büyüyen restoranlar ve ekipler",
    priceLabel: "₺2.990/ay",
    billingNote: "WexPay · aylık veya yıllık",
    features: ["2 şube", "75 masa", "250 ürün", "Gelişmiş raporlar", "Öncelikli destek"],
    cta: "Abonelik Başlat",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Çok şubeli operasyonlar",
    priceLabel: "₺5.990/ay",
    billingNote: "WexPay · aylık veya yıllık",
    features: ["10 şube", "300 masa", "1000 ürün", "İleri raporlama", "Öncelikli destek"],
    cta: "Abonelik Başlat",
  },
];

export const ENTERPRISE_PRICING_PLAN: PricingPlan = {
  id: "enterprise",
  name: "Enterprise",
  audience: "Özel kurulum, entegrasyon ve SLA ihtiyacı olanlar",
  priceLabel: "Teklif al",
  billingNote: "Özel kurulum · SLA",
  features: ["Özel entegrasyon", "SLA ve gelişmiş destek", "Tek seferlik lisans seçeneği", "Özel yetki kurgusu"],
  cta: "Teklif Al",
};
