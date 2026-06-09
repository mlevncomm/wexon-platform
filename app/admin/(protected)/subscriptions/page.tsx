import { AdminEmptyState, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton } from "@/components/marketing/WexonAdminForms";
import { AdminInlineSelectForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-5 py-4 font-bold">Müşteri</th>
                <th className="px-5 py-4 font-bold">Plan</th>
                <th className="px-5 py-4 font-bold">Dönem</th>
                <th className="px-5 py-4 font-bold">Başlangıç</th>
                <th className="px-5 py-4 font-bold">Bitiş</th>
                <th className="px-5 py-4 font-bold">Durum</th>
                <th className="px-5 py-4 font-bold">Güncelle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-5 py-4">
                    <AdminOrgLink id={subscription.organizationId} name={subscription.organization.name} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{displayPlanName(subscription.plan.name)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminStatus(subscription.interval)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(subscription.currentPeriodStart)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatAdminDate(subscription.currentPeriodEnd)}</td>
                  <td className="px-5 py-4">
                    <AdminStatusPill active={subscription.status === "ACTIVE"}>{formatAdminStatus(subscription.status)}</AdminStatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <AdminInlineSelectForm
                      action={updateAdminSubscriptionStatusAction.bind(null, subscription.id)}
                      returnTo="/admin/subscriptions"
                      fieldName="status"
                      value={subscription.status}
                      options={subscriptionStatusOptions}
                    />
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
