import { AdminInfoRow, AdminMetricGroup, AdminMetricStrip, AdminPanel, AdminSectionTitle } from "@/components/marketing/WexonAdminCards";
import { AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { deleteAllTestOrganizationsAction } from "@/lib/wexon-admin-actions";
import { getAdminHeaderSnapshot, getAdminSettingsData } from "@/lib/wexon-admin";

const controlSections = [
  {
    title: "Müşteri ve erişim",
    items: [
      ["Müşteriler", "/admin/organizations"],
      ["Kullanıcılar", "/admin/users"],
      ["Müşteri özeti", "/admin/customers"],
      ["Lisanslar", "/admin/licenses"],
    ] as Array<[string, string]>,
  },
  {
    title: "Gelir ve katalog",
    items: [
      ["Faturalar", "/admin/billing"],
      ["Abonelikler", "/admin/subscriptions"],
      ["Ürün kataloğu", "/admin/products"],
      ["Paketler", "/admin/plans"],
    ] as Array<[string, string]>,
  },
  {
    title: "Operasyon ve güvenlik",
    items: [
      ["Entegrasyonlar", "/admin/integrations"],
      ["Destek masası", "/admin/support"],
      ["İşlem geçmişi", "/admin/audit-logs"],
      ["Hata logları", "/admin/audit-logs?status=FAILURE"],
    ] as Array<[string, string]>,
  },
];

export default async function AdminSettingsPage() {
  const [snapshot, stats] = await Promise.all([getAdminHeaderSnapshot(), getAdminSettingsData()]);
  const hasPendingWork = snapshot.stats.pendingWork > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Ayarlar"
          title="Admin komuta merkezi"
          description="Tüm platform kaynaklarına tek noktadan erişin. Özet, kısayollar ve geliştirici araçları."
        />
        <AdminQuickLinks
          links={[
            { label: "Yeni müşteri", href: "/admin/organizations" },
            { label: "Fatura kes", href: "/admin/billing" },
            { label: "Paket düzenle", href: "/admin/plans" },
            { label: "Kullanıcı ara", href: "/admin/users" },
          ]}
        />
      </div>

      <AdminPanel>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Canlı durum</p>
        <h3 className="mt-1 text-xl font-black text-slate-950">Operasyon özeti</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">Dikkat gerektiren işler tek satırda.</p>
        <div className="mt-5">
          <AdminMetricStrip
            items={[
              { label: "Müşteri", value: snapshot.stats.organizations },
              { label: "Bekleyen iş", value: snapshot.stats.pendingWork, highlight: hasPendingWork },
              { label: "Açık destek", value: snapshot.stats.openSupportTickets, highlight: snapshot.stats.openSupportTickets > 0 },
              { label: "Dikkat lisans", value: snapshot.stats.attentionLicenses, highlight: snapshot.stats.attentionLicenses > 0 },
            ]}
          />
        </div>
      </AdminPanel>

      <AdminPanel>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Platform</p>
        <h3 className="mt-1 text-xl font-black text-slate-950">Kayıt envanteri</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">Tüm veritabanı kayıtları kategorilere göre gruplandı.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <AdminMetricGroup
            title="Müşteri ve erişim"
            items={[
              { label: "Kullanıcı", value: stats.users, helper: "Global hesap" },
              { label: "Lisans", value: stats.licenses },
              { label: "İşletme", value: stats.restaurants, helper: "WexPay" },
            ]}
          />
          <AdminMetricGroup
            title="Gelir ve katalog"
            items={[
              { label: "Ürün", value: stats.products },
              { label: "Paket", value: stats.plans },
              { label: "Fatura", value: stats.invoices },
              { label: "Tahsilat", value: stats.payments },
            ]}
          />
          <AdminMetricGroup
            title="Teknik ve log"
            items={[
              { label: "API anahtarı", value: stats.apiKeys },
              { label: "Webhook", value: stats.webhooks },
              { label: "Audit kayıt", value: stats.auditLogs },
            ]}
          />
        </div>
      </AdminPanel>

      <div className="grid gap-5 lg:grid-cols-3">
        {controlSections.map((section) => (
          <AdminPanel key={section.title}>
            <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
            <div className="mt-5 grid gap-2">
              {section.items.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <span>{label}</span>
                  <span aria-hidden>→</span>
                </a>
              ))}
            </div>
          </AdminPanel>
        ))}
      </div>

      <AdminPanel>
        <h2 className="text-xl font-black text-slate-950">Yetki ve sistem</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <AdminInfoRow label="Admin erişimi" value="ADMIN_EMAILS ortam değişkeni" />
          <AdminInfoRow label="Audit" value="Tüm admin işlemleri loglanır" />
          <AdminInfoRow label="Limit kaynağı" value="Plan entitlement düzenlenebilir" />
          <AdminInfoRow label="Manuel tahsilat" value="/admin/billing üzerinden" />
          <AdminInfoRow label="API anahtarı" value="Admin oluşturabilir (5 dk flash)" />
          <AdminInfoRow label="Destek" value="Durum + yanıt yönetimi aktif" />
        </div>
      </AdminPanel>

      <details className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
        <summary className="cursor-pointer text-lg font-black text-amber-950">Geliştirici işlemleri</summary>
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold leading-relaxed text-amber-900">
            Bu işlem yalnızca local geliştirme/test ortamı içindir. Fatura veya ödeme kaydı olan müşteriler silinmez.
          </p>
          <form action={deleteAllTestOrganizationsAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">Onay metni</span>
              <input
                name="confirmText"
                placeholder="TÜM TEST MÜŞTERİLERİNİ SİL"
                className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
              />
            </label>
            <button type="submit" className="rounded-2xl bg-amber-700 px-5 py-3 text-sm font-black text-white hover:bg-amber-800">
              Tüm test müşterilerini sil
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
