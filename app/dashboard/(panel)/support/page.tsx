import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardStatusPill,
} from "@/components/marketing/WexonDashboardCards";
import { createCustomerSupportTicketAction } from "@/lib/wexon-customer-actions";
import { getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string; customerError?: string }>;
type SupportTicketMeta = {
  subject?: string;
  category?: string;
  priority?: string;
  message?: string;
  status?: string;
};

const categoryLabels: Record<string, string> = {
  GENERAL: "Genel",
  WEXPAY: "WexPay",
  BILLING: "Fatura",
  INTEGRATION: "Entegrasyon",
  TECHNICAL: "Teknik destek",
};

const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  NORMAL: "Normal",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};

export default async function DashboardSupportPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization } = await getCustomerDashboardData(params);

  if (!organization) {
    return <DashboardEmptyState title="Organizasyon bulunamadı." description="Destek talepleri için organizasyon kaydı gereklidir." />;
  }

  const tickets = organization.auditLogs.filter((log) => log.action === "customer.support_ticket.created");

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Destek"
        title="Destek talepleri"
        description="Wexon ekibine iletmek istediğiniz konu, fatura veya entegrasyon taleplerini buradan oluşturabilirsiniz."
      />
      {params.customerError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {params.customerError}
        </div>
      )}

      <DashboardPanel>
        <h2 className="mb-5 text-xl font-black tracking-tight text-slate-950">Yeni destek talebi</h2>
        <form action={createCustomerSupportTicketAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="organizationId" value={organization.id} />
          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Konu</span>
            <input name="subject" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Kategori</span>
            <select name="category" defaultValue="GENERAL" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Öncelik</span>
            <select name="priority" defaultValue="NORMAL" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Açıklama</span>
            <textarea name="message" required rows={5} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Destek talebi oluştur
            </button>
          </div>
        </form>
      </DashboardPanel>

      <DashboardPanel>
        <h2 className="mb-5 text-xl font-black tracking-tight text-slate-950">Önceki talepler</h2>
        {tickets.length === 0 ? (
          <DashboardEmptyState title="Henüz destek talebi yok." description="Yeni talepleriniz burada listelenir." />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const meta = ticket.metadataJson as SupportTicketMeta;
              return (
                <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{meta.subject ?? "Destek talebi"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{ticket.createdAt.toLocaleString("tr-TR")}</p>
                    </div>
                    <DashboardStatusPill active={meta.status === "OPEN"}>{meta.status === "OPEN" ? "Açık" : "Kayıt"}</DashboardStatusPill>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-600">{meta.message ?? "-"}</p>
                </div>
              );
            })}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
