import { redirect } from "next/navigation";
import ChangePasswordFields from "@/app/dashboard/change-password/ChangePasswordFields";
import { changeCustomerPasswordAction } from "@/lib/wexon-customer-actions";
import { assertCustomerSession } from "@/lib/wexon-customer-auth";
import { prisma } from "@/lib/prisma";
import { customerLoginUrl } from "@/lib/wexon/urls";

export default async function DashboardChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ customerError?: string }>;
}) {
  const { customerError } = await searchParams;
  const session = await assertCustomerSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  if (!user || !user.isActive) {
    redirect(customerLoginUrl());
  }

  if (!user.mustChangePassword) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-3 text-white sm:p-4 lg:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <section className="min-w-0 px-2 py-4 sm:px-4 lg:py-8">
          <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            İlk giriş güvenliği
          </span>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-300">Wexon Core güvenlik adımı</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-white sm:text-5xl">
            Hesabınızı kendi şifrenizle güvenceye alın
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Admin tarafından verilen geçici şifreyi değiştirerek Wexon Core müşteri panelini kullanmaya başlayabilirsiniz.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
            {[
              "Şifreniz güvenli şekilde hashlenir.",
              "Yeni şifreniz en az 8 karakter olmalıdır.",
              "Bu adım tamamlanmadan müşteri paneline erişim verilmez.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold leading-relaxed text-slate-200">
                <span className="mb-3 block h-2 w-10 rounded-full bg-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-white/20 bg-white p-5 text-slate-950 shadow-2xl shadow-emerald-950/30 sm:p-7">
          <div className="mb-6">
            <span className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              Güvenlik
            </span>
            <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950">Şifrenizi değiştirin</h2>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
              Devam etmek için geçici şifrenizi yeni bir şifreyle değiştirin.
            </p>
          </div>

          {customerError && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {customerError}
            </div>
          )}

          <form action={changeCustomerPasswordAction} className="grid gap-4">
            <ChangePasswordFields />
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600">
              Şifreniz düz metin olarak saklanmaz. Yeni şifreniz en az 8 karakter olmalıdır.
            </p>
            <button type="submit" className="w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700">
              Şifreyi güncelle
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
