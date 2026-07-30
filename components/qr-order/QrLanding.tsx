"use client";

import QrEmptyState from "@/components/qr-order/ui/QrEmptyState";
import { qrFrame, qrPageShell } from "@/components/qr-order/qr-theme";
import type { QrTableContext } from "@/lib/qr-order/types";

/** Fallback when menu is empty — primary entry is now the Menü tab. */
export default function QrLanding({
  context,
  menuEmpty,
  onBrowseMenu,
  onPay,
  onCallWaiter,
}: {
  context: QrTableContext;
  menuEmpty: boolean;
  onBrowseMenu: () => void;
  onPay: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <div className={`${qrPageShell} items-center`}>
      <div className={`${qrFrame} w-full py-8 text-center`}>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          WexPay · Masa siparişi
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {context.restaurantName}
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {context.branchName} · {context.tableLabel}
        </p>

        {menuEmpty ? (
          <div className="mt-8 text-left">
            <QrEmptyState
              title="Menü henüz hazır değil"
              description="Personelden yardım isteyebilirsiniz. Hesabınızı veya garson çağrısını kullanabilirsiniz."
              actionLabel="Hesabı gör"
              onAction={onPay}
            />
            <button
              type="button"
              onClick={onCallWaiter}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700"
            >
              Garson çağır
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <QrEmptyState
              title="Menüye hoş geldiniz"
              description="Kategorileri inceleyin, siparişinizi masadan gönderin."
              actionLabel="Menüyü İncele"
              onAction={onBrowseMenu}
            />
          </div>
        )}
      </div>
    </div>
  );
}
