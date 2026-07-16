import { AdminEmptyState, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminInlineSelectForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminBillingPaymentAction,
  createAdminInvoiceAction,
  updateAdminInvoiceStatusAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminBillingData, getAdminOperationOptions } from "@/lib/wexon-admin";

const invoiceStatusOptions = [
  { value: "DRAFT", label: "Taslak" },
  { value: "ISSUED", label: "Kesildi" },
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
          <form action={createAdminInvoiceAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value="/admin/billing" />
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
              {invoiceStatusOptions.map((opt) => (
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
            <div className="md:col-span-2">
              <AdminSubmitButton>Fatura oluştur</AdminSubmitButton>
            </div>
          </form>
        </AdminFormPanel>

        <AdminFormPanel title="Tahsilat kaydet" description="Ödeme girişi yapın; fatura seçilirse otomatik ödendi işaretlenir." collapsible>
          <form action={createAdminBillingPaymentAction} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="returnTo" value="/admin/billing" />
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
            <AdminTextField label="Sağlayıcı" name="provider" defaultValue="admin_manual" />
            <AdminTextField label="Referans" name="providerRef" placeholder="Dekont / işlem no" />
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
                      <AdminInlineSelectForm
                        action={updateAdminInvoiceStatusAction.bind(null, invoice.id)}
                        returnTo="/admin/billing"
                        fieldName="status"
                        value={invoice.status}
                        options={invoiceStatusOptions}
                      />
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
