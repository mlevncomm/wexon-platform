export type ProductId = "wexpay" | "wexhotel" | "wexb2b";

export interface WexonProduct {
  id: ProductId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  features: string[];
  href: string;
  statusLabel?: string;
}

export interface PricingTier {
  id: string;
  product: string;
  name: string;
  monthlyPrice: number | null;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

export interface WexonStat {
  value: string;
  label: string;
  description: string;
}

export interface DemoMetric {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export interface DemoCard {
  productId: ProductId;
  productName: string;
  title: string;
  metrics: DemoMetric[];
}

export interface NavLink {
  label: string;
  href: string;
}
