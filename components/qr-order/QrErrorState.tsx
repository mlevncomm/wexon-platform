"use client";

import { qrGlass } from "@/components/qr-order/qr-theme";

export default function QrErrorState({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <main className="relative isolate flex min-h-[100dvh] w-full flex-1 items-center justify-center px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(165deg,#F6F8F5_0%,#ECFDF5_38%,#FAFAF7_100%)]"
      />
      <div className={`${qrGlass} mx-auto w-full max-w-md rounded-[32px] p-8 text-center sm:max-w-lg sm:p-10`}>
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 sm:h-16 sm:w-16">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">WexPay</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 sm:text-[15px]">{message}</p>
        {hint ? <p className="mt-4 text-xs font-medium text-slate-400">{hint}</p> : null}
      </div>
    </main>
  );
}
