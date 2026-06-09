"use client";

import { useMemo, useState } from "react";

type TableStatus =
  | "empty"
  | "occupied"
  | "payment_pending"
  | "partially_paid"
  | "paid"
  | "receipt_requested";

type Filter = "All" | "Pending" | "Partial" | "Receipts" | "Paid";
type PaymentStatus = "Paid" | "Pending" | "Partial" | "Failed" | "Closed";
type ReceiptStatus = "none" | "requested" | "printed";
type NotificationType = "payment" | "receipt" | "partial" | "failed" | "closed";

interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  total: string;
  paid: string;
  remaining: string;
  receiptStatus: ReceiptStatus;
  isClosed?: boolean;
}

interface Kpi {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "sky" | "rose" | "slate";
}

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: NotificationType;
  tone: "emerald" | "amber" | "sky" | "rose" | "slate";
}

interface Activity {
  id: string;
  time: string;
  table: string;
  amount: string;
  status: PaymentStatus;
  receipt: string;
}

const initialTables: RestaurantTable[] = [
  { id: "t01", label: "Masa 01", seats: 2, status: "empty", total: "0 TL", paid: "0 TL", remaining: "0 TL", receiptStatus: "none" },
  { id: "t02", label: "Masa 02", seats: 4, status: "occupied", total: "640 TL", paid: "0 TL", remaining: "640 TL", receiptStatus: "none" },
  { id: "t03", label: "Masa 03", seats: 4, status: "payment_pending", total: "1.240 TL", paid: "0 TL", remaining: "1.240 TL", receiptStatus: "none" },
  { id: "t04", label: "Masa 04", seats: 6, status: "partially_paid", total: "980 TL", paid: "420 TL", remaining: "560 TL", receiptStatus: "none" },
  { id: "t05", label: "Masa 05", seats: 2, status: "paid", total: "390 TL", paid: "390 TL", remaining: "0 TL", receiptStatus: "none" },
  { id: "t06", label: "Masa 06", seats: 4, status: "receipt_requested", total: "720 TL", paid: "720 TL", remaining: "0 TL", receiptStatus: "requested" },
  { id: "t07", label: "Masa 07", seats: 2, status: "occupied", total: "280 TL", paid: "0 TL", remaining: "280 TL", receiptStatus: "none" },
  { id: "t08", label: "Masa 08", seats: 5, status: "payment_pending", total: "1.480 TL", paid: "0 TL", remaining: "1.480 TL", receiptStatus: "requested" },
  { id: "t09", label: "Masa 09", seats: 4, status: "empty", total: "0 TL", paid: "0 TL", remaining: "0 TL", receiptStatus: "none" },
  { id: "t10", label: "Masa 10", seats: 8, status: "partially_paid", total: "2.140 TL", paid: "1.200 TL", remaining: "940 TL", receiptStatus: "none" },
  { id: "t11", label: "Masa 11", seats: 2, status: "paid", total: "510 TL", paid: "510 TL", remaining: "0 TL", receiptStatus: "printed", isClosed: true },
  { id: "t12", label: "Masa 12", seats: 4, status: "occupied", total: "860 TL", paid: "0 TL", remaining: "860 TL", receiptStatus: "none" },
  { id: "t13", label: "Masa 13", seats: 6, status: "receipt_requested", total: "1.120 TL", paid: "1.120 TL", remaining: "0 TL", receiptStatus: "requested" },
  { id: "t14", label: "Masa 14", seats: 2, status: "empty", total: "0 TL", paid: "0 TL", remaining: "0 TL", receiptStatus: "none" },
  { id: "t15", label: "Masa 15", seats: 4, status: "occupied", total: "430 TL", paid: "0 TL", remaining: "430 TL", receiptStatus: "none" },
  { id: "t16", label: "Masa 16", seats: 4, status: "payment_pending", total: "760 TL", paid: "0 TL", remaining: "760 TL", receiptStatus: "none" },
  { id: "t17", label: "Masa 17", seats: 2, status: "paid", total: "350 TL", paid: "350 TL", remaining: "0 TL", receiptStatus: "none" },
  { id: "t18", label: "Masa 18", seats: 6, status: "partially_paid", total: "1.890 TL", paid: "900 TL", remaining: "990 TL", receiptStatus: "none" },
];

const selectedItems = [
  { name: "Cheeseburger", qty: 2, amount: "620 TL" },
  { name: "Trüflü Patates", qty: 1, amount: "210 TL" },
  { name: "Soğuk Çay", qty: 3, amount: "270 TL" },
  { name: "San Sebastian", qty: 2, amount: "380 TL" },
];

const timeline = [
  { time: "14:42", title: "Müşteri QR hesabı açtı", description: "Masa 08 hesabı mobilde görüntülendi." },
  { time: "14:45", title: "Ödeme başlatıldı", description: "Tam hesap ödeme akışı başladı." },
  { time: "14:46", title: "Fiş talep edildi", description: "Müşteri basılı fiş talep etti." },
];

const initialNotifications: Notification[] = [
  { id: "n01", title: "Ödeme alındı", description: "Masa 05 hesabı 390 TL olarak tamamen ödendi.", time: "1 dakika önce", type: "payment", tone: "emerald" },
  { id: "n02", title: "Fiş talep edildi", description: "Masa 08 basılı fiş talep etti.", time: "2 dakika önce", type: "receipt", tone: "amber" },
  { id: "n03", title: "Kısmi ödeme tamamlandı", description: "Masa 10 için 1.200 TL ödendi, 940 TL kaldı.", time: "5 dakika önce", type: "partial", tone: "sky" },
  { id: "n04", title: "Ödeme başarısız", description: "Masa 03 ödeme denemesi reddedildi.", time: "8 dakika önce", type: "failed", tone: "rose" },
  { id: "n05", title: "Masa kapatıldı", description: "Masa 11 kasiyer tarafından kapatıldı.", time: "12 dakika önce", type: "closed", tone: "slate" },
];

const initialActivities: Activity[] = [
  { id: "a01", time: "14:48", table: "Masa 05", amount: "390 TL", status: "Paid", receipt: "Yok" },
  { id: "a02", time: "14:46", table: "Masa 08", amount: "1.480 TL", status: "Pending", receipt: "Talep Edildi" },
  { id: "a03", time: "14:41", table: "Masa 10", amount: "1.200 TL", status: "Partial", receipt: "Yok" },
  { id: "a04", time: "14:38", table: "Masa 03", amount: "1.240 TL", status: "Failed", receipt: "Yok" },
  { id: "a05", time: "14:31", table: "Masa 11", amount: "510 TL", status: "Closed", receipt: "Yazdırıldı" },
  { id: "a06", time: "14:27", table: "Masa 13", amount: "1.120 TL", status: "Paid", receipt: "Talep Edildi" },
];

const statusConfig: Record<TableStatus, { label: string; badge: string; dot: string; bar: string }> = {
  empty: {
    label: "Boş",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
    bar: "border-l-slate-300",
  },
  occupied: {
    label: "Dolu",
    badge: "border-amber-200 bg-white text-amber-700",
    dot: "bg-amber-400",
    bar: "border-l-amber-400",
  },
  payment_pending: {
    label: "Ödeme Bekliyor",
    badge: "border-emerald-200 bg-white text-emerald-700",
    dot: "bg-[#10b981]",
    bar: "border-l-[#10b981]",
  },
  partially_paid: {
    label: "Kısmi Ödendi",
    badge: "border-sky-200 bg-white text-sky-700",
    dot: "bg-sky-500",
    bar: "border-l-sky-500",
  },
  paid: {
    label: "Ödendi",
    badge: "border-green-200 bg-white text-green-700",
    dot: "bg-green-500",
    bar: "border-l-green-500",
  },
  receipt_requested: {
    label: "Fiş Talep Edildi",
    badge: "border-rose-200 bg-white text-rose-700",
    dot: "bg-rose-500",
    bar: "border-l-rose-500",
  },
};

const toneClasses: Record<Kpi["tone"], string> = {
  emerald: "border-slate-200 border-l-4 border-l-[#10b981] text-emerald-700",
  amber: "border-slate-200 border-l-4 border-l-amber-400 text-amber-700",
  sky: "border-slate-200 border-l-4 border-l-sky-500 text-sky-700",
  rose: "border-slate-200 border-l-4 border-l-rose-500 text-rose-700",
  slate: "border-slate-200 border-l-4 border-l-slate-400 text-slate-700",
};

const paymentStatusClasses: Record<PaymentStatus, string> = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Partial: "bg-sky-50 text-sky-700 border-sky-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
  Closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const filterLabels: Record<Filter, string> = {
  All: "Tümü",
  Pending: "Bekleyen",
  Partial: "Kısmi",
  Receipts: "Fiş Talepleri",
  Paid: "Ödenenler",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  Paid: "Ödendi",
  Pending: "Bekleyen",
  Partial: "Kısmi",
  Failed: "Başarısız",
  Closed: "Kapatıldı",
};

function parseLira(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

function formatLira(value: number) {
  return `${new Intl.NumberFormat("tr-TR").format(value)} TL`;
}

function currentTime() {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function matchesFilter(table: RestaurantTable, filter: Filter) {
  if (filter === "All") return true;
  if (filter === "Pending") return table.status === "payment_pending";
  if (filter === "Partial") return table.status === "partially_paid";
  if (filter === "Receipts") return table.receiptStatus === "requested";
  return table.status === "paid";
}

function receiptLabel(status: ReceiptStatus) {
  if (status === "requested") return "Talep Edildi";
  if (status === "printed") return "Yazdırıldı";
  return "Talep Yok";
}

function buildKpis(currentTables: RestaurantTable[]): Kpi[] {
  const paidTotal = currentTables.reduce((sum, table) => sum + parseLira(table.paid), 0);
  const paidTables = currentTables.filter((table) => table.status === "paid").length;
  const pendingPayments = currentTables.filter((table) => table.status === "payment_pending").length;
  const receiptRequests = currentTables.filter((table) => table.receiptStatus === "requested").length;
  const partialPayments = currentTables.filter((table) => table.status === "partially_paid").length;

  return [
    {
      label: "Bugünkü toplam ödemeler",
      value: formatLira(paidTotal),
      detail: "Ödenen tutarlardan hesaplandı",
      tone: "emerald",
    },
    {
      label: "Ödenen masalar",
      value: String(paidTables),
      detail: `${currentTables.filter((table) => table.isClosed).length} kapatılan masa`,
      tone: "sky",
    },
    {
      label: "Bekleyen ödemeler",
      value: String(pendingPayments),
      detail: "Müşteri aksiyonu bekliyor",
      tone: "amber",
    },
    {
      label: "Fiş talepleri",
      value: String(receiptRequests),
      detail: receiptRequests > 0 ? "Personel takibi gerekiyor" : "Tüm fişler işlendi",
      tone: "rose",
    },
    {
      label: "Kısmi ödemeler",
      value: String(partialPayments),
      detail: "Açık bakiye bulunuyor",
      tone: "slate",
    },
  ];
}

function AppBar({
  search,
  selectedFilter,
  onSearchChange,
  onFilterChange,
}: {
  search: string;
  selectedFilter: Filter;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: Filter) => void;
}) {
  const filters: Filter[] = ["All", "Pending", "Partial", "Receipts", "Paid"];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 2xl:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#10b981]">WexPay</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Masa Yönetici Paneli
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Şube
              </p>
              <p className="text-sm font-semibold text-slate-900">Kadıköy Bistro</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Tarih
              </p>
              <p className="text-sm font-semibold text-slate-900">Bugün, 17 Mayıs</p>
            </div>
            <span className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
              Canlı
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                <circle cx="11" cy="11" r="7" />
              </svg>
            </span>
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#10b981] focus:ring-4 focus:ring-emerald-100"
              placeholder="Masa, durum veya fiş ara..."
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold ${
                  selectedFilter === filter
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {filterLabels[filter]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <article
          key={kpi.label}
          className={`rounded-[24px] bg-white p-5 shadow-sm ${toneClasses[kpi.tone]}`}
        >
          <p className="mb-2 text-xs font-semibold text-slate-500">{kpi.label}</p>
          <p className="mb-1 text-2xl font-bold text-slate-950">{kpi.value}</p>
          <p className="text-xs font-medium">{kpi.detail}</p>
        </article>
      ))}
    </section>
  );
}

function TableGrid({
  tables,
  selectedTableId,
  onSelectTable,
}: {
  tables: RestaurantTable[];
  selectedTableId: string;
  onSelectTable: (tableId: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Masa Listesi</h2>
          <p className="text-sm text-slate-500">
            {tables.length} eşleşen restoran masası gerçek zamanlı izleniyor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusConfig).map(([key, status]) => (
            <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {tables.map((table) => {
          const status = statusConfig[table.status];
          const isSelected = table.id === selectedTableId;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelectTable(table.id)}
              className={`rounded-2xl border border-l-4 bg-white p-3.5 text-left text-slate-700 transition-transform hover:-translate-y-0.5 hover:border-slate-300 ${status.bar} ${
                isSelected ? "border-emerald-300 bg-emerald-50/40 ring-2 ring-[#10b981]/35 shadow-md" : "border-slate-200 shadow-sm"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">{table.label}</h3>
                  <p className="text-xs text-slate-500">{table.seats} kişilik</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Toplam</span>
                  <span className="font-semibold text-slate-950">{table.total}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Kalan</span>
                  <span className="font-semibold">{table.remaining}</span>
                </div>
                <p className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.badge}`}>
                  {status.label}
                </p>
                <p className="text-[11px] text-slate-500">Fiş: {receiptLabel(table.receiptStatus)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedTablePanel({
  selected,
  confirmation,
  onMarkReceiptPrinted,
  onCloseTable,
  onViewPaymentDetails,
}: {
  selected: RestaurantTable;
  confirmation: string | null;
  onMarkReceiptPrinted: () => void;
  onCloseTable: () => void;
  onViewPaymentDetails: () => void;
}) {
  const receiptPrinted = selected.receiptStatus === "printed";
  const closeDisabled = selected.isClosed || (selected.status === "paid" && selected.remaining === "0 TL");

  return (
    <aside className="self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-[156px]">
      <div className="border-b border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#10b981]">
          Seçili Masa
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">{selected.label}</h2>
            <p className="text-sm text-slate-500">{selected.seats} kişilik · Ana salon</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusConfig[selected.status].badge}`}
          >
            {statusConfig[selected.status].label}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3.5" open>
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
            Hesap Özeti
          </summary>
          <div className="mt-3 grid gap-2">
            {[
              ["Güncel hesap toplamı", selected.total],
              ["Ödenen tutar", selected.paid],
              ["Kalan tutar", selected.remaining],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-sm font-bold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3.5" open>
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
            Sipariş Kalemleri
          </summary>
          <div className="mt-3 space-y-2.5">
            {selectedItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="text-xs text-slate-400">Adet {item.qty}</p>
                </div>
                <p className="text-sm font-bold text-slate-600">{item.amount}</p>
              </div>
            ))}
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3.5" open>
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-950">
            Ödeme Zaman Çizelgesi
          </summary>
          <div className="mt-3 space-y-3">
            {timeline.map((event) => (
              <div key={`${event.time}-${event.title}`} className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#10b981]" />
                <div>
                  <p className="text-xs text-slate-400">{event.time}</p>
                  <p className="text-sm font-semibold text-slate-950">{event.title}</p>
                  <p className="text-xs text-slate-500">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </details>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-sm font-bold text-amber-700">Fiş talebi durumu</p>
          <p className="mt-1 text-xs text-slate-500">{receiptLabel(selected.receiptStatus)}</p>
        </div>

        {confirmation && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700">
            {confirmation}
          </div>
        )}

        <div className="grid gap-3">
          <button
            type="button"
            onClick={onMarkReceiptPrinted}
            disabled={receiptPrinted}
            className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              receiptPrinted
                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                : "bg-[#10b981] text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700"
            }`}
          >
            Fiş Yazdırıldı Olarak İşaretle
          </button>
          <button
            type="button"
            onClick={onCloseTable}
            disabled={closeDisabled}
            className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              closeDisabled
                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500"
                : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            }`}
          >
            Masayı Kapat
          </button>
          <button
            type="button"
            onClick={onViewPaymentDetails}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Ödeme Detaylarını Gör
          </button>
        </div>
      </div>
    </aside>
  );
}

function LiveNotifications({ notifications }: { notifications: Notification[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Canlı Bildirimler</h2>
          <p className="text-sm text-slate-500">Son operasyonel ödeme olayları.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Canlı Akış
        </span>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
        {notifications.map((notification) => (
          <article
            key={`${notification.title}-${notification.time}`}
            className={`rounded-2xl bg-white p-3.5 shadow-sm ${toneClasses[notification.tone]}`}
          >
            <p className="mb-1 text-sm font-bold text-slate-950">{notification.title}</p>
            <p className="mb-3 text-xs leading-relaxed text-slate-600">{notification.description}</p>
            <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {notification.time}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ activities }: { activities: Activity[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-xl font-bold text-slate-950">Son Ödeme Hareketleri</h2>
        <p className="text-sm text-slate-500">Son ödemeler, fiş talepleri ve masa kapatma işlemleri.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-bold">Saat</th>
              <th className="px-5 py-4 font-bold">Masa</th>
              <th className="px-5 py-4 font-bold">Tutar</th>
              <th className="px-5 py-4 font-bold">Durum</th>
              <th className="px-5 py-4 font-bold">Fiş</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <tr key={activity.id} className="text-slate-600">
                <td className="px-5 py-3.5">{activity.time}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-950">{activity.table}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-950">{activity.amount}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusClasses[activity.status]}`}>
                    {paymentStatusLabels[activity.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5">{activity.receipt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentDetailsModal({
  table,
  onClose,
}: {
  table: RestaurantTable;
  onClose: () => void;
}) {
  const details = [
    ["Ödeme yöntemi", table.status === "empty" ? "Ödeme yok" : "QR kart ödemesi"],
    ["İşlem ID", `WXP-${table.id.toUpperCase()}-20260517`],
    ["Ödenen tutar", table.paid],
    ["Kalan tutar", table.remaining],
    ["Fiş durumu", receiptLabel(table.receiptStatus)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#10b981]">
              Ödeme Detayları
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{table.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-950"
          >
            Kapat
          </button>
        </div>

        <div className="space-y-3">
          {details.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-right text-sm font-bold text-slate-950">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WexPayTableManagerPage() {
  const [currentTables, setCurrentTables] = useState<RestaurantTable[]>(initialTables);
  const [liveNotifications, setLiveNotifications] =
    useState<Notification[]>(initialNotifications);
  const [recentActivities, setRecentActivities] = useState<Activity[]>(initialActivities);
  const [selectedTableId, setSelectedTableId] = useState("t08");
  const [selectedFilter, setSelectedFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);

  const selectedTable =
    currentTables.find((table) => table.id === selectedTableId) ?? currentTables[0];

  const filteredTables = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return currentTables.filter((table) => {
      const statusLabel = statusConfig[table.status].label.toLowerCase();
      const receipt = receiptLabel(table.receiptStatus).toLowerCase();
      const searchableText = `${table.label} ${table.status} ${statusLabel} ${receipt}`.toLowerCase();

      return matchesFilter(table, selectedFilter) && searchableText.includes(normalizedSearch);
    });
  }, [currentTables, search, selectedFilter]);

  const kpis = useMemo(() => buildKpis(currentTables), [currentTables]);

  function updateSelectedTable(updater: (table: RestaurantTable) => RestaurantTable) {
    setCurrentTables((previousTables) =>
      previousTables.map((table) => (table.id === selectedTableId ? updater(table) : table)),
    );
  }

  function addNotification(notification: Omit<Notification, "id" | "time">) {
    setLiveNotifications((previousNotifications) => [
      {
        ...notification,
        id: `${Date.now()}-${notification.type}`,
        time: "Şimdi",
      },
      ...previousNotifications,
    ]);
  }

  function upsertReceiptActivity(table: RestaurantTable) {
    setRecentActivities((previousActivities) => {
      const matchingActivity = previousActivities.find((activity) => activity.table === table.label);

      if (matchingActivity) {
        return previousActivities.map((activity) =>
          activity.table === table.label ? { ...activity, receipt: "Yazdırıldı" } : activity,
        );
      }

      return [
        {
          id: `${Date.now()}-receipt-${table.id}`,
          time: currentTime(),
          table: table.label,
          amount: table.total,
          status: table.status === "partially_paid" ? "Partial" : "Paid",
          receipt: "Yazdırıldı",
        },
        ...previousActivities,
      ];
    });
  }

  function handleSelectTable(tableId: string) {
    setSelectedTableId(tableId);
    setConfirmation(null);
    setPaymentDetailsOpen(false);
  }

  function handleMarkReceiptPrinted() {
    if (selectedTable.receiptStatus !== "requested") {
      setConfirmation("Bu masa için bekleyen fiş talebi yok.");
      return;
    }

    updateSelectedTable((table) => ({
      ...table,
      receiptStatus: "printed",
      status: table.status === "receipt_requested" ? "paid" : table.status,
    }));
    addNotification({
      title: "Fiş yazdırıldı",
      description: `${selectedTable.label} için fiş yazdırıldı olarak işaretlendi.`,
      type: "receipt",
      tone: "amber",
    });
    upsertReceiptActivity(selectedTable);
    setConfirmation("Fiş yazdırıldı olarak işaretlendi.");
  }

  function handleCloseTable() {
    if (selectedTable.isClosed || (selectedTable.status === "paid" && selectedTable.remaining === "0 TL")) {
      setConfirmation("Bu masa zaten kapatılmış.");
      return;
    }

    updateSelectedTable((table) => ({
      ...table,
      status: "paid",
      paid: table.total,
      remaining: "0 TL",
      isClosed: true,
    }));
    addNotification({
      title: "Masa kapatıldı",
      description: `${selectedTable.label} kasiyer tarafından kapatıldı.`,
      type: "closed",
      tone: "slate",
    });
    setRecentActivities((previousActivities) => [
      {
        id: `${Date.now()}-closed-${selectedTable.id}`,
        time: currentTime(),
        table: selectedTable.label,
        amount: selectedTable.total,
        status: "Closed",
        receipt: selectedTable.receiptStatus === "printed" ? "Yazdırıldı" : "Yok",
      },
      ...previousActivities,
    ]);
    setConfirmation("Masa kapatıldı ve kalan tutar 0 olarak güncellendi.");
  }

  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-950">
      <AppBar
        search={search}
        selectedFilter={selectedFilter}
        onSearchChange={setSearch}
        onFilterChange={setSelectedFilter}
      />
      <main className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 2xl:px-10">
        <KpiCards kpis={kpis} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <TableGrid
            tables={filteredTables}
            selectedTableId={selectedTableId}
            onSelectTable={handleSelectTable}
          />
          <SelectedTablePanel
            selected={selectedTable}
            confirmation={confirmation}
            onMarkReceiptPrinted={handleMarkReceiptPrinted}
            onCloseTable={handleCloseTable}
            onViewPaymentDetails={() => setPaymentDetailsOpen(true)}
          />
        </div>

        <LiveNotifications notifications={liveNotifications} />
        <RecentActivity activities={recentActivities} />
      </main>

      {paymentDetailsOpen && (
        <PaymentDetailsModal table={selectedTable} onClose={() => setPaymentDetailsOpen(false)} />
      )}
    </div>
  );
}
