import Link from "next/link";
import { headers } from "next/headers";
import { ADMIN_FIELD_SURFACE } from "@/components/marketing/admin-ui/adminFieldStyles";
import {
  continueAdminCloudflareLoginAction,
  continueLocalAdminCloudflareTestLoginAction,
} from "@/lib/wexon-admin-auth-actions";
import { defaultAdminPostLoginPath, safeAdminNextPath } from "@/lib/wexon-admin-login-next";
import { defaultLocalAdminTestEmail } from "@/lib/wexon-cloudflare-access-test-login";
import { isLocalCloudflareAccessTestRuntime } from "@/lib/wexon-cloudflare-access-test-runtime";
import { isWexonProductionDeployment } from "@/lib/wexon-canonical-host";
import { publicUrl } from "@/lib/wexon/urls";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; adminError?: string }>;
}) {
  const { next, adminError } = await searchParams;
  const productionWexon = isWexonProductionDeployment();
  const headerStore = await headers();
  const host = headerStore.get("host") ?? headerStore.get("x-forwarded-host");
  const localCfTest = isLocalCloudflareAccessTestRuntime(host);
  // Only honor an explicit query `next`. Direct /login visits default to admin root
  // so logout → login cannot resurrect a prior /applications target.
  const nextPath = next?.trim()
    ? safeAdminNextPath(next, productionWexon)
    : defaultAdminPostLoginPath(productionWexon);
  const localEmailDefault = defaultLocalAdminTestEmail();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-5 py-12 text-slate-950">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={publicUrl("/")} className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">
            Wexon
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Wexon Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.02em] text-slate-950">İç yönetim paneli</h1>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          {localCfTest ? (
            <p className="text-sm leading-relaxed text-slate-600">
              Yerel geliştirme modu: Cloudflare Access test kimliği ile yönetim paneline giriş yapabilirsiniz.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-600">
              Cloudflare Access ile kimliğiniz doğrulandıysa yönetim paneline devam edebilirsiniz.
            </p>
          )}
          {adminError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {adminError}
            </div>
          )}
          {localCfTest ? (
            <form action={continueLocalAdminCloudflareTestLoginAction} className="mt-6 grid gap-4">
              <input type="hidden" name="next" value={nextPath} />
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Admin e-posta
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={localEmailDefault}
                  autoComplete="username"
                  className={`rounded-2xl px-4 py-3 text-sm font-medium text-slate-950 ${ADMIN_FIELD_SURFACE}`}
                />
              </label>
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Yerel yönetim paneline giriş
              </button>
              <Link href={publicUrl("/")} className="text-center text-sm font-bold text-slate-500 hover:text-slate-950">
                Ana sayfaya dön
              </Link>
            </form>
          ) : (
            <form action={continueAdminCloudflareLoginAction} className="mt-6 grid gap-4">
              <input type="hidden" name="next" value={nextPath} />
              <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Yönetim paneline devam et
              </button>
              <Link href={publicUrl("/")} className="text-center text-sm font-bold text-slate-500 hover:text-slate-950">
                Ana sayfaya dön
              </Link>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs font-semibold leading-relaxed text-slate-500">
          {localCfTest
            ? "Bu ekran yalnızca local/CI Cloudflare Access test modunda aktiftir."
            : "Bu ekran yalnızca Wexon iç kullanıcıları içindir. Paylaşılan admin şifresi ile giriş kapalıdır."}
        </p>
      </section>
    </main>
  );
}
