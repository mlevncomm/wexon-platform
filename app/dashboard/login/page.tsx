import Link from "next/link";
import { loginCustomerAction } from "@/lib/wexon-customer-auth-actions";

export default async function DashboardLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; customerError?: string }>;
}) {
  const { next, customerError } = await searchParams;
  const showDevNotice = process.env.NODE_ENV !== "production";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-5 py-12 text-slate-950">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">
            Wexon
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Wexon Core</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-slate-950">Wexon Core Müşteri Girişi</h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
            Admin tarafından verilen geçici şifre veya kendi şifrenizle giriş yapın.
          </p>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          {customerError && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {customerError}
            </div>
          )}
          <form action={loginCustomerAction} className="grid gap-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">E-posta</span>
              <input
                name="email"
                type="email"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Şifre</span>
              <input
                name="password"
                type="password"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Giriş yap
            </button>
            {showDevNotice && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900">
                Development ortamında şifresi henüz belirlenmemiş kullanıcılar için geçici ortak şifre fallback olarak kullanılabilir.
              </p>
            )}
            <Link href="/" className="text-center text-sm font-bold text-slate-500 hover:text-slate-950">
              Ana sayfaya dön
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
