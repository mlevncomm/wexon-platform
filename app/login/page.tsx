import Link from "next/link";
import LoginPasswordField from "@/app/login/LoginPasswordField";
import { loginUnifiedAction } from "@/lib/wexon-unified-auth-actions";
import { publicUrl } from "@/lib/wexon/urls";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string; next?: string }>;
}) {
  const { authError, next } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-3 text-white sm:p-4 lg:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <section className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <div className="min-w-0 px-2 py-4 sm:px-4 lg:py-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Link href={publicUrl("/")} className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-2xl shadow-emerald-950/20">Wexon</Link>
            <Link href={publicUrl("/")} className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">Ana sayfaya dön</Link>
          </div>
          <span className="mb-6 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            Güvenli erişim
          </span>
          <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-white sm:text-5xl xl:text-6xl">
            Wexon hesabınıza güvenli şekilde giriş yapın.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Wexon Core müşteri paneli veya yetkili yönetim erişiminiz için hesabınızla devam edin.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {["Tek giriş paneli", "Güvenli oturum", "Otomatik erişim yönlendirmesi", "Wexon Core bağlantısı"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/20 bg-white p-5 text-slate-950 shadow-2xl shadow-emerald-950/30 sm:p-7 lg:p-8">
          <h2 className="text-3xl font-black tracking-[-0.02em] text-slate-950">Giriş yap</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            E-posta ve şifrenizle devam edin. Erişim türünüz hesabınıza göre otomatik belirlenir.
          </p>
          {authError && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{authError}</div>}
          <form action={loginUnifiedAction} className="mt-6 grid gap-4">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">E-posta</span>
              <input name="email" type="email" required className="wx-input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <LoginPasswordField />
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700">Giriş yap</button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
              <span>Şifremi unuttum: Yakında</span>
              <Link href={publicUrl("/signup")} className="font-black text-emerald-700">Hesabınız yok mu? Kayıt olun</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
