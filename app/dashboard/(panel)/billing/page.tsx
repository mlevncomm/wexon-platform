import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardPanel,
  DashboardSectionTitle,
} from "@/components/marketing/WexonDashboardCards";
import { formatCoreDate, formatCoreStatus, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

function formatPlanAmount(value: unknown, currency: string) {
  if (value === null || value === undefined) return "-";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "-";
  return `${amount.toLocaleString("tr-TR")} ${currency}`;
}

export default async function DashboardBillingPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization, wexPayLicense } = await getCustomerDashboardData(params);

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Fatura bilgilerini görüntülemek için organizasyon kaydı gereklidir."
      />
    );
  }

  return (
    <div className="space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Faturalar"
        title="Fatura ve abonelik"
        description="Abonelik, lisans tipi, ödeme durumu ve fatura kayıtlarınızı buradan takip edebilirsiniz."
      />
      <DashboardPanel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardInfoRow
            label="Aylık paket ücreti"
            value={wexPayLicense ? formatPlanAmount(wexPayLicense.plan.priceMonthly, wexPayLicense.plan.currency) : "-"}
          />
          <DashboardInfoRow label="Lisans tipi" value={wexPayLicense ? formatCoreStatus(wexPayLicense.licenseType) : "Aylık"} />
          <DashboardInfoRow label="Yenileme tarihi" value={wexPayLicense?.endsAt ? formatCoreDate(wexPayLicense.endsAt) : "-"} />
          <DashboardInfoRow label="Son ödeme" value={organization.billingPayments[0] ? formatCoreStatus(organization.billingPayments[0].status) : "Henüz yok"} />
        </div>
        <div className="mt-6">
          {organization.invoices.length === 0 && organization.billingPayments.length === 0 ? (
            <DashboardEmptyState
              title="Henüz fatura kaydı bulunmuyor."
              description="Fatura kayıtları oluştuğunda bu alanda görüntülenecektir."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {organization.invoices.map((invoice) => (
                <div key={invoice.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-4">
                  <span className="font-black text-slate-950">{invoice.invoiceNo}</span>
                  <span className="font-semibold text-slate-600">{String(invoice.total)} {invoice.currency}</span>
                  <span className="font-semibold text-slate-600">{formatCoreDate(invoice.dueAt)}</span>
                  <span className="font-black text-slate-700">{formatCoreStatus(invoice.status)}</span>
                </div>
              ))}
              {organization.billingPayments.map((payment) => (
                <div key={payment.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-4">
                  <span className="font-black text-slate-950">Ödeme</span>
                  <span className="font-semibold text-slate-600">{String(payment.amount)} {payment.currency}</span>
                  <span className="font-semibold text-slate-600">{formatCoreDate(payment.paidAt)}</span>
                  <span className="font-black text-slate-700">{formatCoreStatus(payment.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-600">
          Fatura ve tahsilat bilgileri Wexon Core üzerinden merkezi olarak takip edilir.
        </p>
      </DashboardPanel>
    </div>
  );
}
