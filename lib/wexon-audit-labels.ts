const ACTION_LABELS: Record<string, string> = {
  "admin.organization.created": "Müşteri oluşturuldu",
  "admin.organization.updated": "Müşteri güncellendi",
  "admin.organization.deactivated": "Müşteri pasifleştirildi",
  "admin.organization.reactivated": "Müşteri yeniden aktifleştirildi",
  "admin.organization.permanently_deleted": "Müşteri kalıcı silindi",
  "admin.license.created": "Lisans oluşturuldu",
  "admin.license.plan_changed": "Lisans planı değiştirildi",
  "admin.license.status_changed": "Lisans durumu değiştirildi",
  "admin.product_access.enabled": "Ürün erişimi açıldı",
  "admin.product_access.status_changed": "Ürün erişim durumu değişti",
  "admin.restaurant.created": "Restoran oluşturuldu",
  "admin.membership.added": "Üyelik eklendi",
  "customer.signup.created": "Kayıt tamamlandı",
  "customer.checkout.completed": "Ödeme tamamlandı",
  "customer.subscription.created": "Abonelik oluşturuldu",
  "customer.onboarding.started": "Onboarding başladı",
  "customer.password.changed": "Şifre değiştirildi",
  "customer.organization.updated": "Organizasyon güncellendi",
  "customer.membership.added": "Üye eklendi",
  "customer.membership.role_updated": "Üye rolü güncellendi",
  "customer.membership.deactivated": "Üyelik pasifleştirildi",
  "customer.membership.reactivated": "Üyelik aktifleştirildi",
  "customer.support_ticket.created": "Destek talebi açıldı",
  "customer.api_key.created": "API anahtarı oluşturuldu",
  "customer.api_key.deactivated": "API anahtarı iptal edildi",
  "customer.webhook.created": "Webhook oluşturuldu",
  "customer.webhook.deactivated": "Webhook iptal edildi",
  "customer.auth.login_failed": "Giriş başarısız",
  "wexpay.restaurant.created": "WexPay restoran oluşturuldu",
  "wexpay.branch.created": "WexPay şube oluşturuldu",
  "wexpay.table.created": "Masa oluşturuldu",
  "wexpay.table.closed": "Masa kapatıldı",
  "wexpay.menu_category.created": "Menü kategorisi oluşturuldu",
  "wexpay.menu_product.created": "Menü ürünü oluşturuldu",
  "wexpay.order.created": "Sipariş oluşturuldu",
  "wexpay.order.updated": "Sipariş güncellendi",
  "wexpay.payment.created": "Ödeme oluşturuldu",
  "wexpay.payment.updated": "Ödeme güncellendi",
  "api.access.denied": "API erişimi reddedildi",
  "api.invalid_json": "Geçersiz API isteği",
  "wexpay.api.validation": "WexPay API doğrulama hatası",
  "wexpay.api.access": "WexPay API erişim hatası",
  "wexpay.api.internal": "WexPay API sistem hatası",
  "wexpay.ui.validation": "WexPay panel doğrulama hatası",
  "wexpay.ui.access": "WexPay panel erişim hatası",
  "wexpay.ui.internal": "WexPay panel sistem hatası",
};

const LEVEL_LABELS: Record<string, string> = {
  INFO: "Bilgi",
  WARN: "Uyarı",
  ERROR: "Hata",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Başarılı",
  FAILURE: "Başarısız",
};

export function getAuditActionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("wexpay.demo.")) return `WexPay demo: ${action.replace("wexpay.demo.", "").replaceAll(".", " ")}`;
  if (action.startsWith("api.access.")) return `API erişim: ${action.replace("api.access.", "").replaceAll("_", " ")}`;
  return action.replaceAll(".", " · ");
}

export function getAuditLevelLabel(level: string) {
  return LEVEL_LABELS[level] ?? level;
}

export function getAuditStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function readAuditMetadataSource(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null) return null;
  const source = (metadata as { source?: unknown }).source;
  return typeof source === "string" ? source : null;
}
