import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { updateAdminSupportTicketAction } from "@/lib/wexon-admin-actions";
import { formatAdminDate, getAdminDemoRequestsData, getAdminSupportTicketsData } from "@/lib/wexon-admin";
import { demoRequestSourceLabels } from "@/lib/wexon-public-validation";

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

type DemoRequestMeta = {
  fullName?: string;
  company?: string;
  email?: string;
  phone?: string;
  product?: string;
  message?: string;
  status?: string;
  source?: string;
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

function readDemoMeta(value: unknown): DemoRequestMeta {
  return typeof value === "object" && value !== null ? (value as DemoRequestMeta) : {};
}

function isHighPriority(priority?: string) {
  return priority === "HIGH" || priority === "CRITICAL";
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [{ tickets, loadedAt }, { requests: demoRequests }] = await Promise.all([
    getAdminSupportTicketsData(),
    getAdminDemoRequestsData(),
  ]);
  const loadedAtTime = loadedAt.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const highPriorityCount = tickets.filter((ticket) => isHighPriority(readMeta(ticket.metadataJson).priority)).length;
  const lastWeekCount = tickets.filter((ticket) => loadedAtTime - ticket.createdAt.getTime() <= sevenDaysMs).length;
  const waitingCount = tickets.filter((ticket) => {
    const status = readMeta(ticket.metadataJson).status ?? "OPEN";
    return status === "OPEN" || status === "IN_PROGRESS";
  }).length;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Destek"
          title="Destek masası"
          description="Talepleri yanıtlayın, durum güncelleyin ve müşteri sorunlarını çözün."
        />
        <AdminQuickLinks
          links={[
            { label: "Müşteriler", href: "/admin/organizations" },
            { label: "Hata logları", href: "/admin/audit-logs?status=FAILURE" },
            { label: "Entegrasyonlar", href: "/admin/integrations" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Toplam talep" value={tickets.length} />
        <AdminSummaryCard label="Yüksek / kritik" value={highPriorityCount} />
        <AdminSummaryCard label="Son 7 gün" value={lastWeekCount} />
        <AdminSummaryCard label="Açık / işlemde" value={waitingCount} />
      </section>

      <AdminPanel>
        <AdminSectionTitle badge="Liste" title="Talep kayıtları" />
        {tickets.length === 0 ? (
          <AdminEmptyState>Henüz destek talebi bulunmuyor.</AdminEmptyState>
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
                    <div>
                      <p className="text-lg font-black text-slate-950">{meta.subject ?? "Destek talebi"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatAdminDate(ticket.createdAt)} · {ticket.organization ? <AdminOrgLink id={ticket.organizationId!} name={ticket.organization.name} /> : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusPill active={isHighPriority(priority)}>{priorityLabels[priority] ?? priority}</AdminStatusPill>
                      <AdminStatusPill active={status === "RESOLVED" || status === "CLOSED"}>
                        {ticketStatusOptions.find((s) => s.value === status)?.label ?? status}
                      </AdminStatusPill>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{meta.message ?? "-"}</p>
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

      <AdminPanel>
        <AdminSectionTitle badge="Demo" title="Public demo talepleri" description="Instagram ve demo-request formundan gelen kayıtlar." />
        {demoRequests.length === 0 ? (
          <AdminEmptyState>Henüz public demo talebi bulunmuyor.</AdminEmptyState>
        ) : (
          <div className="space-y-4">
            {demoRequests.map((request) => {
              const meta = readDemoMeta(request.metadataJson);
              return (
                <div key={request.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-slate-950">{meta.company ?? "Demo talebi"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatAdminDate(request.createdAt)} · {meta.fullName ?? "—"}
                      </p>
                    </div>
                    <AdminStatusPill active>{meta.product ?? "Ürün"}</AdminStatusPill>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{meta.message ?? "-"}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {meta.email ?? "—"} · {meta.phone ?? "—"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Kaynak: {demoRequestSourceLabels[meta.source ?? "direct"] ?? meta.source ?? "Direct"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminInfoRow label="Kaynak" value="AuditLog metadata" />
        <AdminInfoRow label="Durum yönetimi" value="Aktif" />
        <AdminInfoRow label="Yanıt" value="Admin panelinden" />
      </div>
    </div>
  );
}
