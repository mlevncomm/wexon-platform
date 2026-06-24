"use client";

import Link from "next/link";
import type { ProviderPaymentBreakdownRow } from "@/lib/wexpay-read";
import { appNavigationUrl } from "@/lib/wexon/urls";
import {
  formatLira,
  WexPayEmptyNotice,
  WexPayMetricCard,
  WexPayMetricStrip,
  WexPayPage,
  WexPayPanel,
  WexPayPanelGrid,
  WexPaySurface,
} from "@/components/wexpay/WexPayBusinessUI";

type ReportProduct = {
  productId: string;
  name: string;
  quantity: number;
  total: number;
};

type OpenTableRow = {
  id: string;
  label: string;
  status: string;
  remainingAmount: number;
  totalAmount: number;
  paidAmount: number;
};

function providerLabel(provider: string) {
  switch (provider) {
    case "paytr":
      return "PayTR";
    case "manual":
      return "Manuel";
    case "iyzico":
      return "iyzico";
    case "param":
      return "Param";
    default:
      return provider;
  }
}

export default function WexPayReportsBoard({
  branchId,
  organizationId,
  dailyPaidTotal,
  paidCount,
  providerBreakdown,
  topProducts,
  openTables,
  tableStatusRows,
}: {
  branchId: string;
  organizationId: string;
  dailyPaidTotal: number;
  paidCount: number;
  providerBreakdown: ProviderPaymentBreakdownRow[];
  topProducts: ReportProduct[];
  openTables: OpenTableRow[];
  tableStatusRows: Array<{ label: string; count: number }>;
}) {
  const exportHref = `/api/wexpay/reports/export?organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`;

  return (
    <WexPayPage>
      <WexPayPanel
        eyebrow="Operasyon raporu"
        title="Raporlar"
        headerAction={
          <div className="flex flex-wrap gap-2">
            <a
              href={exportHref}
              className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              CSV indir
            </a>
            <Link
              href={appNavigationUrl("/apps/wexpay/reports", `branchId=${encodeURIComponent(branchId)}`)}
              className="inline-flex rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Yenile
            </Link>
          </div>
        }
      />

      <WexPayMetricStrip eyebrow="Gün sonu" title="İstanbul saat dilimi (bugün)" gridClassName="grid gap-3 bg-slate-50/60 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
        <WexPayMetricCard label="Günlük ciro" value={formatLira(dailyPaidTotal)} detail={`${paidCount} başarılı ödeme`} accent={dailyPaidTotal > 0} />
        <WexPayMetricCard label="Açık adisyon" value={String(openTables.length)} detail="Kalan tutarı olan masalar" accent={openTables.length > 0} />
        <WexPayMetricCard label="Sağlayıcı sayısı" value={String(providerBreakdown.length)} detail="Bugünkü ödeme kırılımı" accent={providerBreakdown.length > 0} />
      </WexPayMetricStrip>

      <WexPayPanelGrid className="xl:grid-cols-2">
        <WexPayPanel eyebrow="Ödeme" title="Sağlayıcı kırılımı">
          <div className="grid min-w-0 gap-3">
            {providerBreakdown.length === 0 && <WexPayEmptyNotice>Bugün için ödeme kaydı yok.</WexPayEmptyNotice>}
            {providerBreakdown.map((row) => (
              <WexPaySurface key={row.provider} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{providerLabel(row.provider)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{row.count} işlem</p>
                </div>
                <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(row.total)}</p>
              </WexPaySurface>
            ))}
          </div>
        </WexPayPanel>

        <WexPayPanel eyebrow="Masa" title="Doluluk özeti">
          <div className="grid min-w-0 gap-3">
            {tableStatusRows.map((row) => (
              <WexPaySurface key={row.label} className="flex items-center justify-between gap-4">
                <p className="text-sm font-bold text-slate-700">{row.label}</p>
                <p className="text-lg font-black text-slate-950">{row.count}</p>
              </WexPaySurface>
            ))}
          </div>
        </WexPayPanel>

        <WexPayPanel eyebrow="Performans" title="En çok satılan ürünler" className="xl:col-span-2">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {topProducts.length === 0 && (
              <div className="sm:col-span-2">
                <WexPayEmptyNotice>Henüz satış verisi bulunmuyor.</WexPayEmptyNotice>
              </div>
            )}
            {topProducts.map((product) => (
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

        <WexPayPanel eyebrow="Adisyon" title="Açık masalar" className="xl:col-span-2">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {openTables.length === 0 && (
              <div className="sm:col-span-2">
                <WexPayEmptyNotice>Açık adisyon bulunmuyor.</WexPayEmptyNotice>
              </div>
            )}
            {openTables.map((table) => (
              <WexPaySurface key={table.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{table.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{table.status}</p>
                </div>
                <p className="shrink-0 text-sm font-black text-amber-800">{formatLira(table.remainingAmount)}</p>
              </WexPaySurface>
            ))}
          </div>
        </WexPayPanel>
      </WexPayPanelGrid>
    </WexPayPage>
  );
}
