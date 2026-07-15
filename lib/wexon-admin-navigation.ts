export type AdminNavItem = {
  label: string;
  shortLabel: string;
  icon: string;
  href: string;
  section?: "operasyon" | "finans" | "sistem";
};

export const adminNavigation: AdminNavItem[] = [
  { label: "Genel Bakış", shortLabel: "Özet", icon: "overview", href: "/admin", section: "operasyon" },
  { label: "Müşteriler", shortLabel: "Müşteri", icon: "customers", href: "/admin/organizations", section: "operasyon" },
  { label: "Kullanıcılar", shortLabel: "Kullanıcı", icon: "customers", href: "/admin/users", section: "operasyon" },
  { label: "Ön Başvurular", shortLabel: "Başvuru", icon: "support", href: "/admin/applications", section: "operasyon" },
  { label: "Destek", shortLabel: "Destek", icon: "support", href: "/admin/support", section: "operasyon" },
  { label: "Lisanslar", shortLabel: "Lisans", icon: "license", href: "/admin/licenses", section: "finans" },
  { label: "Faturalar", shortLabel: "Fatura", icon: "billing", href: "/admin/billing", section: "finans" },
  { label: "İşlem Geçmişi", shortLabel: "Log", icon: "activity", href: "/admin/audit-logs", section: "sistem" },
  { label: "Ayarlar", shortLabel: "Ayar", icon: "settings", href: "/admin/settings", section: "sistem" },
];

export const adminSecondaryNavigation = [
  { label: "Ürün Kataloğu", href: "/admin/products" },
  { label: "Paketler", href: "/admin/plans" },
  { label: "WexPay geçiş önizlemesi", href: "/admin/plans/wexpay-migration" },
  { label: "Abonelikler", href: "/admin/subscriptions" },
  { label: "Entegrasyonlar", href: "/admin/integrations" },
  { label: "Müşteri Özeti", href: "/admin/customers" },
];

export const adminNavSectionLabels: Record<"operasyon" | "finans" | "sistem" | "teknik", string> = {
  operasyon: "Operasyon",
  finans: "Finans",
  sistem: "Sistem",
  teknik: "Teknik",
};

export const adminCommandRoutes = [
  ...adminNavigation.map((item) => ({
    label: item.label,
    href: item.href,
    group: "Sayfalar",
    keywords: item.shortLabel,
  })),
  ...adminSecondaryNavigation.map((item) => ({
    label: item.label,
    href: item.href,
    group: "Katalog",
    keywords: "",
  })),
  { label: "Yeni müşteri oluştur", href: "/admin/organizations", group: "Hızlı işlem", keywords: "organizasyon ekle" },
  { label: "Müşteri paneli", href: "/dashboard", group: "Önizleme", keywords: "core müşteri organizationId" },
  { label: "WexPay operasyon", href: "/apps/wexpay", group: "Önizleme", keywords: "wexpay organizationId" },
  { label: "Ana site", href: "/", group: "Önizleme", keywords: "marketing" },
];
