import Link from "next/link";
import type { ReactNode } from "react";
import { createMockCheckoutSubscriptionAction } from "@/lib/wexon-checkout-actions";
import { checkoutPrice, type CheckoutBillingInterval, type CheckoutPlanKey } from "@/lib/wexon-checkout-validation";
import { getCurrentCustomerUser } from "@/lib/wexon-customer-auth";

type CheckoutSearchParams = Promise<{ product?: string; plan?: string; interval?: string; checkoutError?: string }>;

const planLabels: Record<CheckoutPlanKey, string> = {
  basic: "Basic",
  standard: "Standard",
  pro: "Pro",
};

function money(value: number) {
  return `${value.toLocaleString("tr-TR")} TRY`;
}

export default async function CheckoutPage({ searchParams }: { searchParams: CheckoutSearchParams }) {
  const params = await searchParams;
  const productKey = (params.product ?? "wexpay").toLowerCase();
  const planKey = (["basic", "standard", "pro"].includes((params.plan ?? "").toLowerCase()) ? (params.plan ?? "standard").toLowerCase() : "standard") as CheckoutPlanKey;
  const billingInterval = ((params.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly") as CheckoutBillingInterval;
  const price = checkoutPrice("wexpay", planKey, billingInterval);
  const currentUser = await getCurrentCustomerUser();
  const showMockNotice = process.env.NODE_ENV !== "production";
  const checkoutBase = `/checkout?product=wexpay&plan=${planKey}`;
  const accountFeature = currentUser ? "Abonelik mevcut Wexon Core hesabınıza bağlanır" : "Wexon Core hesabı otomatik oluşturulur";

  if (productKey !== "wexpay") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] px-5 py-10">
        <section className="max-w-xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <h1 className="text-3xl font-black text-slate-950">Bu ürün için abonelik yakında aktif olacak.</h1>
          <p className="mt-4 text-sm font-semibold text-slate-600">WexHotel ve WexB2B abonelikleri sonraki fazda açılacaktır.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/demo-request" className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white">Demo talebi oluştur</Link>
            <Link href="/" className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">Ana sayfaya dön</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_15%_0%,#0f3024_0%,transparent_48%),linear-gradient(180deg,#050b16_0%,#081424_100%)] p-3 text-slate-950 sm:p-4 lg:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <section className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-5 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-6 lg:p-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative">
            <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Wexon</Link>
            <p className="text-sm font-bold text-slate-300">WexPay aboneliği</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{money(price.total)}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">{billingInterval === "yearly" ? "yıllık" : "aylık"} ödeme</p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-white">WexPay {planLabels[planKey]}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">{billingInterval === "yearly" ? "Yıllık olarak faturalandırılır" : "Aylık olarak faturalandırılır"}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">Aktif ürün</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <PriceRow label="Ara toplam" value={money(price.subtotal)} />
                <PriceRow label="KDV (%20)" value={money(price.tax)} />
                <div className="border-t border-white/10 pt-3">
                  <PriceRow label="Bugün ödenecek toplam" value={money(price.total)} strong />
                </div>
              </div>
            </div>

            <div className="mt-4 flex rounded-2xl border border-white/10 bg-white/[0.06] p-1">
              <Link href={`${checkoutBase}&interval=monthly`} className={`flex-1 rounded-xl px-4 py-2 text-center text-xs font-black ${billingInterval === "monthly" ? "bg-white text-slate-950" : "text-slate-300"}`}>
                Aylık
              </Link>
              <Link href={`${checkoutBase}&interval=yearly`} className={`flex-1 rounded-xl px-4 py-2 text-center text-xs font-black ${billingInterval === "yearly" ? "bg-white text-slate-950" : "text-slate-300"}`}>
                Yıllık
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="font-black text-emerald-200">Kurulum süreci dahildir</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-300">
                Aboneliğiniz başladıktan sonra WexPay kurulum süreciniz başlatılır. Ekibimiz 5 iş günü içinde kurulum detaylarını netleştirmek için sizinle iletişime geçer.
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {["Güvenli abonelik başlangıcı", accountFeature, "WexPay lisansı ödeme sonrası aktif edilir", "Kurulum süreci 5 iş günü içinde başlatılır"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200">{item}</div>
              ))}
            </div>

            {showMockNotice && (
              <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs font-bold leading-relaxed text-amber-100">
                Geliştirme ortamında ödeme mock olarak başarılı kabul edilir.
              </p>
            )}
          </div>
        </aside>

        <div className="rounded-2xl border border-white/20 bg-white p-5 shadow-2xl shadow-emerald-950/30 sm:p-6 lg:p-7">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{currentUser ? "Mevcut hesabınızla aboneliği başlatın" : "WexPay aboneliğinizi başlatın"}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            {currentUser ? "Bu abonelik, giriş yaptığınız Wexon Core hesabına bağlı organizasyon için başlatılacak." : "Ödeme sonrası Wexon Core hesabınız oluşturulur ve WexPay lisansınız aktif edilir."}
          </p>
          {currentUser && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
              {currentUser.email} hesabıyla devam ediyorsunuz. Organizasyon: {currentUser.memberships[0]?.organization.name ?? "-"}.
            </div>
          )}
          {params.checkoutError && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.checkoutError}</div>}
          <form action={createMockCheckoutSubscriptionAction} className="mt-5 grid gap-3">
            <input type="hidden" name="productKey" value="wexpay" />
            <input type="hidden" name="planKey" value={planKey} />
            <input type="hidden" name="billingInterval" value={billingInterval} />
            <SectionLabel>İletişim bilgileri</SectionLabel>
            <Input label="Yetkili adı" name="name" defaultValue={currentUser?.name ?? ""} required />
            <Input label="E-posta" name="email" type="email" defaultValue={currentUser?.email ?? ""} required readOnly={Boolean(currentUser)} />
            {!currentUser && (
              <>
                <SectionLabel>Hesap bilgileri</SectionLabel>
                <Input label="Şifre" name="password" type="password" required />
                <Input label="Şifre tekrar" name="passwordConfirm" type="password" required />
              </>
            )}
            <SectionLabel>İşletme bilgileri</SectionLabel>
            <Input label="İşletme / organizasyon adı" name="organizationName" defaultValue={currentUser?.memberships[0]?.organization.name ?? ""} required readOnly={Boolean(currentUser)} />
            <Input label="Telefon" name="phone" defaultValue={currentUser?.phone ?? ""} />
            <Input label="Ülke" name="country" defaultValue="TR" />
            <SectionLabel>Ödeme yöntemi</SectionLabel>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              <p className="font-black text-slate-950">Mock ödeme</p>
              <p className="mt-1 text-xs leading-relaxed">Bu geliştirme ortamında ödeme başarılı kabul edilir. Production ödeme akışı ödeme sağlayıcı session ile değiştirilecektir.</p>
            </div>
            <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              {money(price.total)} öde ve aboneliği başlat
            </button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="font-bold text-slate-600 hover:text-slate-950">Ana sayfaya dön</Link>
              {currentUser && <Link href="/dashboard" className="font-bold text-slate-600 hover:text-slate-950">Core paneline dön</Link>}
            </div>
            {!currentUser && <Link href="/login" className="font-black text-emerald-700">Zaten hesabınız var mı? Giriş yap</Link>}
          </div>
          <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
            Aboneliği başlatarak Wexon kullanım şartlarını ve abonelik koşullarını kabul etmiş olursunuz.
          </p>
        </div>
      </section>
    </main>
  );
}

function PriceRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><span className={strong ? "font-black text-white" : "font-semibold text-slate-300"}>{label}</span><span className={strong ? "font-black text-white" : "font-semibold text-slate-200"}>{value}</span></div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="pt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{children}</p>;
}

function Input({ label, name, type = "text", required = false, defaultValue, readOnly = false }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; readOnly?: boolean }) {
  return <label className="block"><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><input name={name} type={type} required={required} defaultValue={defaultValue} readOnly={readOnly} className={`mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 ${readOnly ? "bg-slate-50 text-slate-500" : ""}`} /></label>;
}
