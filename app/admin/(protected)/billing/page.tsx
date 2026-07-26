import { AdminEmptyState, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
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

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
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
            <AdminSelectField label="Müşteri" name="organizationId">
              <option value="">Seçin</option>
              {options.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField label="Abonelik (opsiyonel)" name="subscriptionId" defaultValue="">
              <option value="">Bağlı değil</option>
              {options.subscriptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.organization.name} · {displayPlanName(sub.plan.name)}
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField label="Fatura no" name="invoiceNo" placeholder="Otomatik üretilir" />
            <AdminSelectField label="Durum" name="status" defaultValue="ISSUED">
              {invoiceCreateStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </AdminSelectField>
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
            <AdminSelectField label="Müşteri" name="organizationId">
              <option value="">Seçin</option>
              {options.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField label="Fatura (opsiyonel)" name="invoiceId" defaultValue="">
              <option value="">Bağlı değil</option>
              {options.invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNo} ({inv.status})
                </option>
              ))}
            </AdminSelectField>
            <AdminTextField label="Tutar" name="amount" type="number" required />
            <AdminSelectField label="Durum" name="status" defaultValue="PAID">
              {paymentStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </AdminSelectField>
            <AdminSelectField label="Sağlayıcı" name="provider" defaultValue="admin_manual">
              <option value="admin_manual">Admin manuel</option>
            </AdminSelectField>
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
          <AdminTableShell>
            <table className="w-full min-w-[560px] text-left text-sm lg:min-w-0">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">Fatura no</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Müşteri</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Tutar</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 xl:table-cell">Vade</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Durum</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Güncelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="hidden px-3 py-4 font-semibold text-slate-950 sm:px-5 lg:table-cell">{invoice.invoiceNo}</td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminOrgLink id={invoice.organizationId} name={invoice.organization.name} />
                    </td>
                    <td className="px-3 py-4 text-slate-600 sm:px-5">
                      {String(invoice.total)} {invoice.currency}
                    </td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 xl:table-cell">{formatAdminDate(invoice.dueAt)}</td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminStatusPill active={invoice.status === "PAID"}>{formatAdminStatus(invoice.status)}</AdminStatusPill>
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <form
                        action={updateAdminInvoiceStatusAction.bind(null, invoice.id)}
                        className="flex w-full min-w-[180px] max-w-[260px] flex-col gap-2"
                        data-testid={`invoice-status-form-${invoice.id}`}
                      >
                        <input type="hidden" name="returnTo" value="/admin/billing" />
                        <select
                          name="status"
                          defaultValue={invoice.status}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                        >
                          {invoiceStatusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          name="reason"
                          required
                          minLength={8}
                          placeholder="İşlem gerekçesi (zorunlu)"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                        <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
                          <input type="checkbox" name="confirmed" value="1" className="mt-0.5" required />
                          Fatura durumu değişikliğini onaylıyorum
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                        >
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
      </AdminPanel>

      <AdminPanel>
        <AdminSectionTitle badge="PayTR" title="Abonelik ödeme geçmişi (SubscriptionPayment)" />
        {subscriptionPayments.length === 0 ? (
          <AdminEmptyState>Henüz PayTR abonelik ödemesi yok.</AdminEmptyState>
        ) : (
          <AdminTableShell>
            <table className="w-full min-w-[560px] text-left text-sm lg:min-w-0">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 xl:table-cell">merchantOid</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 2xl:table-cell">Provider</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Müşteri</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Plan</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 xl:table-cell">Customer</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Tutar</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Durum</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">paidAt</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 2xl:table-cell">Callback</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 2xl:table-cell">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptionPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="hidden break-all px-3 py-4 font-mono text-xs text-slate-700 sm:px-5 xl:table-cell">{payment.merchantOid}</td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 2xl:table-cell">
                      {payment.provider}/{payment.providerMode}
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                    </td>
                    <td className="px-3 py-4 text-slate-600 sm:px-5">{displayPlanName(payment.plan.name)}</td>
                    <td className="hidden break-all px-3 py-4 text-slate-600 sm:px-5 xl:table-cell">{payment.user?.email ?? "-"}</td>
                    <td className="px-3 py-4 text-slate-600 sm:px-5">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminStatusPill active={payment.status === "PAID"}>{formatAdminStatus(payment.status)}</AdminStatusPill>
                    </td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 lg:table-cell">{formatAdminDate(payment.paidAt)}</td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 2xl:table-cell">
                      {payment.callbackStatus ? `${payment.callbackStatus}` : "—"}
                    </td>
                    <td className="hidden px-3 py-4 text-xs text-rose-700 sm:px-5 2xl:table-cell">
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
          <AdminTableShell>
            <table className="w-full min-w-[480px] text-left text-sm lg:min-w-0">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-3 py-4 font-bold sm:px-5">Müşteri</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">Fatura</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Tutar</th>
                  <th className="hidden px-3 py-4 font-bold sm:px-5 lg:table-cell">Ödenme</th>
                  <th className="px-3 py-4 font-bold sm:px-5">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                    </td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 lg:table-cell">{payment.invoice?.invoiceNo ?? "-"}</td>
                    <td className="px-3 py-4 text-slate-600 sm:px-5">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="hidden px-3 py-4 text-slate-600 sm:px-5 lg:table-cell">{formatAdminDate(payment.paidAt)}</td>
                    <td className="px-3 py-4 sm:px-5">
                      <AdminStatusPill active={payment.status === "PAID"}>{formatAdminStatus(payment.status)}</AdminStatusPill>
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
