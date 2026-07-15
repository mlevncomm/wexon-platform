import Link from "next/link";
import { Suspense } from "react";
import DashboardDetailDrawer from "@/components/marketing/DashboardDetailDrawer";
import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardKpiGrid,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardStatusPill,
  DashboardSummaryCard,
  DashboardTableShell,
} from "@/components/marketing/WexonDashboardCards";
import { createCustomerSupportTicketAction } from "@/lib/wexon-customer-actions";
import { dashboardHref, getCustomerDashboardData, type DashboardOrganizationContext } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{
  organizationId?: string;
  organizationSlug?: string;
  customerError?: string;
  ticketId?: string;
}>;
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

function supportHref(context: DashboardOrganizationContext, extra?: Record<string, string | undefined>) {
  const base = dashboardHref("/dashboard/support", context);
  const url = new URL(base, "http://local");
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
  }
  return `${url.pathname}${url.search}`;
}

export default async function DashboardSupportPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization, organizationContext } = await getCustomerDashboardData(params);

  if (!organization) {
    return <DashboardEmptyState title="Organizasyon bulunamadı." description="Destek talepleri için organizasyon kaydı gereklidir." />;
  }

  const tickets = organization.auditLogs.filter((log) => log.action === "customer.support_ticket.created");
  const openCount = tickets.filter((ticket) => {
    const meta = ticket.metadataJson as SupportTicketMeta;
    const status = meta.status ?? "OPEN";
    return status === "OPEN" || status === "IN_PROGRESS";
  }).length;
  const selected = tickets.find((ticket) => ticket.id === params.ticketId) ?? null;
  const selectedMeta = selected ? (selected.metadataJson as SupportTicketMeta) : null;
  const listHref = supportHref(organizationContext);

  return (
    <div className="space-y-6 sm:space-y-8">
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

      <DashboardKpiGrid>
        <DashboardSummaryCard label="Toplam talep" value={tickets.length} />
        <DashboardSummaryCard label="Açık / devam" value={openCount} tone={openCount > 0 ? "warning" : "default"} />
        <DashboardSummaryCard label="Kapalı / kayıt" value={Math.max(tickets.length - openCount, 0)} />
        <DashboardSummaryCard label="Organizasyon" value={organization.isActive ? "Aktif" : "Pasif"} />
      </DashboardKpiGrid>

      <DashboardPanel>
        <h2 className="mb-5 text-xl font-black tracking-tight text-slate-950">Yeni destek talebi</h2>
        <form action={createCustomerSupportTicketAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="organizationId" value={organization.id} />
          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Konu</span>
            <input
              name="subject"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Kategori</span>
            <select
              name="category"
              defaultValue="GENERAL"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Öncelik</span>
            <select
              name="priority"
              defaultValue="NORMAL"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Açıklama</span>
            <textarea
              name="message"
              required
              rows={5}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
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
          <DashboardTableShell>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="font-black">Konu</th>
                  <th className="font-black">Kategori</th>
                  <th className="font-black">Öncelik</th>
                  <th className="font-black">Durum</th>
                  <th className="font-black">Tarih</th>
                  <th className="font-black">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const meta = ticket.metadataJson as SupportTicketMeta;
                  return (
                    <tr key={ticket.id}>
                      <td className="font-bold text-slate-950">{meta.subject ?? "Destek talebi"}</td>
                      <td className="font-semibold text-slate-600">
                        {categoryLabels[meta.category ?? ""] ?? meta.category ?? "-"}
                      </td>
                      <td className="font-semibold text-slate-600">
                        {priorityLabels[meta.priority ?? ""] ?? meta.priority ?? "-"}
                      </td>
                      <td>
                        <DashboardStatusPill active={meta.status === "OPEN"}>
                          {meta.status === "OPEN" ? "Açık" : meta.status === "IN_PROGRESS" ? "Devam" : "Kayıt"}
                        </DashboardStatusPill>
                      </td>
                      <td className="font-semibold text-slate-600">{ticket.createdAt.toLocaleString("tr-TR")}</td>
                      <td>
                        <Link
                          href={supportHref(organizationContext, { ticketId: ticket.id })}
                          className="text-xs font-black text-emerald-700 hover:underline"
                        >
                          Aç
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DashboardTableShell>
        )}
      </DashboardPanel>

      <Suspense fallback={null}>
        <DashboardDetailDrawer
          open={Boolean(selected)}
          title={selectedMeta?.subject ?? "Destek talebi"}
          subtitle={selected ? selected.createdAt.toLocaleString("tr-TR") : undefined}
          closeHref={listHref}
        >
          {selectedMeta ? (
            <div className="space-y-3">
              <DashboardInfoRow
                label="Kategori"
                value={categoryLabels[selectedMeta.category ?? ""] ?? selectedMeta.category ?? "-"}
              />
              <DashboardInfoRow
                label="Öncelik"
                value={priorityLabels[selectedMeta.priority ?? ""] ?? selectedMeta.priority ?? "-"}
              />
              <DashboardInfoRow label="Durum" value={selectedMeta.status ?? "OPEN"} />
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-700">
                {selectedMeta.message ?? "-"}
              </p>
            </div>
          ) : null}
        </DashboardDetailDrawer>
      </Suspense>
    </div>
  );
}
