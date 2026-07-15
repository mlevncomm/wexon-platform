import {
  DashboardAccountStatusNotice,
  DashboardEmptyState,
  DashboardInfoRow,
  DashboardKpiGrid,
  DashboardPanel,
  DashboardSectionTitle,
  DashboardSummaryCard,
  DashboardTableShell,
} from "@/components/marketing/WexonDashboardCards";
import { formatCoreDate, formatCoreStatus, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";
import { isPaytrSubscriptionEnabled } from "@/lib/paytr/paytr-client";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

export default async function DashboardBillingPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  const params = await searchParams;
  const { organization, wexPayLicense, wexPaySubscription } = await getCustomerDashboardData(params);
  const paytrOn = isPaytrSubscriptionEnabled();

  if (!organization) {
    return (
      <DashboardEmptyState
        title="Organizasyon bilgileri bulunamadı."
        description="Fatura bilgilerini görüntülemek için organizasyon kaydı gereklidir."
      />
    );
  }

  const hasRecords = organization.invoices.length > 0 || organization.billingPayments.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}
      <DashboardSectionTitle
        badge="Faturalar"
        title="Fatura ve abonelik"
        description="Abonelik, lisans tipi, ödeme durumu ve fatura kayıtlarınızı buradan takip edebilirsiniz."
      />

      <DashboardKpiGrid>
        <DashboardSummaryCard
          label="Abonelik"
          value={wexPaySubscription ? formatCoreStatus(wexPaySubscription.status) : "Yok"}
        />
        <DashboardSummaryCard
          label="Lisans tipi"
          value={wexPayLicense ? formatCoreStatus(wexPayLicense.licenseType) : "—"}
        />
        <DashboardSummaryCard label="Fatura kaydı" value={organization.invoices.length} />
        <DashboardSummaryCard label="Ödeme kaydı" value={organization.billingPayments.length} />
      </DashboardKpiGrid>

      <DashboardPanel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardInfoRow
            label="Yenileme tarihi"
            value={
              wexPaySubscription?.currentPeriodEnd
                ? formatCoreDate(wexPaySubscription.currentPeriodEnd)
                : wexPayLicense?.endsAt
                  ? formatCoreDate(wexPayLicense.endsAt)
                  : "-"
            }
          />
          <DashboardInfoRow
            label="Son ödeme"
            value={
              organization.billingPayments[0]
                ? formatCoreStatus(organization.billingPayments[0].status)
                : "Henüz yok"
            }
          />
          <DashboardInfoRow label="Online abonelik ödeme" value={paytrOn ? "Açık (yapılandırılmış)" : "Kapalı"} />
          <DashboardInfoRow
            label="Otomatik yenileme"
            value={
              paytrOn
                ? "Sağlayıcı yapılandırmasına bağlı"
                : "Aktif değil — online tahsilat kapalı"
            }
          />
        </div>

        <div className="mt-6">
          {!hasRecords ? (
            <DashboardEmptyState
              title="Henüz fatura kaydı bulunmuyor."
              description="Fatura kayıtları oluştuğunda bu alanda görüntülenecektir."
            />
          ) : (
            <DashboardTableShell>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="font-black">Kayıt</th>
                    <th className="font-black">Tutar</th>
                    <th className="font-black">Tarih</th>
                    <th className="font-black">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {organization.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-black text-slate-950">{invoice.invoiceNo}</td>
                      <td className="font-semibold text-slate-600">
                        {String(invoice.total)} {invoice.currency}
                      </td>
                      <td className="font-semibold text-slate-600">{formatCoreDate(invoice.dueAt)}</td>
                      <td className="font-black text-slate-700">{formatCoreStatus(invoice.status)}</td>
                    </tr>
                  ))}
                  {organization.billingPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="font-black text-slate-950">Ödeme</td>
                      <td className="font-semibold text-slate-600">
                        {String(payment.amount)} {payment.currency}
                      </td>
                      <td className="font-semibold text-slate-600">{formatCoreDate(payment.paidAt)}</td>
                      <td className="font-black text-slate-700">{formatCoreStatus(payment.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashboardTableShell>
          )}
        </div>

        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-600">
          Fatura ve tahsilat bilgileri Wexon Core üzerinden merkezi olarak takip edilir.
          {!paytrOn
            ? " Canlı online ödeme / otomatik tahsilat şu anda kapalıdır; bu sayfada yeni checkout başlatılmaz."
            : " Online ödeme bayrakları açıksa tahsilat sağlayıcı yapılandırmasına göre işler."}
        </p>
      </DashboardPanel>
    </div>
  );
}
