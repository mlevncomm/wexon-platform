"use client";

import QrModalShell from "@/components/qr-order/QrModalShell";
import { qrCard, qrGhostCta, qrPrimaryCta } from "@/components/qr-order/qr-theme";
import type { QrTableContext } from "@/lib/qr-order/types";

export default function QrMoreSheet({
  open,
  context,
  onClose,
  onCallWaiter,
}: {
  open: boolean;
  context: QrTableContext;
  onClose: () => void;
  onCallWaiter: () => void;
}) {
  return (
    <QrModalShell open={open} onClose={onClose} titleId="qr-more-title">
      <div className="w-full max-w-md rounded-t-[28px] border border-white/80 bg-wx-surface p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Daha fazla</p>
            <h2 id="qr-more-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">
              {context.restaurantName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {context.branchName} · {context.tableLabel}
            </p>
          </div>
          <button
            type="button"
            data-qr-modal-close
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className={`${qrCard} mt-5 space-y-2 p-2`}>
          <button
            type="button"
            data-testid="qr-more-waiter"
            onClick={() => {
              onClose();
              onCallWaiter();
            }}
            className={`${qrPrimaryCta} !rounded-[16px]`}
          >
            Garson çağır
          </button>
          <p className={`${qrGhostCta} !cursor-default !border-0 !bg-transparent text-center !shadow-none`}>
            Powered by Wexon · WexPay
          </p>
        </div>
      </div>
    </QrModalShell>
  );
}
