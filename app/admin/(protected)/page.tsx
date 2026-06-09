import Link from "next/link";
import {
  AdminEmptyState,
  AdminInfoRow,
  AdminPanel,
  AdminSectionTitle,
  AdminSummaryCard,
} from "@/components/marketing/WexonAdminCards";
import { getAdminOverviewData } from "@/lib/wexon-admin";
import { dashboardPreviewHref, wexpayHref } from "@/lib/wexon-organization-context";

export default async function AdminPage() {
  const { organizations, licenses, invoices, auditLogs, wexPayAccessDecisions } = await getAdminOverviewData();
  const activeLicenses = licenses.filter((license) => license.status === "ACTIVE");
  const activeWexPayInstallations = wexPayAccessDecisions.filter((decision) => decision.allowed);
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "ISSUED" || invoice.status === "OVERDUE");
  const pendingWork = pendingInvoices.length + licenses.filter((license) => license.status === "TRIAL" || license.status === "PAST_DUE").length;
  const quickActions = [
    { title: "Yeni müşteri oluştur", href: "/admin/organizations", helper: "Organizasyon kaydını başlat" },
    { title: "Müşterileri görüntüle", href: "/admin/organizations", helper: "Aktif müşteri ve lisans durumları" },
    { title: "Lisansları görüntüle", href: "/admin/licenses", helper: "Tüm lisans kayıtları" },
    { title: "İşlem geçmişi", href: "/admin/audit-logs", helper: "Son admin ve sistem kayıtları" },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-8 text-white shadow-2xl shadow-slate-950/20 sm:p-12">
        <div className="relative max-w-5xl">
          <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            Wexon Admin
          </span>
          <h1 className="text-4xl font-black leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
            Müşteri yönetimini buradan başlatın
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Yeni müşteri oluşturun, WexPay erişimini açın, paket/lisans atayın ve müşteri paneline yansımasını kontrol edin.
          </p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Toplam müşteri" value={organizations.length} />
        <AdminSummaryCard label="Aktif WexPay müşterisi" value={activeWexPayInstallations.length} />
        <AdminSummaryCard label="Aktif lisans" value={activeLicenses.length} />
        <AdminSummaryCard label="Bekleyen işlem" value={pendingWork} />
      </section>

      <AdminPanel>
        <AdminSectionTitle
          badge="Platform köprüsü"
          title="Admin · Core · WexPay"
          description="Üç yüzey aynı organizasyon bağlamıyla birbirine bağlıdır. Müşteri detayından Core ve WexPay önizlemesine geçin."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/admin/organizations" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50">
            <p className="text-sm font-black text-slate-950">1. Admin</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Müşteri oluştur, lisans ata, erişim aç</p>
          </Link>
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
            2. Wexon Core — müşteri detayından{" "}
            <span className="font-black text-slate-700">Wexon Core paneli</span> ile önizleme
          </p>
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
            3. WexPay — aynı müşteride{" "}
            <span className="font-black text-slate-700">WexPay operasyonları</span> ile canlı panel
          </p>
        </div>
        {organizations[0] ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={dashboardPreviewHref(organizations[0].id)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600"
            >
              Son müşteri: Core önizleme
            </Link>
            <Link
              href={wexpayHref("/apps/wexpay", organizations[0].id)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Son müşteri: WexPay
            </Link>
          </div>
        ) : null}
      </AdminPanel>

      <section className="grid gap-6 lg:grid-cols-2">
        <AdminPanel>
          <AdminSectionTitle badge="Hızlı işlemler" title="Günlük admin akışı" description="En sık kullanılan işlemler 1-2 tık uzakta." />
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="text-sm font-black text-slate-950">{action.title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{action.helper}</p>
              </Link>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle badge="Aktivite" title="Son aktiviteler" />
          {auditLogs.length === 0 ? (
            <AdminEmptyState>Henüz işlem kaydı bulunmuyor.</AdminEmptyState>
          ) : (
            <div className="space-y-3">
              {auditLogs.slice(0, 5).map((log) => (
                <AdminInfoRow key={log.id} label={log.action} value={log.createdAt.toLocaleString("tr-TR")} />
              ))}
            </div>
          )}
        </AdminPanel>
      </section>
    </div>
  );
}
