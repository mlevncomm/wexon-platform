import Link from "next/link";
import { getWexPayAccess } from "@/lib/wexpay-auth";
import { getWexPayOperationsOverview } from "@/lib/wexpay-read";
import { formatLira, WexPayEmptyNotice, WexPayMetricCard, WexPayMetricStrip, WexPayPage, WexPayPanel, WexPayPanelGrid, WexPaySurface } from "@/components/wexpay/WexPayBusinessUI";

type SearchParams = Promise<{ branchId?: string }>;

export default async function WexPayReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getWexPayAccess();
  if (!access.allowed) return null;

  const { branchId } = await searchParams;
  const branchOptions = access.organization.restaurants.flatMap((restaurant) =>
    restaurant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({ id: branch.id, name: branch.name, restaurantName: restaurant.name })),
  );
  const activeBranch = branchOptions.find((branch) => branch.id === branchId) ?? branchOptions[0] ?? null;

  if (!activeBranch) {
    return (
      <WexPayPanel
        eyebrow="Raporlar"
        title="Rapor için aktif şube gerekli"
        description="Satış ve operasyon raporlarını görmek için önce bir şube oluşturun."
        headerAction={
          <Link
            href="/apps/wexpay/branches"
            className="inline-flex rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            Şube oluştur
          </Link>
        }
      />
    );
  }

  const overview = await getWexPayOperationsOverview(access.organization.id, activeBranch.id);
  const successfulPayments = overview.tables.flatMap((table) => table.payments).filter((payment) => payment.status === "PAID");
  const paymentCount = overview.tables.flatMap((table) => table.payments).length;
  const paymentSuccessRate = paymentCount > 0 ? Math.round((successfulPayments.length / paymentCount) * 100) : 0;
  const activeProducts = overview.topProducts.reduce((sum, product) => sum + product.quantity, 0);

  const reportCards = [
    {
      label: "Günlük Ciro",
      value: formatLira(overview.metrics.dailyPaidTotal),
      detail: "Başarılı ödemelerden hesaplandı",
      accent: overview.metrics.dailyPaidTotal > 0,
    },
    {
      label: "Açık Sipariş",
      value: String(overview.metrics.openOrderCount),
      detail: "Yeni ve hazırlanıyor durumunda",
      accent: overview.metrics.openOrderCount > 0,
    },
    {
      label: "Ödeme Başarı Oranı",
      value: `%${paymentSuccessRate}`,
      detail: `${successfulPayments.length}/${paymentCount || 0} başarılı ödeme`,
      accent: paymentSuccessRate > 0,
    },
    {
      label: "Ortalama Adisyon",
      value: formatLira(overview.metrics.averageTicket),
      detail: "Bugünkü sipariş ortalaması",
      accent: overview.metrics.averageTicket > 0,
    },
    {
      label: "Aktif Masa",
      value: String(overview.metrics.activeTableCount),
      detail: "Boş olmayan masa sayısı",
      accent: overview.metrics.activeTableCount > 0,
    },
    {
      label: "Satılan Ürün",
      value: String(activeProducts),
      detail: "Sipariş kalemlerinden toplam adet",
      accent: activeProducts > 0,
    },
  ];

  const tableStatusRows = [
    { label: "Boş", count: overview.tables.filter((table) => table.status === "EMPTY").length },
    { label: "Dolu", count: overview.tables.filter((table) => table.status === "OCCUPIED").length },
    { label: "Ödeme bekliyor", count: overview.tables.filter((table) => table.status === "PAYMENT_PENDING").length },
    { label: "Kısmi ödendi", count: overview.tables.filter((table) => table.status === "PARTIALLY_PAID").length },
    { label: "Ödendi", count: overview.tables.filter((table) => table.status === "PAID").length },
  ];

  return (
    <WexPayPage>
      <WexPayPanel
        eyebrow="Operasyon raporu"
        title="Raporlar"
        description={`${activeBranch.restaurantName} · ${activeBranch.name} için sipariş, ödeme ve masa özeti.`}
        headerAction={
          <Link
            href={`/apps/wexpay/reports?branchId=${activeBranch.id}`}
            className="inline-flex rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            Raporları Yenile
          </Link>
        }
      />

      <WexPayMetricStrip
        eyebrow="Metrikler"
        title="Rapor özeti"
        gridClassName="grid gap-3 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5"
      >
        {reportCards.map((card) => (
          <WexPayMetricCard key={card.label} label={card.label} value={card.value} detail={card.detail} accent={card.accent} />
        ))}
      </WexPayMetricStrip>

      <WexPayPanelGrid className="xl:grid-cols-2">
        <WexPayPanel eyebrow="Performans" title="En çok satılan ürünler">
          <div className="grid min-w-0 gap-3">
            {overview.topProducts.length === 0 && (
              <WexPayEmptyNotice>Henüz satış verisi bulunmuyor.</WexPayEmptyNotice>
            )}
            {overview.topProducts.map((product) => (
              <WexPaySurface key={product.productId} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{product.quantity} adet</p>
                </div>
                <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(product.total)}</p>
              </WexPaySurface>
            ))}
          </div>
        </WexPayPanel>

        <ReportBreakdown title="Masa doluluk özeti" rows={tableStatusRows} />
      </WexPayPanelGrid>
    </WexPayPage>
  );
}

function ReportBreakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <WexPayPanel eyebrow="Özet" title={title}>
      <div className="grid min-w-0 gap-3">
        {rows.map((row) => (
          <WexPaySurface key={row.label} className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-slate-700">{row.label}</p>
            <p className="text-lg font-black text-slate-950">{row.count}</p>
          </WexPaySurface>
        ))}
      </div>
    </WexPayPanel>
  );
}
