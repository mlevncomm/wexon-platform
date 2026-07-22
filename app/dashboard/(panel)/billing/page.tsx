import Link from "next/link";
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
import { buildCustomerBillingNotices } from "@/lib/wexon-billing-messaging";
import { formatCoreDate, formatCoreStatus, getCustomerDashboardData } from "@/lib/wexon-core-dashboard";
import { isPaytrSubscriptionEnabled } from "@/lib/paytr/paytr-client";

type DashboardSearchParams = Promise<{ organizationId?: string; organizationSlug?: string }>;

function noticeClasses(tone: "info" | "warning" | "critical") {
  if (tone === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-950";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

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
  const lifecycleNotices = buildCustomerBillingNotices({
    subscription: wexPaySubscription
      ? {
          status: wexPaySubscription.status,
          cancelAt: wexPaySubscription.cancelAt,
          currentPeriodEnd: wexPaySubscription.currentPeriodEnd,
        }
      : null,
    license: wexPayLicense
      ? { endsAt: wexPayLicense.endsAt, status: wexPayLicense.status }
      : null,
    paytrSubscriptionEnabled: paytrOn,
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {!organization.isActive && <DashboardAccountStatusNotice />}

      <DashboardSectionTitle
        badge="Faturalar"
        title="Fatura ve abonelik"
        description="Abonelik, lisans tipi, ödeme durumu ve fatura kayıtlarınızı buradan takip edebilirsiniz."
      />

      {lifecycleNotices.length > 0 ? (
        <div className="space-y-3" data-testid="billing-lifecycle-notices">
          {lifecycleNotices.map((notice) => (
            <div
              key={`${notice.title}-${notice.tone}`}
              className={`rounded-2xl border p-4 shadow-sm ${noticeClasses(notice.tone)}`}
            >
              <p className="text-sm font-black">{notice.title}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed">{notice.body}</p>
              {(notice.title.includes("iptal") ||
                notice.title.includes("İptal") ||
                notice.title.includes("doldu") ||
                notice.title.includes("Yenileme")) && (
                <p className="mt-3 text-sm font-bold">
                  <Link href="/dashboard/products" className="underline underline-offset-2">
                    Paketler sayfasına git
                  </Link>
                  {" · "}
                  <Link href="/contact" className="underline underline-offset-2">
                    Destek / satış
                  </Link>
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

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
            label="İptal tarihi"
            value={
              wexPaySubscription?.cancelAt ? formatCoreDate(wexPaySubscription.cancelAt) : "Planlanmadı"
            }
          />
          <DashboardInfoRow label="Online abonelik ödeme" value={paytrOn ? "Açık (yapılandırılmış)" : "Kapalı"} />
          <DashboardInfoRow
            label="Otomatik yenileme"
            value="Aktif değil — dönem sonunda manuel yenileme gerekir"
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
          Fatura ve tahsilat bilgileri Wexon Core üzerinden merkezi olarak takip edilir. Recurring
          (otomatik yenileme) Akıllı Aktivasyon kapsamında açılmaz; dönem sonunda manuel yenileme
          veya admin lisans açılışı kullanılır.
          {!paytrOn
            ? " Canlı online ödeme bayrakları kapalıysa bu sayfada yeni ödeme oturumu başlatılmaz."
            : " Online ödeme bayrakları açıksa paket satın alma sayfası üzerinden ilerler."}
        </p>
      </DashboardPanel>
    </div>
  );
}
