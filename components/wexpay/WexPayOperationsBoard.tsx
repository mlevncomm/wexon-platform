"use client";

import type { OperationsNotification, OperationsOverview, OperationsTopProduct } from "@/lib/wexpay-read";
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

const notificationTypeLabels: Record<string, string> = {
  ORDER_CREATED: "Sipariş",
  ORDER_UPDATED: "Sipariş",
  PAYMENT_RECEIVED: "Ödeme",
  RECEIPT_REQUESTED: "Fiş",
  TABLE_UPDATED: "Masa",
  MENU_UPDATED: "Menü",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function WexPayOperationsBoard({
  overview,
  packageInfo,
}: {
  overview: OperationsOverview;
  packageInfo: { planName: string; licenseStatus: string; installationStatus: string };
}) {
  const { notifications, topProducts, metrics } = overview;

  const metricCards = [
    {
      label: "Bugünkü toplam ödeme",
      value: formatLira(metrics.dailyPaidTotal),
      detail: `${metrics.dailyPaymentCount} işlem`,
      accent: metrics.dailyPaidTotal > 0,
    },
    {
      label: "Aktif masalar",
      value: String(metrics.activeTableCount),
      detail: "Boş olmayan masalar",
      accent: metrics.activeTableCount > 0,
    },
    {
      label: "Bekleyen siparişler",
      value: String(metrics.openOrderCount),
      detail: "Yeni ve hazırlanıyor durumunda",
      accent: metrics.openOrderCount > 0,
    },
    {
      label: "Fiş talepleri",
      value: String(metrics.receiptRequestCount),
      detail: "Ödemelerden gelen talepler",
      accent: metrics.receiptRequestCount > 0,
    },
    {
      label: "Okunmamış olay",
      value: String(metrics.unreadNotificationCount),
      detail: "Canlı akışta bekleyen",
      accent: metrics.unreadNotificationCount > 0,
    },
    {
      label: "Ortalama adisyon",
      value: formatLira(metrics.averageTicket),
      detail: "Bugünkü ortalama",
      accent: metrics.averageTicket > 0,
    },
  ];

  return (
    <WexPayPage>
      <WexPayMetricStrip eyebrow="Genel bakış" title="Günlük özet" description="Şube operasyon metrikleri">
        {metricCards.map((metric) => (
          <WexPayMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            accent={metric.accent}
          />
        ))}
      </WexPayMetricStrip>

      <WexPayPanelGrid className="items-stretch xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TopProducts products={topProducts.slice(0, 3)} />
        <PackageCard packageInfo={packageInfo} />
      </WexPayPanelGrid>

      <LiveEvents notifications={notifications} />
    </WexPayPage>
  );
}

function TopProducts({ products }: { products: OperationsTopProduct[] }) {
  return (
    <WexPayPanel eyebrow="Performans" title="En çok satılan 3 ürün" className="flex min-h-0 flex-col">
      {products.length === 0 ? (
        <WexPayEmptyNotice>Henüz satış verisi yok.</WexPayEmptyNotice>
      ) : (
        <div className="grid flex-1 gap-3">
          {products.map((product, index) => (
            <WexPaySurface key={product.productId} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    {index + 1}
                  </span>
                  <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
                </div>
                <p className="mt-1 pl-9 text-xs font-semibold text-slate-500">{product.quantity} satış</p>
              </div>
              <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(product.total)}</p>
            </WexPaySurface>
          ))}
        </div>
      )}
    </WexPayPanel>
  );
}

function LiveEvents({ notifications }: { notifications: OperationsNotification[] }) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <WexPayPanel
      eyebrow="Canlı akış"
      title="Son canlı olaylar"
      description={`${unreadCount} okunmamış olay`}
      headerAction={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          Bildirimleri Yenile
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {notifications.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-5">
            <WexPayEmptyNotice>Henüz canlı olay bulunmuyor.</WexPayEmptyNotice>
          </div>
        )}
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`min-w-0 rounded-[16px] border p-4 ${
              notification.isRead
                ? "border-slate-200/80 bg-slate-50/70"
                : "border-emerald-200 bg-emerald-50/80 shadow-sm shadow-emerald-900/5"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] font-black text-emerald-800">
                  {notificationTypeLabels[notification.type] ?? "Olay"}
                </span>
                {!notification.isRead && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                    Yeni
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-slate-400">{formatTime(notification.createdAt)}</span>
            </div>
            <p className="truncate text-sm font-black text-slate-900">{notification.title}</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-slate-600">{notification.message}</p>
          </div>
        ))}
      </div>
    </WexPayPanel>
  );
}

function PackageCard({
  packageInfo,
}: {
  packageInfo: { planName: string; licenseStatus: string; installationStatus: string };
}) {
  const rows = [
    { label: "Lisans durumu", value: packageInfo.licenseStatus },
    { label: "Kurulum", value: packageInfo.installationStatus },
  ];

  return (
    <WexPayPanel eyebrow="Paket durumu" title={packageInfo.planName} className="flex min-h-0 flex-col">
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4">
        <p className="text-xs font-semibold text-slate-500">Aktif lisans paketi</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-emerald-800">{packageInfo.planName}</p>
        <span className="mt-3 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-700">
          {packageInfo.licenseStatus}
        </span>
      </div>

      <div className="grid flex-1 gap-3">
        {rows.map((row) => (
          <WexPaySurface key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0 truncate text-sm font-medium text-slate-500">{row.label}</span>
            <span className="shrink-0 text-sm font-black text-slate-950">{row.value}</span>
          </WexPaySurface>
        ))}
      </div>
    </WexPayPanel>
  );
}
