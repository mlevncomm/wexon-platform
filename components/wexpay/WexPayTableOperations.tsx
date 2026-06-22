"use client";

import { useMemo, useState } from "react";
import { closeTableAction, markReceiptPrintedAction, updateOrderStatusAction } from "@/lib/wexpay-actions";
import type { OperationsTable } from "@/lib/wexpay-read";
import { formatWexPayPaymentProvider, isPaytrPendingPayment } from "@/lib/wexpay-payment-display";
import { WexPayPaytrPendingNotice } from "@/components/wexpay/WexPayPaytrCheckoutNotice";
import { WexPayPaytrPendingActions } from "@/components/wexpay/WexPayPaytrPendingActions";
import { WexPayTablePaymentForm } from "@/components/wexpay/WexPayTablePaymentForm";
import {
  DemoPrimaryButton,
  formatLira,
  InfoRow,
  OrderStatusBadge,
  orderStatusLabels,
  PaymentStatusBadge,
  TableStatusBadge,
  WexPayDarkPanelHeaderBackdrop,
  wexpayPanelShellClassName,
} from "@/components/wexpay/WexPayBusinessUI";

const ORDER_STATUS_OPTIONS = ["NEW", "PREPARING", "SERVED", "CANCELLED"];

const TABLE_FILTER_LABELS: Record<string, string> = {
  ALL: "Tümü",
  EMPTY: "Boş",
  OCCUPIED: "Dolu",
  PAYMENT_PENDING: "Ödeme Bekliyor",
  PARTIALLY_PAID: "Kısmi Ödendi",
  PAID: "Ödendi",
  RECEIPT_REQUESTED: "Fiş Talep Edildi",
};

const TABLE_FILTERS = ["ALL", "EMPTY", "OCCUPIED", "PAYMENT_PENDING", "PARTIALLY_PAID", "PAID", "RECEIPT_REQUESTED"];

export function WexPayTableOperationsView({
  tables,
  canManage,
  activeBranchId,
  redirectTo,
  showFilters = true,
  showSearch = true,
  showRefresh = false,
  title = "Masalar",
  description = "Masa hesaplarını, siparişleri ve ödeme durumlarını takip edin.",
  headerAction,
}: {
  tables: OperationsTable[];
  canManage: boolean;
  activeBranchId: string;
  redirectTo: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showRefresh?: boolean;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
}) {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id ?? "");
  const [tableFilter, setTableFilter] = useState("ALL");
  const [tableSearch, setTableSearch] = useState("");

  const filteredTables = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    return tables.filter((table) => {
      const matchesFilter = tableFilter === "ALL" || table.status === tableFilter;
      const matchesSearch =
        !search ||
        table.label.toLowerCase().includes(search) ||
        table.qrCode.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [tables, tableFilter, tableSearch]);

  const selectedTable = useMemo(() => {
    return (
      filteredTables.find((table) => table.id === selectedTableId) ??
      filteredTables[0] ??
      tables.find((table) => table.id === selectedTableId) ??
      tables[0] ??
      null
    );
  }, [filteredTables, selectedTableId, tables]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Operasyon</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">{description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {showRefresh && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  Masaları Yenile
                </button>
              )}
              {headerAction}
            </div>
          </div>
        </div>

        {(showSearch || showFilters) && (
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
            <div className="grid min-w-0 gap-3">
              {showSearch && (
                <input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Masa adı veya kod ara"
                  className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-900/5 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100/80"
                />
              )}
              {showFilters && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  {TABLE_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTableFilter(filter)}
                      className={`min-w-0 rounded-full border px-3.5 py-2 text-xs font-black transition-all ${
                        tableFilter === filter
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                          : "border-slate-200/80 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-emerald-200 hover:text-emerald-800"
                      }`}
                    >
                      {TABLE_FILTER_LABELS[filter]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5">
        {tables.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm font-semibold text-slate-500">
            Gösterilecek masa bulunmuyor.
          </p>
        ) : filteredTables.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm font-semibold text-slate-500">
            Filtreye uygun masa bulunmuyor.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                selected={table.id === selectedTable?.id}
                onSelect={() => setSelectedTableId(table.id)}
              />
            ))}
          </div>
        )}
        </div>
      </section>

      {selectedTable ? (
        <TableDetailPanel
          table={selectedTable}
          canManage={canManage}
          activeBranchId={activeBranchId}
          redirectTo={redirectTo}
        />
      ) : (
        <aside className={`${wexpayPanelShellClassName} p-5 text-sm font-semibold text-slate-500`}>
          Masa detayı için bir masa seçin.
        </aside>
      )}

      <BranchOrderHistoryPanel tables={tables} />
    </div>
  );
}

function TableCard({
  table,
  selected,
  onSelect,
}: {
  table: OperationsTable;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-[16px] border p-4 text-left shadow-sm transition-all ${
        selected
          ? "border-emerald-300 bg-emerald-50 shadow-emerald-900/10"
          : "border-slate-200 bg-white shadow-slate-900/5 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-slate-50/80 hover:shadow-md hover:shadow-slate-900/8"
      }`}
    >
      <span
        className={`absolute inset-y-4 left-0 w-1 rounded-r-full transition-colors ${
          selected ? "bg-emerald-500" : "bg-transparent group-hover:bg-emerald-200"
        }`}
        aria-hidden
      />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-slate-950">{table.label}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{table.seats} kişilik · {table.qrCode}</p>
        </div>
        <span className="shrink-0"><TableStatusBadge status={table.status} /></span>
      </div>
      <div className="grid gap-2">
        <InfoRow label="Toplam tutar" value={formatLira(table.totalAmount)} />
        <InfoRow label="Ödenen tutar" value={formatLira(table.paidAmount)} />
        <InfoRow label="Kalan tutar" value={formatLira(table.remainingAmount)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
        <span className="rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-slate-200">Aktif sipariş: {table.activeOrders.length}</span>
        <span className={`rounded-full px-2.5 py-1 ring-1 ${table.receiptRequested ? "bg-amber-50 text-amber-800 ring-amber-100" : "bg-white/80 text-slate-500 ring-slate-200"}`}>
          Fiş talebi: {table.receiptRequested ? "Var" : "Yok"}
        </span>
      </div>
    </button>
  );
}

function TableDetailPanel({
  table,
  canManage,
  activeBranchId,
  redirectTo,
}: {
  table: OperationsTable;
  canManage: boolean;
  activeBranchId: string;
  redirectTo: string;
}) {
  const [copiedQrCode, setCopiedQrCode] = useState<string | null>(null);
  const publicQrPath = `/wexpay/t/${encodeURIComponent(table.qrCode)}`;
  const hasRemainingAmount = table.remainingAmount > 0;
  const hasOpenOrders = table.activeOrders.some((order) => order.status === "NEW" || order.status === "PREPARING");
  const canCloseTable = !hasRemainingAmount && !hasOpenOrders && table.status !== "EMPTY";
  const paidPaymentTotal = table.payments
    .filter((payment) => payment.status === "PAID" || payment.status === "PARTIAL")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPaytrPayments = table.payments.filter((payment) =>
    isPaytrPendingPayment(payment.provider, payment.status),
  );
  const collectionProgress =
    table.totalAmount > 0
      ? Math.min(100, Math.round((table.paidAmount / table.totalAmount) * 100))
      : table.paidAmount > 0
        ? 100
        : 0;

  async function copyPublicQrLink() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard.writeText(`${origin}${publicQrPath}`);
    setCopiedQrCode(table.qrCode);
    window.setTimeout(() => setCopiedQrCode(null), 1800);
  }

  return (
    <aside className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]">
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
        <WexPayDarkPanelHeaderBackdrop />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Masa detayı</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">{table.label}</h2>
              <TableStatusBadge status={table.status} />
            </div>
            <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{table.qrCode}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={copyPublicQrLink}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              {copiedQrCode === table.qrCode ? "Kopyalandı" : "QR kopyala"}
            </button>
            <a
              href={publicQrPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400"
            >
              Müşteri ekranı
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 bg-slate-50/60 p-4 sm:grid-cols-4 sm:p-5">
        {[
          { label: "Toplam", value: formatLira(table.totalAmount) },
          { label: "Ödenen", value: formatLira(table.paidAmount) },
          { label: "Kalan", value: formatLira(table.remainingAmount), accent: table.remainingAmount > 0 },
          { label: "Fiş", value: table.receiptRequested ? "Talep var" : "Yok", accent: table.receiptRequested },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-colors sm:p-4 ${
              stat.label === "Fiş" && stat.accent
                ? "border-amber-200/80 shadow-amber-900/5"
                : stat.label === "Kalan" && stat.accent
                  ? "border-emerald-200/80 shadow-emerald-900/5"
                  : "border-slate-200/70 shadow-slate-900/5"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${stat.accent ? "text-amber-700" : "text-slate-400"}`}>
              {stat.label}
            </p>
            <p
              className={`mt-1.5 text-base font-black tracking-tight sm:text-lg ${
                stat.label === "Fiş" && stat.accent
                  ? "text-amber-800"
                  : stat.label === "Kalan" && stat.accent
                    ? "text-emerald-600"
                    : "text-slate-950"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {pendingPaytrPayments.length > 0 ? (
        <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-4 sm:px-6">
          <WexPayPaytrPendingNotice
            providerRef={pendingPaytrPayments[0]?.providerRef}
            actions={
              canManage && pendingPaytrPayments[0] ? (
                <WexPayPaytrPendingActions paymentId={pendingPaytrPayments[0].id} redirectTo={redirectTo} />
              ) : null
            }
          />
        </div>
      ) : null}

      {table.receiptRequested ? (
        <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-amber-900">Açık fiş talebi</p>
              <p className="mt-1 text-xs font-medium text-amber-800/80">
                Fiş yazdırıldıktan sonra masayı işaretleyin; masa durumu otomatik güncellenir.
              </p>
            </div>
            {canManage ? (
              <form action={markReceiptPrintedAction} className="shrink-0">
                <input type="hidden" name="tableId" value={table.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <DemoPrimaryButton className="!w-auto px-5 !py-2.5 text-xs">Fiş Yazdırıldı</DemoPrimaryButton>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-950">Aktif siparişler</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
              {table.activeOrders.length} kayıt
            </span>
          </div>
          {table.activeOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-400">Yeni veya hazırlanan sipariş yok</p>
              <p className="mt-1 text-xs font-medium text-slate-400">Servis edilen siparişler tahsilat özetinde görünür.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {table.activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5 transition-all hover:border-emerald-200/80 hover:shadow-md hover:shadow-emerald-900/5"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{order.orderNo}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-400">
                        {orderStatusLabels[order.status] ?? order.status}
                      </p>
                    </div>
                    <p className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-900">
                      {formatLira(order.subtotal)}
                    </p>
                  </div>
                  <ul className="mb-3 space-y-1.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-medium text-slate-500">
                          <span className="font-bold text-slate-700">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="shrink-0 font-bold text-slate-700">{formatLira(item.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  {canManage && (
                    <form action={updateOrderStatusAction} className="flex gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <select
                        name="status"
                        defaultValue={order.status}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                      >
                        {ORDER_STATUS_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {orderStatusLabels[value]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
                      >
                        Kaydet
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Tahsilat özeti</p>
              <PaymentStatusBadge status={hasRemainingAmount ? "PENDING" : "PAID"} />
            </div>

            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-slate-500">
                {hasRemainingAmount ? "Kalan tutar" : "Adisyon kapandı"}
              </p>
              <p
                className={`mt-1.5 text-3xl font-black tracking-tight ${
                  hasRemainingAmount ? "text-emerald-600" : "text-slate-950"
                }`}
              >
                {formatLira(table.remainingAmount)}
              </p>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                  <span>Tahsilat ilerlemesi</span>
                  <span className="text-emerald-700">{collectionProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${collectionProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
              <div className="px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Toplam</p>
                <p className="mt-1 text-base font-black tracking-tight text-slate-950">{formatLira(table.totalAmount)}</p>
              </div>
              <div className="bg-emerald-50/40 px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700/70">Tahsil edilen</p>
                <p className="mt-1 text-base font-black tracking-tight text-emerald-800">{formatLira(paidPaymentTotal)}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">Güncel ödemeler</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                {table.payments.length}
              </span>
            </div>
            {table.payments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/90 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-400">Henüz ödeme alınmadı</p>
              </div>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {table.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm shadow-slate-900/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {formatWexPayPaymentProvider(payment.provider)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <PaymentStatusBadge status={payment.status} />
                        <span className="text-[10px] font-semibold text-slate-400">
                          {new Date(payment.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {isPaytrPendingPayment(payment.provider, payment.status) && payment.providerRef ? (
                        <p className="mt-1 truncate font-mono text-[10px] font-semibold text-slate-500">
                          merchant_oid: {payment.providerRef}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-950">{formatLira(payment.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <div className="mt-auto space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/5">
              {hasRemainingAmount ? (
                <WexPayTablePaymentForm
                  branchId={activeBranchId}
                  tableId={table.id}
                  remainingAmount={table.remainingAmount}
                  redirectTo={redirectTo}
                />
              ) : (
                <div className="rounded-xl bg-emerald-50 px-3 py-3 text-center ring-1 ring-emerald-100">
                  <p className="text-xs font-black text-emerald-700">Tahsilat tamamlandı</p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-600/80">Masayı kapatarak yeni oturum başlatabilirsiniz.</p>
                </div>
              )}

              {canCloseTable ? (
                <form action={closeTableAction}>
                  <input type="hidden" name="tableId" value={table.id} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <DemoPrimaryButton className="w-full !py-2.5 text-xs shadow-md shadow-emerald-500/20">
                    Masayı Kapat ve Sıfırla
                  </DemoPrimaryButton>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <p className="text-[11px] font-semibold text-slate-500">
                    {hasOpenOrders
                      ? "Aktif siparişler tamamlanmadan masa kapatılamaz."
                      : hasRemainingAmount
                        ? "Kalan ödeme alınmadan masa kapatılamaz."
                        : "Masa zaten boş durumda."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

const ISTANBUL_TIMEZONE = "Europe/Istanbul";

function getStartOfTodayInIstanbul() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISTANBUL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Date(`${today}T00:00:00+03:00`);
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatOrderTime(value: string) {
  return new Date(value).toLocaleTimeString("tr-TR", {
    timeZone: ISTANBUL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOrderFromToday(value: string) {
  return new Date(value) >= getStartOfTodayInIstanbul();
}

type BranchHistoryOrder = OperationsTable["orderHistory"][number] & {
  tableId: string;
  tableLabel: string;
};

function BranchOrderHistoryPanel({ tables }: { tables: OperationsTable[] }) {
  const [historyTableFilter, setHistoryTableFilter] = useState("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const todayLabel = formatTodayLabel();

  const branchOrders = useMemo<BranchHistoryOrder[]>(() => {
    return tables
      .flatMap((table) =>
        table.orderHistory.map((order) => ({
          ...order,
          tableId: table.id,
          tableLabel: table.label,
        })),
      )
      .filter((order) => isOrderFromToday(order.createdAt))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [tables]);

  const filteredBranchOrders = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return branchOrders.filter((order) => {
      const matchesTable = historyTableFilter === "ALL" || order.tableId === historyTableFilter;
      const matchesSearch =
        !search ||
        order.orderNo.toLowerCase().includes(search) ||
        order.tableLabel.toLowerCase().includes(search) ||
        order.items.some((item) => item.name.toLowerCase().includes(search));
      return matchesTable && matchesSearch;
    });
  }, [branchOrders, historySearch, historyTableFilter]);

  const historyStats = useMemo(() => {
    const chargeableOrders = branchOrders.filter((order) => order.status !== "CANCELLED");
    const activeTableCount = new Set(branchOrders.map((order) => order.tableId)).size;
    return {
      tableCount: tables.length,
      activeTableCount,
      totalOrders: branchOrders.length,
      totalAmount: chargeableOrders.reduce((sum, order) => sum + order.subtotal, 0),
      servedCount: branchOrders.filter((order) => order.status === "SERVED").length,
      cancelledCount: branchOrders.filter((order) => order.status === "CANCELLED").length,
    };
  }, [branchOrders, tables.length]);

  return (
    <aside className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.03]">
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
        <WexPayDarkPanelHeaderBackdrop />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Günlük sipariş defteri</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Bugünün kayıtları</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
              Tüm masaların bugünkü siparişleri burada listelenir. Kayıtlar her gece 00:00&apos;da otomatik sıfırlanır.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold capitalize text-white backdrop-blur-sm">
              {todayLabel}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm">
              İstanbul saati
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-slate-200/80">
            {[
              { label: "Bugünkü sipariş", value: String(historyStats.totalOrders) },
              { label: "Bugünkü ciro", value: formatLira(historyStats.totalAmount) },
              { label: "Aktif masa", value: String(historyStats.activeTableCount) },
              { label: "Servis / İptal", value: `${historyStats.servedCount} / ${historyStats.cancelledCount}` },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 px-0 sm:px-5 sm:first:pl-0 sm:last:pr-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
                <p className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm shadow-slate-900/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Kapsam</p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {historyStats.tableCount} masa · {filteredBranchOrders.length} görünen kayıt
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
        <input
          value={historySearch}
          onChange={(event) => setHistorySearch(event.target.value)}
          placeholder="Sipariş no, masa veya ürün ara"
          className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-900/5 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
        />

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={() => setHistoryTableFilter("ALL")}
              className={`rounded-full border px-4 py-2 text-xs font-black transition-all ${
                historyTableFilter === "ALL"
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                  : "border-slate-200/80 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-emerald-200 hover:text-emerald-800"
              }`}
            >
              Tüm masalar
            </button>
            {tables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => setHistoryTableFilter(table.id)}
                className={`rounded-full border px-4 py-2 text-xs font-black transition-all ${
                  historyTableFilter === table.id
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                    : "border-slate-200/80 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-emerald-200 hover:text-emerald-800"
                }`}
              >
                {table.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-5">
        {filteredBranchOrders.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/5">
            <p className="text-lg font-black text-slate-700">
              {branchOrders.length === 0 ? "Bugün henüz sipariş yok" : "Filtreye uygun kayıt bulunamadı"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-400">
              {branchOrders.length === 0
                ? "Yeni siparişler geldikçe günlük defter burada birikecek. Yarın 00:00'da liste otomatik temizlenir."
                : "Arama veya masa filtresini değiştirerek tekrar deneyin."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBranchOrders.map((order) => (
              <div key={order.id} className="group relative flex gap-3 sm:gap-5">
                <div className="hidden w-14 shrink-0 flex-col items-end pt-5 sm:flex">
                  <span className="text-sm font-black text-slate-700">{formatOrderTime(order.createdAt)}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Saat</span>
                </div>

                <div className="relative hidden w-4 shrink-0 sm:block">
                  <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-gradient-to-b from-emerald-300 via-slate-200 to-transparent" />
                  <span className="absolute left-1/2 top-5 h-3 w-3 -translate-x-1/2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 transition-transform group-hover:scale-110" />
                </div>

                <article className="relative min-w-0 flex-1 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-emerald-200/80 group-hover:shadow-md group-hover:shadow-emerald-900/5">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                          {order.tableLabel}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 sm:hidden">
                          {formatOrderTime(order.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 truncate text-base font-black text-slate-950">{order.orderNo}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {order.items.length} kalem · {orderStatusLabels[order.status] ?? order.status}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700/70">Tutar</p>
                      <p className="mt-1 text-xl font-black tracking-tight text-emerald-800">{formatLira(order.subtotal)}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5"
                      >
                        <span className="min-w-0 truncate text-xs font-medium text-slate-600">
                          <span className="font-black text-slate-800">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="shrink-0 text-xs font-black text-slate-800">{formatLira(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  {order.note ? (
                    <p className="border-t border-slate-100 px-4 py-3 text-xs font-medium text-slate-500 sm:px-5">
                      Not: {order.note}
                    </p>
                  ) : null}
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
