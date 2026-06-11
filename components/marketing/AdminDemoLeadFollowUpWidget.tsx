import Link from "next/link";
import { AdminEmptyState, AdminPanel, AdminSectionTitle, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import {
  demoLeadStatusBadgeClass,
  demoLeadStatusLabels,
  followUpDateBadgeClass,
  followUpDateStateLabels,
  formatFollowUpDateLabel,
} from "@/lib/wexon-demo-request-leads";
import type { AdminDemoLeadFollowUpWidgetData } from "@/lib/wexon-admin";

function DemoBadge({ children, className }: { children: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export default function AdminDemoLeadFollowUpWidget({ data }: { data: AdminDemoLeadFollowUpWidgetData }) {
  return (
    <AdminPanel>
      <AdminSectionTitle
        badge="Demo CRM"
        title="Bugün takip edilecek demo talepleri"
        description="Takip tarihi bugün veya gecikmiş olan aktif lead kayıtları. Kazanılan ve kaybedilen lead’ler listede yer almaz."
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Yeni demo talepleri" value={data.stats.newLeads} />
        <AdminSummaryCard label="Bugün takip" value={data.stats.todayFollowUp} />
        <AdminSummaryCard label="Gecikmiş takip" value={data.stats.overdueFollowUp} />
        <AdminSummaryCard label="Kazanılan lead" value={data.stats.wonLeads} />
      </section>

      {data.items.length === 0 ? (
        <AdminEmptyState>Bugün takip edilecek demo talebi yok.</AdminEmptyState>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <Link
              key={item.id}
              href={item.supportHref}
              className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{item.fullName}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-600">{item.company}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DemoBadge className={followUpDateBadgeClass(item.followUpDateState)}>
                    {followUpDateStateLabels[item.followUpDateState]}
                  </DemoBadge>
                  <span className="text-xs font-bold text-slate-500">{formatFollowUpDateLabel(item.followUpAt)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <DemoBadge className="bg-emerald-50 text-emerald-700 ring-emerald-100">{item.product}</DemoBadge>
                <DemoBadge className="bg-teal-50 text-teal-700 ring-teal-100">{item.sourceLabel}</DemoBadge>
                <DemoBadge className={demoLeadStatusBadgeClass(item.leadStatus)}>
                  {demoLeadStatusLabels[item.leadStatus]}
                </DemoBadge>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                {item.note ?? "Takip notu yok."}
              </p>
            </Link>
          ))}

          <div className="pt-1">
            <Link
              href="/admin/support"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              Tüm demo taleplerini gör
            </Link>
          </div>
        </div>
      )}
    </AdminPanel>
  );
}
