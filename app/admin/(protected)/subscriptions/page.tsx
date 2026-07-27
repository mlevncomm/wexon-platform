import {
  AdminEmptyState,
  AdminResponsiveRows,
  AdminSectionTitle,
  AdminStatusPill,
  AdminSummaryCard,
  AdminTableShell,
  adminStatusToneFromValue,
} from "@/components/marketing/WexonAdminCards";
import {
  AdminActionNotice,
  AdminActionMenu,
  AdminActionMenuHint,
  AdminActionMenuSection,
  AdminDateField,
  AdminFormPanel,
  AdminSelect,
  AdminSelectField,
  AdminSubmitButton,
  AdminTextField,
  ADMIN_FIELD_CONTROL_COMPACT,
} from "@/components/marketing/WexonAdminForms";
import { AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import { createAdminSubscriptionAction, updateAdminSubscriptionStatusAction } from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminOperationOptions, getAdminSubscriptionsData } from "@/lib/wexon-admin";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";
import {
  ADMIN_SUBSCRIPTION_PROVIDER_LABELS,
  ADMIN_SUBSCRIPTION_PROVIDERS,
} from "@/lib/wexon-admin-commercial-policy";

const subscriptionCreateStatusOptions = [
  { value: "TRIALING", label: "Deneme" },
  { value: "ACTIVE", label: "Aktif" },
];

const subscriptionStatusOptions = [
  ...subscriptionCreateStatusOptions,
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "CANCELLED", label: "İptal" },
  { value: "EXPIRED", label: "Süresi dolmuş" },
];

function SubscriptionStatusMenu({
  subscriptionId,
  organizationName,
  status,
}: {
  subscriptionId: string;
  organizationName: string;
  status: string;
}) {
  return (
    <AdminActionMenu label="Güncelle" ariaLabel={`${organizationName} abonelik güncelle`} widthClassName="w-[min(100vw-2rem,22rem)]">
      <AdminActionMenuSection title="Durum değiştir">
        <AdminActionMenuHint>Audit notu zorunludur. PayTR PAID çakışmalarında onay kutusu gerekir.</AdminActionMenuHint>
        <form action={updateAdminSubscriptionStatusAction.bind(null, subscriptionId)} className="flex flex-col gap-2">
          <input type="hidden" name="returnTo" value="/admin/subscriptions" />
          <AdminSelect name="status" defaultValue={status} options={subscriptionStatusOptions} compact aria-label="Abonelik durumu" />
          <input
            name="auditNote"
            required
            minLength={8}
            placeholder="Audit notu (zorunlu)"
            className={ADMIN_FIELD_CONTROL_COMPACT}
          />
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-500">
            <input type="checkbox" name="acknowledgePaytrPaid" value="true" className="mt-0.5" />
            PAID PayTR varsa çift aktivasyonu onayla
          </label>
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" name="confirmed" value="1" className="mt-0.5" required />
            Durum değişikliğini onaylıyorum
          </label>
          <button type="submit" className="min-h-11 rounded-[10px] bg-slate-900 px-3 text-sm font-bold text-white">
            Kaydet
          </button>
        </form>
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [subscriptions, options] = await Promise.all([getAdminSubscriptionsData(), getAdminOperationOptions()]);
  const today = new Date().toISOString().slice(0, 10);
  const subscriptionMutationId = generateAdminMutationKey();

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
          <input type="hidden" name="mutationId" value={subscriptionMutationId} />
          <AdminSelectField
            label="Müşteri"
            name="organizationId"
            options={[
              { value: "", label: "Seçin" },
              ...options.organizations.map((org) => ({ value: org.id, label: org.name })),
            ]}
          />
          <AdminSelectField
            label="Paket"
            name="planId"
            options={[
              { value: "", label: "Seçin" },
              ...options.plans.map((plan) => ({
                value: plan.id,
                label: `${plan.product.name} · ${displayPlanName(plan.name)}`,
              })),
            ]}
          />
          <AdminSelectField label="Durum" name="status" defaultValue="ACTIVE" options={subscriptionCreateStatusOptions} />
          <AdminSelectField
            label="Dönem"
            name="interval"
            defaultValue="MONTHLY"
            options={[
              { value: "MONTHLY", label: "Aylık" },
              { value: "YEARLY", label: "Yıllık" },
              { value: "ONE_TIME", label: "Tek seferlik" },
            ]}
          />
          <AdminDateField label="Dönem başlangıcı" name="currentPeriodStart" defaultValue={today} required />
          <AdminDateField label="Dönem bitişi" name="currentPeriodEnd" />
          <AdminSelectField
            label="Sağlayıcı"
            name="provider"
            defaultValue="admin_manual"
            options={ADMIN_SUBSCRIPTION_PROVIDERS.map((provider) => ({
              value: provider,
              label: ADMIN_SUBSCRIPTION_PROVIDER_LABELS[provider],
            }))}
          />
          <AdminTextField label="İşlem gerekçesi" name="reason" required placeholder="Abonelik oluşturma gerekçesi" />
          <label className="md:col-span-2 xl:col-span-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input type="checkbox" name="confirmed" value="1" className="mt-1 h-4 w-4 rounded border-slate-300" required />
            <span className="text-sm font-semibold text-slate-700">Manuel abonelik kaydının oluşturulacağını onaylıyorum.</span>
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <AdminSubmitButton>Abonelik oluştur</AdminSubmitButton>
          </div>
        </form>
      </AdminFormPanel>

      {subscriptions.length === 0 ? (
        <AdminEmptyState>Henüz abonelik kaydı bulunmuyor.</AdminEmptyState>
      ) : (
        <AdminTableShell
          mobile={
            <AdminResponsiveRows
              rows={subscriptions.map((subscription) => ({
                key: subscription.id,
                primary: <AdminOrgLink id={subscription.organizationId} name={subscription.organization.name} />,
                secondary: (
                  <span className="truncate">
                    {displayPlanName(subscription.plan.name)} · {formatAdminStatus(subscription.interval)} ·{" "}
                    {formatAdminDate(subscription.currentPeriodStart)} → {formatAdminDate(subscription.currentPeriodEnd)}
                  </span>
                ),
                meta: (
                  <AdminStatusPill tone={adminStatusToneFromValue(subscription.status)}>
                    {formatAdminStatus(subscription.status)}
                  </AdminStatusPill>
                ),
                actions: (
                  <SubscriptionStatusMenu
                    subscriptionId={subscription.id}
                    organizationName={subscription.organization.name}
                    status={subscription.status}
                  />
                ),
              }))}
            />
          }
        >
          <table className="w-full table-fixed text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-[26%]">Müşteri</th>
                <th className="w-[20%]">Plan</th>
                <th className="hidden w-[12%] xl:table-cell">Dönem</th>
                <th className="hidden w-[14%] 2xl:table-cell">Başlangıç</th>
                <th className="hidden w-[14%] 2xl:table-cell">Bitiş</th>
                <th className="w-[14%]">Durum</th>
                <th className="w-[140px]">Güncelle</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="min-w-0">
                    <div className="truncate">
                      <AdminOrgLink id={subscription.organizationId} name={subscription.organization.name} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500 2xl:hidden">
                      {formatAdminDate(subscription.currentPeriodStart)} → {formatAdminDate(subscription.currentPeriodEnd)}
                    </p>
                  </td>
                  <td className="min-w-0 truncate text-slate-600">{displayPlanName(subscription.plan.name)}</td>
                  <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                    {formatAdminStatus(subscription.interval)}
                  </td>
                  <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                    {formatAdminDate(subscription.currentPeriodStart)}
                  </td>
                  <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                    {formatAdminDate(subscription.currentPeriodEnd)}
                  </td>
                  <td className="min-w-0">
                    <AdminStatusPill tone={adminStatusToneFromValue(subscription.status)}>
                      {formatAdminStatus(subscription.status)}
                    </AdminStatusPill>
                  </td>
                  <td className="min-w-0">
                    <SubscriptionStatusMenu
                      subscriptionId={subscription.id}
                      organizationName={subscription.organization.name}
                      status={subscription.status}
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
