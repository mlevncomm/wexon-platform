import Link from "next/link";
import { createCustomerSignupAction } from "@/lib/wexon-signup-actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ signupError?: string }> }) {
  const { signupError } = await searchParams;

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
            <Link href="/" className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-2xl shadow-emerald-950/20">Wexon</Link>
            <Link href="/" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">Ana sayfaya dön</Link>
          </div>
          <span className="mb-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            Wexon Core hesabı
          </span>
          <h1 className="text-3xl font-black leading-tight tracking-[-0.03em] sm:text-5xl xl:text-6xl">
            Restoran, otel ve B2B operasyonlarınızı tek merkezden başlatın.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300">
            Wexon hesabınızı oluşturun, müşteri panelinizden ürün erişimlerinizi takip edin ve WexPay aktivasyon sürecinizi başlatın.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {["Güvenli müşteri hesabı", "Owner rolüyle ilk kullanıcı", "WexPay aktivasyon takibi", "Lisans ve ürün erişimi yönetimi"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-slate-200">{item}</div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/20 bg-white p-5 text-slate-950 shadow-2xl shadow-emerald-950/30 sm:p-7 lg:p-8">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">Kayıt ol</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">Wexon Core müşteri paneline erişmek için bilgilerinizi girin.</p>
          {signupError && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{signupError}</div>}
          <form action={createCustomerSignupAction} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Input label="Yetkili adı" name="name" required />
            <Input label="E-posta" name="email" type="email" required />
            <Input label="Şifre" name="password" type="password" required />
            <Input label="Şifre tekrar" name="passwordConfirm" type="password" required />
            <Input label="İşletme / organizasyon adı" name="organizationName" required />
            <Input label="Telefon" name="phone" />
            <Input label="Ülke" name="country" defaultValue="TR" />
            <input type="hidden" name="productInterest" value="WexPay" />
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-700 sm:col-span-2">Hesap oluştur</button>
          </form>
          <p className="mt-5 text-center text-xs font-semibold text-slate-500">
            Zaten hesabınız var mı? <Link href="/login" className="font-black text-emerald-700">Giriş yap</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Input({ label, name, type = "text", required = false, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
    </label>
  );
}
