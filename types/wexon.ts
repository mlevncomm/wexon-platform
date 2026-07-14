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

/** Shared icon keys for the marketing homepage inline-SVG icon set. */
export type WexonIconName =
  | "qr"
  | "hotel"
  | "b2b"
  | "layers"
  | "users"
  | "catalog"
  | "license"
  | "subscription"
  | "billing"
  | "entitlement"
  | "key"
  | "audit"
  | "bell"
  | "shield"
  | "isolation"
  | "webhook"
  | "adapter"
  | "table"
  | "invoice"
  | "settings"
  | "team"
  | "products"
  | "dashboard"
  | "customers"
  | "support"
  | "arrowRight"
  | "check"
  | "menu"
  | "cart"
  | "order"
  | "track"
  | "pay";

export type ProductAccent = "emerald" | "indigo" | "amber";

export interface EcosystemProduct {
  id: ProductId;
  name: string;
  icon: WexonIconName;
  accent: ProductAccent;
  statusLabel: string;
  tagline: string;
  description: string;
  tags: string[];
  href: string;
  primary?: boolean;
}

export interface CoreCapability {
  icon: WexonIconName;
  title: string;
  description: string;
}

/** Semantic status tones shared across all preview status badges. */
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

export interface PreviewNotification {
  title: string;
  detail: string;
  tone: StatusTone;
}

export interface PreviewMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface FlowStep {
  step: number;
  icon: WexonIconName;
  title: string;
  description: string;
  side: "customer" | "business";
}

export interface PanelNavItem {
  icon: WexonIconName;
  label: string;
  active?: boolean;
}

/* ---------------------------------------------------------------------------
 * Wexon Core / Admin panel (internal management screen)
 * ------------------------------------------------------------------------- */

export interface AdminMetric {
  label: string;
  value: string;
  hint: string;
  tone?: StatusTone;
}

export interface AdminOrganizationRow {
  organization: string;
  activeProducts: string;
  plan: string;
  billingState: StatusBadge;
  accessState: StatusBadge;
  status: StatusBadge;
}

export interface AdminActivityItem {
  icon: WexonIconName;
  title: string;
  detail: string;
  tone: StatusTone;
}

/* ---------------------------------------------------------------------------
 * Customer Portal (organization self-service screen)
 * ------------------------------------------------------------------------- */

export interface CustomerProductCard {
  name: string;
  accent: ProductAccent;
  licenseStatus: StatusBadge;
  renewalDate: string;
  seatUsage: string;
  quotaLabel: string;
  quotaPercent: number;
  appHref: string;
}

export interface BillingSummary {
  currentPlan: string;
  nextInvoiceDate: string;
  paymentMethod: string;
  outstandingBalance: string;
}

export interface TeamMember {
  name: string;
  role: string;
  email: string;
}

/* ---------------------------------------------------------------------------
 * Product App panels (per-product operational screens)
 * ------------------------------------------------------------------------- */

export type WexPayTableState =
  | "empty"
  | "occupied"
  | "ordered"
  | "awaiting"
  | "partial"
  | "paid";

export interface WexPayTableCell {
  label: string;
  state: WexPayTableState;
  amount?: string;
}

export interface WexPayAppData {
  tables: WexPayTableCell[];
  notifications: PreviewNotification[];
  metrics: PreviewMetric[];
  qrFlow: { icon: WexonIconName; label: string }[];
}

export type HotelRoomState = "available" | "occupied" | "cleaning" | "reserved";

export interface HotelRoomCell {
  label: string;
  state: HotelRoomState;
}

export interface HotelReservationRow {
  guest: string;
  room: string;
  checkIn: string;
  checkOut: string;
  payment: StatusBadge;
}

export interface WexHotelAppData {
  rooms: HotelRoomCell[];
  reservations: HotelReservationRow[];
  metrics: PreviewMetric[];
}

export interface B2BCatalogRow {
  product: string;
  stock: string;
  dealerPrice: string;
  status: StatusBadge;
}

export interface B2BOrderRow {
  dealer: string;
  quote: string;
  orderStatus: StatusBadge;
  payment: StatusBadge;
}

export interface WexB2BAppData {
  catalog: B2BCatalogRow[];
  orders: B2BOrderRow[];
  metrics: PreviewMetric[];
}

export interface PricingPlan {
  id: string;
  name: string;
  audience: string;
  priceLabel: string;
  billingNote: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  setupFeeLabel?: string;
  processingFeeLabel?: string;
  commitmentLabel?: string;
  commitmentNote?: string;
  processingDisclaimer?: string;
  settlementDisplay?: string;
  ctaHref?: string;
}

export interface SecurityItem {
  icon: WexonIconName;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Honest trust signal chip (pilot-stage, not fabricated client logos). */
export interface TrustSignal {
  icon: WexonIconName;
  label: string;
}

/** Structural platform stat for the homepage stat strip. */
export interface HomeStat {
  value: string;
  label: string;
  hint?: string;
  highlighted?: boolean;
}

/* ---------------------------------------------------------------------------
 * Roadmap product pages (not-yet-launched products, e.g. WexHotel / WexB2B)
 * ------------------------------------------------------------------------- */

export interface RoadmapProductContent {
  id: ProductId;
  name: string;
  accent: ProductAccent;
  statusLabel: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  ecosystemNote: string;
  roadmapNote: string;
  capabilities: CoreCapability[];
  faq: FaqItem[];
}
