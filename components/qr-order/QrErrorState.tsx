"use client";

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
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">WexPay</p>
        <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">{message}</p>
        {hint ? <p className="mt-4 text-xs font-medium text-slate-400">{hint}</p> : null}
      </div>
    </main>
  );
}
