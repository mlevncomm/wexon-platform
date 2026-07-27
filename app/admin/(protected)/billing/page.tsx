import {
  AdminEmptyState,
  AdminPanel,
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
import {
  createAdminBillingPaymentAction,
  createAdminInvoiceAction,
  updateAdminInvoiceStatusAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminBillingData, getAdminOperationOptions } from "@/lib/wexon-admin";
import { generateAdminMutationKey } from "@/lib/wexon-admin-mutation-idempotency";

const invoiceCreateStatusOptions = [
  { value: "DRAFT", label: "Taslak" },
  { value: "ISSUED", label: "Kesildi" },
];

const invoiceStatusOptions = [
  ...invoiceCreateStatusOptions,
  { value: "PAID", label: "Ödendi" },
  { value: "OVERDUE", label: "Vadesi geçti" },
  { value: "VOID", label: "İptal" },
];

const paymentStatusOptions = [
  { value: "PAID", label: "Ödendi" },
  { value: "PENDING", label: "Bekliyor" },
  { value: "FAILED", label: "Başarısız" },
  { value: "REFUNDED", label: "İade" },
];

function InvoiceStatusMenu({
  invoiceId,
  invoiceNo,
  status,
}: {
  invoiceId: string;
  invoiceNo: string;
  status: string;
}) {
  return (
    <AdminActionMenu label="Güncelle" ariaLabel={`${invoiceNo} güncelle`} widthClassName="w-[min(100vw-2rem,22rem)]">
      <AdminActionMenuSection title="Fatura durumu">
        <AdminActionMenuHint>Durum değişikliği audit kaydı oluşturur; gerekçe zorunludur.</AdminActionMenuHint>
        <form
          action={updateAdminInvoiceStatusAction.bind(null, invoiceId)}
          className="flex flex-col gap-2"
          data-testid={`invoice-status-form-${invoiceId}`}
        >
          <input type="hidden" name="returnTo" value="/admin/billing" />
          <AdminSelect name="status" defaultValue={status} options={invoiceStatusOptions} compact aria-label="Fatura durumu" />
          <input
            name="reason"
            required
            minLength={8}
            placeholder="İşlem gerekçesi (zorunlu)"
            className={ADMIN_FIELD_CONTROL_COMPACT}
          />
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-500">
            <input type="checkbox" name="confirmed" value="1" className="mt-0.5" required />
            Fatura durumu değişikliğini onaylıyorum
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-[10px] bg-slate-900 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Kaydet
          </button>
        </form>
      </AdminActionMenuSection>
    </AdminActionMenu>
  );
}

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ adminError?: string }> }) {
  const { adminError } = await searchParams;
  const [{ invoices, billingPayments, subscriptionPayments }, options] = await Promise.all([getAdminBillingData(), getAdminOperationOptions()]);
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "ISSUED" || invoice.status === "OVERDUE");
  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
  const paidPayments = billingPayments.filter((payment) => payment.status === "PAID");
  const paytrPaid = subscriptionPayments.filter((payment) => payment.status === "PAID");
  const invoiceMutationId = generateAdminMutationKey();
  const paymentMutationId = generateAdminMutationKey();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <AdminSectionTitle
          badge="Fatura ve tahsilat"
          title="Billing operasyonları"
          description="Fatura oluşturun, tahsilat kaydedin ve durumları yönetin."
        />
        <AdminQuickLinks
          links={[
            { label: "Abonelikler", href: "/admin/subscriptions" },
            { label: "Lisanslar", href: "/admin/licenses" },
            { label: "Müşteriler", href: "/admin/organizations" },
          ]}
        />
      </div>

      {adminError ? <AdminActionNotice tone="error">{adminError}</AdminActionNotice> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <AdminSummaryCard label="Toplam fatura" value={invoices.length} />
        <AdminSummaryCard label="Bekleyen fatura" value={pendingInvoices.length} />
        <AdminSummaryCard label="Ödenen fatura" value={paidInvoices.length} />
        <AdminSummaryCard label="Başarılı tahsilat" value={paidPayments.length} />
        <AdminSummaryCard label="PayTR PAID" value={paytrPaid.length} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminFormPanel title="Yeni fatura oluştur" description="Manuel fatura kesimi ve tahsilat takibi." collapsible>
          <form action={createAdminInvoiceAction} className="grid gap-4 md:grid-cols-2" data-testid="admin-invoice-create-form">
            <input type="hidden" name="returnTo" value="/admin/billing" />
            <input type="hidden" name="mutationId" value={invoiceMutationId} />
            <AdminSelectField
              label="Müşteri"
              name="organizationId"
              options={[
                { value: "", label: "Seçin" },
                ...options.organizations.map((org) => ({ value: org.id, label: org.name })),
              ]}
            />
            <AdminSelectField
              label="Abonelik (opsiyonel)"
              name="subscriptionId"
              defaultValue=""
              options={[
                { value: "", label: "Bağlı değil" },
                ...options.subscriptions.map((sub) => ({
                  value: sub.id,
                  label: `${sub.organization.name} · ${displayPlanName(sub.plan.name)}`,
                })),
              ]}
            />
            <AdminTextField label="Fatura no" name="invoiceNo" placeholder="Otomatik üretilir" />
            <AdminSelectField label="Durum" name="status" defaultValue="ISSUED" options={invoiceCreateStatusOptions} />
            <AdminTextField label="Ara toplam" name="subtotal" type="number" required />
            <AdminTextField label="Vergi" name="tax" type="number" defaultValue="0" />
            <AdminTextField label="Toplam" name="total" type="number" placeholder="Boş = ara+vergi" />
            <AdminTextField label="Para birimi" name="currency" defaultValue="TRY" />
            <AdminDateField label="Vade tarihi" name="dueAt" />
            <AdminTextField label="İşlem gerekçesi" name="reason" required placeholder="Fatura oluşturma gerekçesi" />
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="checkbox" name="confirmed" value="1" className="mt-1 h-4 w-4 rounded border-slate-300" required />
              <span className="text-sm font-semibold text-slate-700">Manuel fatura kaydının oluşturulacağını onaylıyorum.</span>
            </label>
            <div className="md:col-span-2">
              <AdminSubmitButton>Fatura oluştur</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>

        <AdminFormPanel title="Tahsilat kaydet" description="Ödeme girişi yapın; fatura seçilirse otomatik ödendi işaretlenir." collapsible>
          <form action={createAdminBillingPaymentAction} className="grid gap-4 md:grid-cols-2" data-testid="admin-billing-payment-create-form">
            <input type="hidden" name="returnTo" value="/admin/billing" />
            <input type="hidden" name="mutationId" value={paymentMutationId} />
            <AdminSelectField
              label="Müşteri"
              name="organizationId"
              options={[
                { value: "", label: "Seçin" },
                ...options.organizations.map((org) => ({ value: org.id, label: org.name })),
              ]}
            />
            <AdminSelectField
              label="Fatura (opsiyonel)"
              name="invoiceId"
              defaultValue=""
              options={[
                { value: "", label: "Bağlı değil" },
                ...options.invoices.map((inv) => ({
                  value: inv.id,
                  label: `${inv.invoiceNo} (${inv.status})`,
                })),
              ]}
            />
            <AdminTextField label="Tutar" name="amount" type="number" required />
            <AdminSelectField label="Durum" name="status" defaultValue="PAID" options={paymentStatusOptions} />
            <AdminSelectField
              label="Sağlayıcı"
              name="provider"
              defaultValue="admin_manual"
              options={[{ value: "admin_manual", label: "Admin manuel" }]}
            />
            <AdminTextField label="Referans" name="providerRef" placeholder="Dekont / işlem no" />
            <AdminTextField label="İşlem gerekçesi" name="reason" required placeholder="Tahsilat gerekçesi" />
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="checkbox" name="confirmed" value="1" className="mt-1 h-4 w-4 rounded border-slate-300" required />
              <span className="text-sm font-semibold text-slate-700">Manuel tahsilat kaydının oluşturulacağını onaylıyorum.</span>
            </label>
            <div className="md:col-span-2">
              <AdminSubmitButton>Tahsilat kaydet</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>
      </section>

      <AdminPanel>
        <AdminSectionTitle badge="Faturalar" title="Fatura kayıtları" />
        {invoices.length === 0 ? (
          <AdminEmptyState>Henüz fatura kaydı bulunmuyor.</AdminEmptyState>
        ) : (
          <AdminTableShell
            mobile={
              <AdminResponsiveRows
                rows={invoices.map((invoice) => ({
                  key: invoice.id,
                  primary: (
                    <div className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={invoice.organizationId} name={invoice.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{invoice.invoiceNo}</p>
                    </div>
                  ),
                  secondary: (
                    <span className="truncate">
                      {String(invoice.total)} {invoice.currency}
                      {invoice.dueAt ? ` · Vade ${formatAdminDate(invoice.dueAt)}` : ""}
                    </span>
                  ),
                  meta: (
                    <AdminStatusPill tone={adminStatusToneFromValue(invoice.status)}>
                      {formatAdminStatus(invoice.status)}
                    </AdminStatusPill>
                  ),
                  actions: (
                    <InvoiceStatusMenu invoiceId={invoice.id} invoiceNo={invoice.invoiceNo} status={invoice.status} />
                  ),
                }))}
              />
            }
          >
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="hidden w-[18%] xl:table-cell">Fatura no</th>
                  <th className="w-[28%]">Müşteri</th>
                  <th className="w-[16%]">Tutar</th>
                  <th className="hidden w-[14%] 2xl:table-cell">Vade</th>
                  <th className="w-[14%]">Durum</th>
                  <th className="w-[140px]">Güncelle</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="hidden min-w-0 truncate font-semibold text-slate-950 xl:table-cell">
                      {invoice.invoiceNo}
                    </td>
                    <td className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={invoice.organizationId} name={invoice.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500 xl:hidden">{invoice.invoiceNo}</p>
                    </td>
                    <td className="min-w-0 truncate text-slate-600">
                      {String(invoice.total)} {invoice.currency}
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                      {formatAdminDate(invoice.dueAt)}
                    </td>
                    <td className="min-w-0">
                      <AdminStatusPill tone={adminStatusToneFromValue(invoice.status)}>
                        {formatAdminStatus(invoice.status)}
                      </AdminStatusPill>
                    </td>
                    <td className="min-w-0">
                      <InvoiceStatusMenu invoiceId={invoice.id} invoiceNo={invoice.invoiceNo} status={invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        )}
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="PayTR" title="Abonelik ödeme geçmişi (SubscriptionPayment)" />
        {subscriptionPayments.length === 0 ? (
          <AdminEmptyState>Henüz PayTR abonelik ödemesi yok.</AdminEmptyState>
        ) : (
          <AdminTableShell
            mobile={
              <AdminResponsiveRows
                rows={subscriptionPayments.map((payment) => ({
                  key: payment.id,
                  primary: (
                    <div className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {displayPlanName(payment.plan.name)}
                      </p>
                    </div>
                  ),
                  secondary: (
                    <span className="truncate">
                      {String(payment.amount)} {payment.currency}
                      {payment.paidAt ? ` · ${formatAdminDate(payment.paidAt)}` : ""}
                      {payment.user?.email ? ` · ${payment.user.email}` : ""}
                    </span>
                  ),
                  meta: (
                    <AdminStatusPill tone={adminStatusToneFromValue(payment.status)}>
                      {formatAdminStatus(payment.status)}
                    </AdminStatusPill>
                  ),
                }))}
              />
            }
          >
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="hidden w-[14%] 2xl:table-cell">merchantOid</th>
                  <th className="hidden w-[10%] 2xl:table-cell">Provider</th>
                  <th className="w-[24%]">Müşteri</th>
                  <th className="w-[16%]">Plan</th>
                  <th className="hidden w-[14%] xl:table-cell">Customer</th>
                  <th className="w-[12%]">Tutar</th>
                  <th className="w-[12%]">Durum</th>
                  <th className="hidden w-[12%] xl:table-cell">paidAt</th>
                  <th className="hidden w-[10%] 2xl:table-cell">Callback</th>
                  <th className="hidden w-[12%] 2xl:table-cell">Failed</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="hidden min-w-0 truncate font-mono text-xs text-slate-700 2xl:table-cell">
                      {payment.merchantOid}
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                      {payment.provider}/{payment.providerMode}
                    </td>
                    <td className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500 xl:hidden">
                        {formatAdminDate(payment.paidAt)}
                      </p>
                    </td>
                    <td className="min-w-0 truncate text-slate-600">{displayPlanName(payment.plan.name)}</td>
                    <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                      {payment.user?.email ?? "-"}
                    </td>
                    <td className="min-w-0 truncate text-slate-600">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="min-w-0">
                      <AdminStatusPill tone={adminStatusToneFromValue(payment.status)}>
                        {formatAdminStatus(payment.status)}
                      </AdminStatusPill>
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                      {formatAdminDate(payment.paidAt)}
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                      {payment.callbackStatus ? `${payment.callbackStatus}` : "—"}
                    </td>
                    <td className="hidden min-w-0 truncate text-xs text-rose-700 2xl:table-cell">
                      {payment.failedReasonMsg ?? payment.failedReasonCode ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        )}
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="Tahsilatlar" title="Ödeme kayıtları" />
        {billingPayments.length === 0 ? (
          <AdminEmptyState>Henüz tahsilat kaydı bulunmuyor.</AdminEmptyState>
        ) : (
          <AdminTableShell
            mobile={
              <AdminResponsiveRows
                rows={billingPayments.map((payment) => ({
                  key: payment.id,
                  primary: (
                    <div className="min-w-0 truncate">
                      <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                    </div>
                  ),
                  secondary: (
                    <span className="truncate">
                      {String(payment.amount)} {payment.currency}
                      {payment.invoice?.invoiceNo ? ` · ${payment.invoice.invoiceNo}` : ""}
                      {payment.paidAt ? ` · ${formatAdminDate(payment.paidAt)}` : ""}
                    </span>
                  ),
                  meta: (
                    <AdminStatusPill tone={adminStatusToneFromValue(payment.status)}>
                      {formatAdminStatus(payment.status)}
                    </AdminStatusPill>
                  ),
                }))}
              />
            }
          >
            <table className="w-full table-fixed text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="w-[32%]">Müşteri</th>
                  <th className="hidden w-[20%] xl:table-cell">Fatura</th>
                  <th className="w-[18%]">Tutar</th>
                  <th className="hidden w-[16%] 2xl:table-cell">Ödenme</th>
                  <th className="w-[14%]">Durum</th>
                </tr>
              </thead>
              <tbody>
                {billingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="min-w-0">
                      <div className="truncate">
                        <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500 xl:hidden">
                        {payment.invoice?.invoiceNo ?? "—"}
                      </p>
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 xl:table-cell">
                      {payment.invoice?.invoiceNo ?? "-"}
                    </td>
                    <td className="min-w-0 truncate text-slate-600">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="hidden min-w-0 truncate text-slate-600 2xl:table-cell">
                      {formatAdminDate(payment.paidAt)}
                    </td>
                    <td className="min-w-0">
                      <AdminStatusPill tone={adminStatusToneFromValue(payment.status)}>
                        {formatAdminStatus(payment.status)}
                      </AdminStatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        )}
      </AdminPanel>
    </div>
  );
}
