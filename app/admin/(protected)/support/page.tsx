import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  AdminStatGrid,
  AdminStatusPill,
  AdminSummaryCard,
} from "@/components/marketing/WexonAdminCards";
import AdminDemoRequestsPanel from "@/components/marketing/AdminDemoRequestsPanel";
import { AdminActionNotice, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink } from "@/components/marketing/WexonAdminOperations";
import { updateAdminSupportTicketAction } from "@/lib/wexon-admin-actions";
import { formatAdminDate, getAdminDemoRequestsData, getAdminSupportTicketsData } from "@/lib/wexon-admin";

type SupportTicketMeta = {
  subject?: string;
  category?: string;
  priority?: string;
  message?: string;
  status?: string;
  adminReply?: string;
  adminRepliedAt?: string;
  actor?: { email?: string; userId?: string };
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

const ticketStatusOptions = [
  { value: "OPEN", label: "Açık" },
  { value: "IN_PROGRESS", label: "İşlemde" },
  { value: "RESOLVED", label: "Çözüldü" },
  { value: "CLOSED", label: "Kapatıldı" },
];

function readMeta(value: unknown): SupportTicketMeta {
  return typeof value === "object" && value !== null ? (value as SupportTicketMeta) : {};
}

function isHighPriority(priority?: string) {
  return priority === "HIGH" || priority === "CRITICAL";
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    adminError?: string;
    demoProduct?: string;
    demoSource?: string;
    demoStatus?: string;
    demoReview?: string;
    demoFollowUp?: string;
    q?: string;
    leadId?: string;
  }>;
}) {
  const params = await searchParams;
  const { adminError } = params;
  const [{ tickets }, { requests: demoRequests }] = await Promise.all([
    getAdminSupportTicketsData(),
    getAdminDemoRequestsData(),
  ]);
  const now = new Date().getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const highPriorityCount = tickets.filter((ticket) => isHighPriority(readMeta(ticket.metadataJson).priority)).length;
  const lastWeekCount = tickets.filter((ticket) => now - ticket.createdAt.getTime() <= sevenDaysMs).length;
  const waitingCount = tickets.filter((ticket) => {
    const status = readMeta(ticket.metadataJson).status ?? "OPEN";
    return status === "OPEN" || status === "IN_PROGRESS";
  }).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Destek"
        title="Destek masası"
        description="Destek taleplerini, public başvuruları ve müşteri takiplerini tek alandan yönetin."
        actions={
          <>
            <Link
              href="/admin/support"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Yenile
            </Link>
            <Link
              href="/admin/organizations"
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Yeni müşteri
            </Link>
            <Link
              href="/admin/audit-logs?status=FAILURE"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Hata logları
            </Link>
            <Link
              href="/admin/integrations"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Entegrasyonlar
            </Link>
          </>
        }
      />

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <AdminStatGrid>
        <AdminSummaryCard label="Toplam talep" value={tickets.length} helper="Tüm destek kayıtları" />
        <AdminSummaryCard
          label="Açık / işlemde"
          value={waitingCount}
          helper="Yanıt veya takip bekleyenler"
          tone={waitingCount > 0 ? "warning" : "default"}
        />
        <AdminSummaryCard label="Son 7 gün" value={lastWeekCount} helper="Son yedi günde oluşturulan kayıtlar" />
        <AdminSummaryCard
          label="Yüksek / kritik"
          value={highPriorityCount}
          helper="Öncelikli müdahale gereken kayıtlar"
          tone={highPriorityCount > 0 ? "danger" : "default"}
        />
      </AdminStatGrid>

      <AdminPanel>
        <AdminSectionTitle badge="Liste" title="Destek talepleri" description="Müşteri paneli üzerinden açılan destek kayıtları." />
        {tickets.length === 0 ? (
          <AdminEmptyState
            description="Müşteriler dashboard üzerinden talep oluşturduğunda burada görünür."
            action={
              <Link href="/admin/organizations" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">
                Müşterilere git
              </Link>
            }
          >
            Henüz destek talebi bulunmuyor.
          </AdminEmptyState>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const meta = readMeta(ticket.metadataJson);
              const priority = meta.priority ?? "NORMAL";
              const status = meta.status ?? "OPEN";
              const updateTicket = updateAdminSupportTicketAction.bind(null, ticket.id);
              return (
                <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black text-slate-950">{meta.subject ?? "Destek talebi"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatAdminDate(ticket.createdAt)} ·{" "}
                        {ticket.organization ? (
                          <AdminOrgLink id={ticket.organizationId!} name={ticket.organization.name} />
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusPill active={isHighPriority(priority)}>{priorityLabels[priority] ?? priority}</AdminStatusPill>
                      <AdminStatusPill active={status === "RESOLVED" || status === "CLOSED"}>
                        {ticketStatusOptions.find((option) => option.value === status)?.label ?? status}
                      </AdminStatusPill>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{meta.message ?? "—"}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {categoryLabels[meta.category ?? "GENERAL"] ?? meta.category} · {ticket.user?.email ?? meta.actor?.email ?? "—"}
                  </p>
                  {meta.adminReply ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Admin yanıtı</p>
                      <p className="mt-2 text-sm text-emerald-900">{meta.adminReply}</p>
                    </div>
                  ) : null}
                  <form action={updateTicket} className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
                    <input type="hidden" name="returnTo" value="/admin/support" />
                    <AdminSelectField label="Durum" name="status" defaultValue={status}>
                      {ticketStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </AdminSelectField>
                    <AdminTextField label="Yanıt" name="adminReply" placeholder="Müşteriye not veya çözüm..." />
                    <AdminSubmitButton>Güncelle</AdminSubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>

      <AdminDemoRequestsPanel
        requests={demoRequests}
        filters={{
          product: params.demoProduct,
          source: params.demoSource,
          status: params.demoStatus,
          reviewStatus: params.demoReview,
          followUp: params.demoFollowUp,
          q: params.q,
          leadId: params.leadId,
        }}
      />
    </div>
  );
}
