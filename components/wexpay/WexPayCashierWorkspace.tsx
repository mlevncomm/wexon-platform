"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { closeTableAction, markReceiptPrintedAction, updateOrderStatusAction } from "@/lib/wexpay-actions";
import type { OperationsNotification, OperationsTable } from "@/lib/wexpay-read";
import { isPaytrPendingPayment } from "@/lib/wexpay-payment-display";
import { WexPayPaytrPendingNotice } from "@/components/wexpay/WexPayPaytrCheckoutNotice";
import { WexPayPaytrPendingActions } from "@/components/wexpay/WexPayPaytrPendingActions";
import { WexPayTablePaymentForm } from "@/components/wexpay/WexPayTablePaymentForm";
import WexPayOrderComposer from "@/components/wexpay/WexPayOrderComposer";
import WexPayDetailDrawer from "@/components/wexpay/WexPayDetailDrawer";
import WexPayTableQrDialog from "@/components/wexpay/WexPayTableQrDialog";
import {
  DemoPrimaryButton,
  formatLira,
  OrderStatusBadge,
  orderStatusLabels,
  TableStatusBadge,
  WexPayDarkPanelHeaderBackdrop,
  WexPayFilterBar,
} from "@/components/wexpay/WexPayBusinessUI";

type ProductOption = { id: string; name: string; price: number; categoryName: string };

export type CashierTable = OperationsTable & {
  publicQrUrl: string;
};

const STATUS_FILTERS = [
  { id: "ALL", label: "Tümü" },
  { id: "EMPTY", label: "Boş" },
  { id: "OCCUPIED", label: "Dolu" },
  { id: "PAYMENT_PENDING", label: "Ödeme bekliyor" },
  { id: "RECEIPT_REQUESTED", label: "Fiş talebi" },
  { id: "WAITER", label: "Garson çağrısı" },
  { id: "PAY_ASK", label: "Ödeme isteği" },
] as const;

function notificationMatchesTable(notification: OperationsNotification, tableLabel: string, kind: "waiter" | "pay") {
  const prefix = kind === "waiter" ? "[GARSON ÇAĞRISI]" : "[ÖDEME TALEBİ]";
  return notification.title.includes(prefix) && notification.title.includes(tableLabel);
}

function elapsedLabel(iso: string) {
  const mins = Math.max(0, Math.floor((new Date().getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)} sa`;
}

export function WexPayCashierWorkspace({
  tables,
  canManage,
  activeBranchId,
  activeBranchName,
  redirectTo,
  products,
  notifications,
}: {
  tables: CashierTable[];
  canManage: boolean;
  activeBranchId: string;
  activeBranchName?: string;
  redirectTo: string;
  products: ProductOption[];
  notifications: OperationsNotification[];
}) {
  const searchParams = useSearchParams();
  const initialTableId = searchParams.get("tableId") ?? "";
  const openComposerFromUrl = searchParams.get("composer") === "1";

  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    () => initialTableId || (openComposerFromUrl ? tables[0]?.id ?? null : null),
  );
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(initialTableId) || openComposerFromUrl);
  const [tableFilter, setTableFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("ALL");
  const [tableSearch, setTableSearch] = useState("");
  const [showComposer, setShowComposer] = useState(() => openComposerFromUrl);
  const [confirmClose, setConfirmClose] = useState(false);
  const [qrTableId, setQrTableId] = useState<string | null>(null);

  const filteredTables = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    return tables.filter((table) => {
      const hasWaiter = notifications.some((n) => notificationMatchesTable(n, table.label, "waiter"));
      const hasPayAsk = notifications.some((n) => notificationMatchesTable(n, table.label, "pay"));
      let matchesFilter = true;
      if (tableFilter === "WAITER") matchesFilter = hasWaiter;
      else if (tableFilter === "PAY_ASK") matchesFilter = hasPayAsk;
      else if (tableFilter !== "ALL") matchesFilter = table.status === tableFilter;
      const matchesSearch =
        !search || table.label.toLowerCase().includes(search) || table.qrCode.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [tables, tableFilter, tableSearch, notifications]);

  const selectedTable =
    tables.find((table) => table.id === selectedTableId) ??
    filteredTables[0] ??
    tables[0] ??
    null;

  function openTable(tableId: string, composer = false) {
    setSelectedTableId(tableId);
    setShowComposer(composer);
    setConfirmClose(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setConfirmClose(false);
  }

  const qrTable = tables.find((table) => table.id === qrTableId) ?? null;

  function openQr(tableId: string) {
    setQrTableId(tableId);
  }

  function closeQr() {
    setQrTableId(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="min-w-0 overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)]">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-6 sm:px-6">
          <WexPayDarkPanelHeaderBackdrop />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/90">Kasa workspace</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Masalar</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">
                Masa seçin · adisyon · yeni sipariş · tahsilat · kapatma. Ödeme isteği tahsilat değildir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              Yenile
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
          <WexPayFilterBar className="!flex !flex-col !gap-3">
            <input
              data-wexpay-search
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Masa ara…"
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setTableFilter(filter.id)}
                  className={`min-h-11 rounded-full border px-3.5 py-2 text-xs font-black ${
                    tableFilter === filter.id
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </WexPayFilterBar>
        </div>

        <div className="p-4 sm:p-5">
          {filteredTables.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Gösterilecek masa yok.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredTables.map((table) => {
                const hasWaiter = notifications.some((n) => notificationMatchesTable(n, table.label, "waiter"));
                const hasPayAsk = notifications.some((n) => notificationMatchesTable(n, table.label, "pay"));
                const preparing = table.activeOrders.filter((o) => o.status === "PREPARING").length;
                const neu = table.activeOrders.filter((o) => o.status === "NEW").length;
                return (
                  <article
                    key={table.id}
                    data-testid="cashier-table-card"
                    data-table-label={table.label}
                    className={`flex min-h-[9rem] flex-col overflow-hidden rounded-2xl border shadow-sm transition ${
                      selectedTable?.id === table.id && drawerOpen
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openTable(table.id, table.status === "EMPTY")}
                      className="min-w-0 flex-1 p-4 text-left hover:bg-emerald-50/40"
                      aria-label={`${table.label} detayını aç`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950">{table.label}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{table.seats} kişilik</p>
                        </div>
                        <TableStatusBadge status={table.status} />
                      </div>
                      <p className="mt-3 text-lg font-black text-slate-950">{formatLira(table.remainingAmount)}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Kalan · toplam {formatLira(table.totalAmount)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                          Sipariş {table.activeOrders.length}
                        </span>
                        {neu > 0 ? (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800">Yeni {neu}</span>
                        ) : null}
                        {preparing > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                            Hazırlanıyor {preparing}
                          </span>
                        ) : null}
                        {hasWaiter ? (
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-900">
                            Garson çağrısı
                          </span>
                        ) : null}
                        {hasPayAsk ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-950">
                            Müşteri ödeme istedi
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="border-t border-slate-100 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openQr(table.id)}
                        data-testid="cashier-table-qr-button"
                        aria-label={`${table.label} QR kodunu al`}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        QR kodu al
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <WexPayDetailDrawer
        open={drawerOpen && Boolean(selectedTable)}
        title={selectedTable?.label ?? "Masa"}
        subtitle={selectedTable ? `Durum: ${selectedTable.status}` : undefined}
        onClose={closeDrawer}
        headerActions={
          selectedTable ? (
            <button
              type="button"
              onClick={() => openQr(selectedTable.id)}
              data-testid="drawer-table-qr-button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-800 hover:border-emerald-300 hover:bg-emerald-50"
            >
              QR kodu al
            </button>
          ) : null
        }
        footer={
          selectedTable && canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="min-h-11 flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700"
              >
                {selectedTable.status === "EMPTY"
                  ? "Masayı aç ve ilk siparişi oluştur"
                  : "Masaya yeni sipariş ekle"}
              </button>
            </div>
          ) : null
        }
      >
        {selectedTable ? (
          <CashierTableBody
            table={selectedTable}
            canManage={canManage}
            activeBranchId={activeBranchId}
            redirectTo={redirectTo}
            products={products}
            notifications={notifications}
            showComposer={showComposer}
            setShowComposer={setShowComposer}
            confirmClose={confirmClose}
            setConfirmClose={setConfirmClose}
          />
        ) : null}
      </WexPayDetailDrawer>

      {qrTable ? (
        <WexPayTableQrDialog
          key={qrTable.id}
          open
          onClose={closeQr}
          tableLabel={qrTable.label}
          branchName={activeBranchName}
          publicQrUrl={qrTable.publicQrUrl}
        />
      ) : null}
    </div>
  );
}

function CashierTableBody({
  table,
  canManage,
  activeBranchId,
  redirectTo,
  products,
  notifications,
  showComposer,
  setShowComposer,
  confirmClose,
  setConfirmClose,
}: {
  table: OperationsTable;
  canManage: boolean;
  activeBranchId: string;
  redirectTo: string;
  products: ProductOption[];
  notifications: OperationsNotification[];
  showComposer: boolean;
  setShowComposer: (value: boolean) => void;
  confirmClose: boolean;
  setConfirmClose: (value: boolean) => void;
}) {
  const hasRemainingAmount = table.remainingAmount > 0;
  const hasOpenOrders = table.activeOrders.some((order) => order.status === "NEW" || order.status === "PREPARING");
  const canCloseTable = !hasRemainingAmount && !hasOpenOrders && table.status !== "EMPTY";
  const pendingPaytr = table.payments.filter((payment) => isPaytrPendingPayment(payment.provider, payment.status));
  const waiterAlerts = notifications.filter((n) => notificationMatchesTable(n, table.label, "waiter"));
  const payAskAlerts = notifications.filter((n) => notificationMatchesTable(n, table.label, "pay"));
  const isEmpty = table.status === "EMPTY" && table.billOrders.length === 0 && table.activeOrders.length === 0;
  const billOrders = table.billOrders.length > 0 ? table.billOrders : table.activeOrders;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3" data-testid="cashier-table-account">
        <SummaryStat label="Toplam" value={formatLira(table.totalAmount)} />
        <SummaryStat label="Ödenen" value={formatLira(table.paidAmount)} />
        <SummaryStat label="Kalan" value={formatLira(table.remainingAmount)} accent={table.remainingAmount > 0} />
        <SummaryStat label="Sipariş dalgası" value={String(billOrders.length)} />
      </section>

      {waiterAlerts.length > 0 ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-800">Garson çağrıları</p>
          <p className="mt-2 text-sm font-bold text-sky-950">Yeni çağrı · {waiterAlerts[0]?.message}</p>
          <p className="mt-1 text-xs font-semibold text-sky-800">Durum ataması desteklenmiyor (yalnızca bildirim).</p>
        </section>
      ) : null}

      {payAskAlerts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">Müşteri ödeme istedi</p>
          <p className="mt-2 text-sm font-bold text-amber-950">Bu bir tahsilat kaydı değildir.</p>
          <p className="mt-1 text-xs font-semibold text-amber-800">{payAskAlerts[0]?.message}</p>
          <p className="mt-2 text-xs font-semibold text-amber-900">
            Gerçek tahsilat için aşağıdaki “Tahsilat” bölümünü kullanın.
          </p>
        </section>
      ) : null}

      {pendingPaytr.length > 0 ? (
        <WexPayPaytrPendingNotice
          providerRef={pendingPaytr[0]?.providerRef}
          actions={
            canManage && pendingPaytr[0] ? (
              <WexPayPaytrPendingActions paymentId={pendingPaytr[0].id} redirectTo={redirectTo} />
            ) : null
          }
        />
      ) : null}

      {table.receiptRequested && canManage ? (
        <form action={markReceiptPrintedAction} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <input type="hidden" name="tableId" value={table.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <p className="text-sm font-black text-amber-950">Açık fiş talebi</p>
          <DemoPrimaryButton className="mt-3 !w-auto !py-2.5 text-xs">Fiş yazdırıldı</DemoPrimaryButton>
        </form>
      ) : null}

      <section data-testid="cashier-bill-waves">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-950">Masa hesabı · sipariş dalgaları</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Her dalga ayrı CustomerOrder’dır. Eski PREPARING/SERVED dalgaların durumu yeni eklemeyle değişmez.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">{billOrders.length}</span>
        </div>
        {billOrders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            Hesapta sipariş yok.
          </p>
        ) : (
          <div className="space-y-3">
            {billOrders.map((order, index) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
                data-testid="cashier-order-wave"
                data-order-status={order.status}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      Dalga {index + 1}
                    </p>
                    <p className="text-sm font-black text-slate-950">{order.orderNo}</p>
                    <p className="text-xs font-semibold text-slate-500">{elapsedLabel(order.createdAt)}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-600">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.quantity}× {item.name}
                        <span className="ml-1 font-medium text-slate-400">@{formatLira(item.unitPrice)}</span>
                        {item.modifiers?.length ? (
                          <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
                            {item.modifiers.map((modifier) => `${modifier.groupName}: ${modifier.optionName}`).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-slate-800">{formatLira(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                {order.note ? <p className="mt-2 text-xs font-medium text-slate-500">Not: {order.note}</p> : null}
                <p className="mt-2 text-sm font-black text-slate-950">{formatLira(order.subtotal)}</p>
                {canManage && (order.status === "NEW" || order.status === "PREPARING") ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.status === "NEW" ? (
                      <form action={updateOrderStatusAction}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <input type="hidden" name="status" value="PREPARING" />
                        <button type="submit" className="min-h-11 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white">
                          Hazırlamaya al
                        </button>
                      </form>
                    ) : null}
                    <form action={updateOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input type="hidden" name="status" value="SERVED" />
                      <button type="submit" className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                        Servis edildi
                      </button>
                    </form>
                    <form action={updateOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <button
                        type="submit"
                        className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"
                      >
                        İptal
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4" data-testid="cashier-new-wave">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-950">
              {isEmpty ? "Masayı aç · ilk sipariş dalgası" : "Yeni sipariş dalgası ekle"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {isEmpty
                ? "Boş masada ilk createOrder servisi başlatır. Ayrı bir masa-aç mutation’ı yoktur."
                : "Mevcut PREPARING/SERVED dalgalarına ürün eklenmez; mutfakta yeni NEW bileti oluşur."}
            </p>
          </div>
          {canManage && !showComposer ? (
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800"
            >
              Composer aç
            </button>
          ) : null}
        </div>
        {canManage && showComposer ? (
          <WexPayOrderComposer
            branchId={activeBranchId}
            redirectTo={redirectTo}
            tables={[{ id: table.id, label: table.label }]}
            products={products}
            lockedTableId={table.id}
            submitLabel={isEmpty ? "Masayı aç ve ilk siparişi oluştur" : "Yeni sipariş dalgası gönder"}
          />
        ) : null}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-4">
        <h3 className="text-sm font-black text-slate-950">Tahsilat</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Gerçek ödeme kaydı. “Müşteri ödeme istedi” bildiriminden ayrıdır.
        </p>
        {canManage && table.remainingAmount > 0 ? (
          <div className="mt-3">
            <WexPayTablePaymentForm
              tableId={table.id}
              branchId={activeBranchId}
              redirectTo={redirectTo}
              remainingAmount={table.remainingAmount}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {table.remainingAmount <= 0 ? "Kalan tutar yok." : "Yönetim yetkisi gerekli."}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-black text-slate-950">Masa kapat</h3>
        {!canCloseTable ? (
          <p className="mt-2 text-sm font-semibold text-amber-800" data-testid="cashier-close-block">
            {hasRemainingAmount
              ? "Kalan ödeme varken masa kapatılamaz. Önce adisyonu kapatın. Ödeme talebi tahsilat değildir."
              : hasOpenOrders
                ? "Açık NEW/PREPARING sipariş varken masa kapatılamaz."
                : table.status === "EMPTY"
                  ? "Masa zaten boş."
                  : "Masa kapatma koşulları sağlanmıyor."}
          </p>
        ) : canManage ? (
          <div className="mt-3 space-y-2">
            {!confirmClose ? (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-800"
              >
                Masayı kapat…
              </button>
            ) : (
              <form action={closeTableAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="tableId" value={table.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <p className="w-full text-xs font-semibold text-rose-800">Masa kapatılacak. Emin misiniz?</p>
                <button type="submit" className="min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-xs font-black text-white">
                  Evet, kapat
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Vazgeç
                </button>
              </form>
            )}
          </div>
        ) : null}
      </section>

      {table.orderHistory.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-black text-slate-950">Son sipariş geçmişi</h3>
          <div className="space-y-2">
            {table.orderHistory.slice(0, 5).map((order) => (
              <div key={order.id} className="flex justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold">
                <span>
                  {order.orderNo} · {orderStatusLabels[order.status] ?? order.status}
                </span>
                <span>{formatLira(order.subtotal)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-black ${accent ? "text-emerald-800" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
