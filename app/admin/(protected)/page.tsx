import Link from "next/link";
import AdminDemoLeadFollowUpWidget from "@/components/marketing/AdminDemoLeadFollowUpWidget";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  AdminStatGrid,
  AdminSummaryCard,
  AdminTableShell,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActivityTimeline,
  formatAdminAuditAction,
} from "@/components/marketing/WexonAdminContent";
import {
  formatAdminDate,
  getAdminDemoLeadFollowUpWidgetData,
  getAdminDemoRequestsData,
  getAdminOverviewData,
  getAdminSupportTicketsData,
  displayPlanName,
  formatAdminStatus,
} from "@/lib/wexon-admin";
import { dashboardPreviewHref, wexpayHref } from "@/lib/wexon-organization-context";
import { buildWexPayEligibilityAdminView } from "@/lib/wexpay-eligibility-admin-display";

export default async function AdminPage() {
  const [
    { organizations, licenses, invoices, auditLogs, wexPayAccessDecisions },
    demoLeadFollowUp,
    { requests: demoRequests },
    { tickets },
  ] = await Promise.all([
    getAdminOverviewData(),
    getAdminDemoLeadFollowUpWidgetData(),
    getAdminDemoRequestsData(),
    getAdminSupportTicketsData(),
  ]);

  const activeOrgs = organizations.filter((org) => org.isActive);
  const activeUsers = organizations.reduce((sum, org) => sum + org.memberships.length, 0);
  const activeLicenses = licenses.filter((license) => license.status === "ACTIVE");
  const activeWexPay = wexPayAccessDecisions.filter((decision) => decision.allowed);
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "ISSUED" || invoice.status === "OVERDUE");
  const clock = new Date().getTime();
  const expiringSoon = licenses.filter((license) => {
    if (!license.endsAt) return false;
    const ms = license.endsAt.getTime() - clock;
    return ms > 0 && ms <= 30 * 24 * 60 * 60 * 1000;
  });
  const openTickets = tickets.filter((ticket) => {
    const meta =
      typeof ticket.metadataJson === "object" && ticket.metadataJson !== null
        ? (ticket.metadataJson as { status?: string })
        : {};
    const status = meta.status ?? "OPEN";
    return status === "OPEN" || status === "IN_PROGRESS";
  });
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const newLeadsWeek = demoRequests.filter((request) => clock - request.createdAt.getTime() <= sevenDaysMs).length;
  const manualReview = demoRequests.filter(
    (request) => buildWexPayEligibilityAdminView(request.metadataJson).reviewStatusRaw === "manual_review",
  ).length;

  const todoItems = [
    ...demoLeadFollowUp.items.map((item) => ({
      id: `lead-${item.id}`,
      title: `${item.followUpDateState === "overdue" ? "Gecikmiş takip" : "Bugün takip"}: ${item.company}`,
      meta: `${item.fullName} · ${item.product}`,
      href: item.supportHref,
    })),
    ...openTickets.slice(0, 5).map((ticket) => {
      const meta =
        typeof ticket.metadataJson === "object" && ticket.metadataJson !== null
          ? (ticket.metadataJson as { subject?: string })
          : {};
      return {
        id: `ticket-${ticket.id}`,
        title: meta.subject ?? "Açık destek talebi",
        meta: ticket.organization?.name ?? "Organizasyon yok",
        href: "/admin/support",
      };
    }),
    ...expiringSoon.slice(0, 5).map((license) => ({
      id: `license-${license.id}`,
      title: `Lisans süresi yaklaşıyor: ${license.organization.name}`,
      meta: `${displayPlanName(license.plan.name)} · ${formatAdminDate(license.endsAt)}`,
      href: `/admin/organizations/${license.organizationId}`,
    })),
  ];

  if (manualReview > 0) {
    todoItems.unshift({
      id: "manual-review",
      title: `${manualReview} WexPay başvurusu manuel inceleme bekliyor`,
      meta: "Ön başvurular / destek CRM",
      href: "/admin/applications?demoReview=manual_review",
    });
  }

  const quickActions = [
    { title: "Yeni müşteri", href: "/admin/organizations", helper: "Organizasyon kaydını başlat" },
    { title: "Ön başvuruları aç", href: "/admin/applications", helper: "Satış / başvuru pipeline" },
    { title: "Planları yönet", href: "/admin/plans", helper: "WexPay paketleri ve limitler" },
    { title: "Destek talepleri", href: "/admin/support", helper: "Açık ticket ve lead CRM" },
    { title: "WexPay geçiş önizlemesi", href: "/admin/plans/wexpay-migration", helper: "Salt okunur migrasyon raporu" },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        badge="Genel bakış"
        title="Operasyon çalışma alanı"
        description="Müşteri, lisans, başvuru ve destek işlerini aynı ekrandan takip edin."
        actions={
          <>
            <Link
              href="/admin/organizations"
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Yeni müşteri
            </Link>
            <Link
              href="/admin/support"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Destek masası
            </Link>
          </>
        }
      />

      <AdminStatGrid>
        <AdminSummaryCard label="Aktif müşteri" value={activeOrgs.length} helper={`Toplam ${organizations.length} kayıt`} href="/admin/organizations" />
        <AdminSummaryCard label="Kullanıcı üyelikleri" value={activeUsers} helper="Organizasyon üyelik sayısı" href="/admin/users" />
        <AdminSummaryCard label="Aktif lisans" value={activeLicenses.length} helper="Aktif ürün lisansları" href="/admin/licenses" />
        <AdminSummaryCard label="Aktif WexPay" value={activeWexPay.length} helper="Erişim kararı açık" />
        <AdminSummaryCard label="Açık destek" value={openTickets.length} helper="OPEN / IN_PROGRESS" href="/admin/support" tone={openTickets.length ? "warning" : "default"} />
        <AdminSummaryCard label="Son 7 gün lead" value={newLeadsWeek} helper="Public demo / başvuru" href="/admin/applications" />
        <AdminSummaryCard label="Bekleyen fatura" value={pendingInvoices.length} helper="ISSUED / OVERDUE" href="/admin/billing" />
        <AdminSummaryCard label="30 gün içinde biten" value={expiringSoon.length} helper="Lisans bitiş tarihi yakın" href="/admin/licenses" tone={expiringSoon.length ? "warning" : "default"} />
      </AdminStatGrid>

      <AdminDemoLeadFollowUpWidget data={demoLeadFollowUp} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel>
          <AdminSectionTitle badge="Bugün" title="Yapılacaklar" description="Takip, destek ve lisans bitişlerinden türetilen işler." />
          {todoItems.length === 0 ? (
            <AdminEmptyState description="Takip tarihi gelen lead, açık ticket veya yakında biten lisans yok.">
              Bugün için bekleyen operasyon kaydı bulunmuyor.
            </AdminEmptyState>
          ) : (
            <AdminActivityTimeline items={todoItems.slice(0, 12)} />
          )}
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle badge="Hızlı işlemler" title="Sık kullanılan akışlar" />
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
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminPanel>
          <AdminSectionTitle badge="Operasyon" title="Müşteri özeti" description="Son kayıtlı organizasyonlar." />
          {organizations.length === 0 ? (
            <AdminEmptyState>Henüz müşteri kaydı bulunmuyor.</AdminEmptyState>
          ) : (
            <AdminTableShell>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                      Müşteri
                    </th>
                    <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                      Plan
                    </th>
                    <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                      Durum
                    </th>
                    <th scope="col" className="font-black uppercase tracking-[0.12em] text-slate-500">
                      Aksiyon
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organizations.slice(0, 8).map((organization) => {
                    const license =
                      licenses.find((item) => item.organizationId === organization.id && item.product.key === "wexpay") ??
                      licenses.find((item) => item.organizationId === organization.id);
                    return (
                      <tr key={organization.id}>
                        <td>
                          <p className="font-black text-slate-950">{organization.name}</p>
                          <p className="text-xs font-semibold text-slate-500">{organization.email ?? organization.slug}</p>
                        </td>
                        <td className="text-sm font-semibold text-slate-700">
                          {license ? displayPlanName(license.plan.name) : "—"}
                        </td>
                        <td className="text-sm font-semibold text-slate-600">
                          {organization.isActive ? "Aktif" : "Pasif"}
                          {license ? ` · ${formatAdminStatus(license.status)}` : ""}
                        </td>
                        <td>
                          <Link
                            href={`/admin/organizations/${organization.id}`}
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
            </AdminTableShell>
          )}
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle badge="Aktivite" title="Son işlemler" description="Audit kayıtlarından okunabilir özet." />
          {auditLogs.length === 0 ? (
            <AdminEmptyState>Henüz işlem kaydı bulunmuyor.</AdminEmptyState>
          ) : (
            <AdminActivityTimeline
              items={auditLogs.slice(0, 8).map((log) => ({
                id: log.id,
                title: formatAdminAuditAction(log.action),
                meta: `${formatAdminDate(log.createdAt)}${log.organization ? ` · ${log.organization.name}` : ""}`,
                href: "/admin/audit-logs",
              }))}
            />
          )}
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
      </section>
    </div>
  );
}
