"use client";

import { qrCard, qrPrimaryCta } from "@/components/qr-order/qr-theme";

export default function QrEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}) {
  return (
    <div className={`${qrCard} p-8 text-center sm:p-10`} data-testid={testId}>
      <div
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400"
      >
        ○
      </div>
      <p className="mt-4 text-base font-black text-slate-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-xs text-sm font-semibold leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={`${qrPrimaryCta} mt-6`}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
