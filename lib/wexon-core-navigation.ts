export const dashboardNavigation = [
  { label: "Genel Bakış", shortLabel: "Özet", icon: "overview", href: "/dashboard", section: "genel" as const },
  { label: "WexPay", shortLabel: "WexPay", icon: "wexpay", href: "/apps/wexpay", external: true, section: "genel" as const },
  { label: "Ürünler", shortLabel: "Ürün", icon: "products", href: "/dashboard/products", section: "hesap" as const },
  { label: "Lisanslar", shortLabel: "Lisans", icon: "license", href: "/dashboard/subscription", section: "hesap" as const },
  { label: "Faturalar", shortLabel: "Fatura", icon: "billing", href: "/dashboard/billing", section: "hesap" as const },
  { label: "Organizasyon", shortLabel: "Org", icon: "organization", href: "/dashboard/organization", section: "yonetim" as const },
  { label: "Kullanıcılar", shortLabel: "Kullanıcı", icon: "users", href: "/dashboard/users", section: "yonetim" as const },
  { label: "Entegrasyonlar", shortLabel: "Entegr.", icon: "integrations", href: "/dashboard/integrations", section: "yonetim" as const },
  { label: "Destek", shortLabel: "Destek", icon: "support", href: "/dashboard/support", section: "destek" as const },
  { label: "Aktiviteler", shortLabel: "Aktivite", icon: "activity", href: "/dashboard/activity", section: "destek" as const },
];

export const dashboardNavSectionLabels: Record<(typeof dashboardNavigation)[number]["section"], string> = {
  genel: "Genel",
  hesap: "Hesap",
  yonetim: "Yönetim",
  destek: "Destek",
};
