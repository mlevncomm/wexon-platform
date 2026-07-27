import { AdminEmptyState, AdminInfoRow, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard } from "@/components/marketing/WexonAdminCards";
import AdminDemoRequestsPanel from "@/components/marketing/AdminDemoRequestsPanel";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuSection,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
} from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
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
  searchParams: Promise<{ adminError?: string; demoProduct?: string; demoSource?: string }>;
}) {
  const { adminError, demoProduct, demoSource } = await searchParams;
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
                <div key={ticket.id} className="rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-black text-slate-950">{meta.subject ?? "Destek talebi"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatAdminDate(ticket.createdAt)} · {ticket.organization ? <AdminOrgLink id={ticket.organizationId!} name={ticket.organization.name} /> : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusPill tone={isHighPriority(priority) ? "failed" : "info"}>
                        {priorityLabels[priority] ?? priority}
                      </AdminStatusPill>
                      <AdminStatusPill tone={status === "RESOLVED" || status === "CLOSED" ? "active" : "pending"}>
                        {ticketStatusOptions.find((s) => s.value === status)?.label ?? status}
                      </AdminStatusPill>
                      <AdminActionMenu label="Yanıtla" ariaLabel="Talebi güncelle" widthClassName="w-[min(100vw-2rem,24rem)]">
                        <AdminActionMenuSection title="Durum ve yanıt">
                          <form action={updateTicket} className="grid gap-3">
                            <input type="hidden" name="returnTo" value="/admin/support" />
                            <AdminSelectField label="Durum" name="status" defaultValue={status} options={ticketStatusOptions} />
                            <AdminTextField label="Yanıt" name="adminReply" placeholder="Müşteriye not veya çözüm..." />
                            <AdminSubmitButton>Güncelle</AdminSubmitButton>
                          </form>
                        </AdminActionMenuSection>
                      </AdminActionMenu>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{meta.message ?? "-"}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {categoryLabels[meta.category ?? "GENERAL"] ?? meta.category} · {ticket.user?.email ?? meta.actor?.email ?? "—"}
                  </p>
                  {meta.adminReply ? (
                    <div className="mt-4">
                      <AdminActionNotice tone="info" title="Admin yanıtı">
                        {meta.adminReply}
                      </AdminActionNotice>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>

      <AdminDemoRequestsPanel
        requests={demoRequests}
        filters={{
          product: demoProduct,
          source: demoSource,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminInfoRow label="Kaynak" value="AuditLog metadata" />
        <AdminInfoRow label="Durum yönetimi" value="Aktif" />
        <AdminInfoRow label="Yanıt" value="Admin panelinden" />
      </div>
    </div>
  );
}
