import Link from "next/link";
import AdminPasswordField from "@/app/admin/login/AdminPasswordField";
import { loginAdminAction } from "@/lib/wexon-admin-auth-actions";
import { defaultAdminPostLoginPath, safeAdminNextPath } from "@/lib/wexon-admin-login-next";
import { isWexonProductionDeployment } from "@/lib/wexon-canonical-host";
import { publicUrl } from "@/lib/wexon/urls";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; adminError?: string }>;
}) {
  const { next, adminError } = await searchParams;
  const productionWexon = isWexonProductionDeployment();
  // Only honor an explicit query `next`. Direct /login visits default to admin root
  // so logout → login cannot resurrect a prior /applications target.
  const nextPath = next?.trim()
    ? safeAdminNextPath(next, productionWexon)
    : defaultAdminPostLoginPath(productionWexon);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-5 py-12 text-slate-950">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={publicUrl("/")} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">
            Wexon
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Wexon Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-slate-950">İç yönetim paneli girişi</h1>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          <p className="text-sm leading-relaxed text-slate-600">Devam etmek için yetkili admin hesabınızla giriş yapın.</p>
          {adminError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {adminError}
            </div>
          )}
          <form action={loginAdminAction} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">E-posta</span>
              <input
                name="email"
                type="email"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <AdminPasswordField />
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Giriş yap
            </button>
            <Link href={publicUrl("/")} className="text-center text-sm font-bold text-slate-500 hover:text-slate-950">
              Ana sayfaya dön
            </Link>
          </form>
        </div>
        <p className="mt-6 text-center text-xs font-semibold leading-relaxed text-slate-500">
          Bu ekran yalnızca Wexon iç kullanıcıları içindir.
        </p>
      </section>
    </main>
  );
}
