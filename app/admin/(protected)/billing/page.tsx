import { AdminEmptyState, AdminPanel, AdminSectionTitle, AdminStatusPill, AdminSummaryCard, AdminTableShell } from "@/components/marketing/WexonAdminCards";
import { AdminSoftNotice } from "@/components/marketing/WexonAdminContent";
import { AdminActionNotice, AdminDateField, AdminFormPanel, AdminSelectField, AdminSubmitButton, AdminTextField } from "@/components/marketing/WexonAdminForms";
import { AdminInlineSelectForm, AdminOrgLink, AdminQuickLinks } from "@/components/marketing/WexonAdminOperations";
import {
  createAdminBillingPaymentAction,
  createAdminInvoiceAction,
  updateAdminInvoiceStatusAction,
} from "@/lib/wexon-admin-actions";
import { displayPlanName, formatAdminDate, formatAdminStatus, getAdminBillingData, getAdminOperationOptions } from "@/lib/wexon-admin";
import { isPaytrRecurringEnabled, isPaytrSubscriptionEnabled } from "@/lib/paytr/paytr-client";

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
  const paytrSubscriptionOn = isPaytrSubscriptionEnabled();
  const paytrRecurringOn = isPaytrRecurringEnabled();
  const paidTotal = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);

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

      <AdminSoftNotice>
        PayTR abonelik API: {paytrSubscriptionOn ? "açık" : "kapalı"} · recurring: {paytrRecurringOn ? "açık" : "kapalı"}.
        Bu ekranda canlı tahsilat durumu iddiası yoktur; kayıtlar manuel fatura/ledger görünümüdür.
      </AdminSoftNotice>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <AdminSummaryCard label="Toplam fatura" value={invoices.length} helper="Oluşturulan faturalar" />
        <AdminSummaryCard label="Bekleyen" value={pendingInvoices.length} helper="ISSUED / OVERDUE" tone={pendingInvoices.length ? "warning" : "default"} />
        <AdminSummaryCard label="Ödenen" value={paidInvoices.length} helper="PAID durumu" tone="success" />
        <AdminSummaryCard label="İptal" value={invoices.filter((invoice) => invoice.status === "VOID").length} helper="VOID" />
        <AdminSummaryCard
          label="Nominal tutar (PAID)"
          value={paidTotal.toLocaleString("tr-TR")}
          helper="Ödenen faturaların toplamı"
        />
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
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-bold">Fatura no</th>
                  <th className="px-5 py-4 font-bold">Müşteri</th>
                  <th className="px-5 py-4 font-bold">Tutar</th>
                  <th className="px-5 py-4 font-bold">Vade</th>
                  <th className="px-5 py-4 font-bold">Durum</th>
                  <th className="px-5 py-4 font-bold">Güncelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-5 py-4 font-semibold text-slate-950">{invoice.invoiceNo}</td>
                    <td className="px-5 py-4">
                      <AdminOrgLink id={invoice.organizationId} name={invoice.organization.name} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {String(invoice.total)} {invoice.currency}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatAdminDate(invoice.dueAt)}</td>
                    <td className="px-5 py-4">
                      <AdminStatusPill active={invoice.status === "PAID"}>{formatAdminStatus(invoice.status)}</AdminStatusPill>
                    </td>
                    <td className="px-5 py-4">
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
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-bold">merchantOid</th>
                  <th className="px-5 py-4 font-bold">Provider</th>
                  <th className="px-5 py-4 font-bold">Müşteri</th>
                  <th className="px-5 py-4 font-bold">Plan</th>
                  <th className="px-5 py-4 font-bold">Customer</th>
                  <th className="px-5 py-4 font-bold">Tutar</th>
                  <th className="px-5 py-4 font-bold">Durum</th>
                  <th className="px-5 py-4 font-bold">paidAt</th>
                  <th className="px-5 py-4 font-bold">Callback</th>
                  <th className="px-5 py-4 font-bold">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptionPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4 font-mono text-xs text-slate-700">{payment.merchantOid}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {payment.provider}/{payment.providerMode}
                    </td>
                    <td className="px-5 py-4">
                      <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{displayPlanName(payment.plan.name)}</td>
                    <td className="px-5 py-4 text-slate-600">{payment.user?.email ?? "-"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="px-5 py-4">
                      <AdminStatusPill active={payment.status === "PAID"}>{formatAdminStatus(payment.status)}</AdminStatusPill>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatAdminDate(payment.paidAt)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {payment.callbackStatus ? `${payment.callbackStatus}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-rose-700">
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
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-bold">Müşteri</th>
                  <th className="px-5 py-4 font-bold">Fatura</th>
                  <th className="px-5 py-4 font-bold">Tutar</th>
                  <th className="px-5 py-4 font-bold">Ödenme</th>
                  <th className="px-5 py-4 font-bold">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4">
                      <AdminOrgLink id={payment.organizationId} name={payment.organization.name} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{payment.invoice?.invoiceNo ?? "-"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {String(payment.amount)} {payment.currency}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatAdminDate(payment.paidAt)}</td>
                    <td className="px-5 py-4">
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
