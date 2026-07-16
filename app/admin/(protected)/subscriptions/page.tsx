import { AdminEmptyState, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { createAdminSubscriptionAction, updateAdminSubscriptionStatusAction } from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminOperationOptions, getAdminSubscriptionsData } from "@/lib/wexon-admin";

const subscriptionStatusOptions = [
  { value: "TRIALING", label: "Deneme" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "CANCELLED", label: "İptal" },
  { value: "EXPIRED", label: "Süresi dolmuş" },
];

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [subscriptions, options] = await Promise.all([getAdminSubscriptionsData(), getAdminOperationOptions()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Abonelikler"
          title="Abonelik operasyonları"
          description="Yeni abonelik oluşturun, dönemleri yönetin ve durumları güncelleyin."
        />
        <AdminQuickLinks
          links={[
            { label: "Faturalar", href: "/admin/billing" },
            { label: "Lisanslar", href: "/admin/licenses" },
            { label: "Paketler", href: "/admin/plans" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminSummaryCard label="Toplam abonelik" value={subscriptions.length} />
        <AdminSummaryCard label="Aktif" value={subscriptions.filter((s) => s.status === "ACTIVE").length} />
        <AdminSummaryCard label="Riskli" value={subscriptions.filter((s) => s.status === "PAST_DUE" || s.status === "CANCELLED").length} />
      </section>

      <AdminFormPanel title="Yeni abonelik oluştur" description="Müşteriye paket atar; gerekirse lisans ve kurulum da açılır." collapsible>
        <form action={createAdminSubscriptionAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="returnTo" value="/admin/subscriptions" />
          <AdminSelectField label="Müşteri" name="organizationId">
            <option value="">Seçin</option>
            {options.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </AdminSelectField>
          <AdminSelectField label="Paket" name="planId">
            <option value="">Seçin</option>
            {options.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.product.name} · {displayPlanName(plan.name)}
              </option>
            ))}
          </AdminSelectField>
          <AdminSelectField label="Durum" name="status" defaultValue="ACTIVE">
            {subscriptionStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AdminSelectField>
          <AdminSelectField label="Dönem" name="interval" defaultValue="MONTHLY">
            <option value="MONTHLY">Aylık</option>
            <option value="YEARLY">Yıllık</option>
            <option value="ONE_TIME">Tek seferlik</option>
          </AdminSelectField>
          <AdminDateField label="Dönem başlangıcı" name="currentPeriodStart" defaultValue={today} required />
          <AdminDateField label="Dönem bitişi" name="currentPeriodEnd" />
          <AdminSelectField label="Sağlayıcı" name="provider" defaultValue="admin_manual">
            <option value="admin_manual">Admin manuel</option>
            <option value="mock">Mock</option>
            <option value="stripe">Stripe</option>
          </AdminSelectField>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Abonelik oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {subscriptions.length === 0 ? (
        <AdminEmptyState>Henüz abonelik kaydı bulunmuyor.</AdminEmptyState>
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[600px] text-left text-sm lg:min-w-0">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-3 py-4 font-bold sm:px-5">Müşteri</th>
                <th className="px-3 py-4 font-bold sm:px-5">Plan</th>
                <th className="hidden px-3 py-4 font-bold sm:px-5 xl:table-cell">Dönem</th>
                <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">Başlangıç</th>
                <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">Bitiş</th>
                <th className="px-3 py-4 font-bold sm:px-5">Durum</th>
                <th className="px-3 py-4 font-bold sm:px-5">Güncelle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-3 py-4 sm:px-5">
                    <AdminOrgLink id={subscription.organizationId} name={subscription.organization.name} />
                  </td>
                  <td className="px-3 py-4 text-slate-600 sm:px-5">{displayPlanName(subscription.plan.name)}</td>
                  <td className="hidden px-3 py-4 text-slate-600 sm:px-5 xl:table-cell">{formatAdminStatus(subscription.interval)}</td>
                  <td className="hidden px-3 py-4 text-slate-600 sm:px-5 lg:table-cell">{formatAdminDate(subscription.currentPeriodStart)}</td>
                  <td className="hidden px-3 py-4 text-slate-600 sm:px-5 lg:table-cell">{formatAdminDate(subscription.currentPeriodEnd)}</td>
                  <td className="px-3 py-4 sm:px-5">
                    <AdminStatusPill active={subscription.status === "ACTIVE"}>{formatAdminStatus(subscription.status)}</AdminStatusPill>
                  </td>
                  <td className="px-3 py-4 sm:px-5">
                    <form
                      action={updateAdminSubscriptionStatusAction.bind(null, subscription.id)}
                      className="flex w-full min-w-[180px] max-w-[260px] flex-col gap-2"
                    >
                      <input type="hidden" name="returnTo" value="/admin/subscriptions" />
                      <select
                        name="status"
                        defaultValue={subscription.status}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                      >
                        {subscriptionStatusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        name="auditNote"
                        required
                        minLength={8}
                        placeholder="Audit notu (zorunlu)"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      />
                      <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
                        <input type="checkbox" name="acknowledgePaytrPaid" value="true" className="mt-0.5" />
                        PAID PayTR varsa çift aktivasyonu onayla
                      </label>
                      <button type="submit" className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                        Kaydet
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </div>
  );
}
