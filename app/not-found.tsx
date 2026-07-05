import Link from "next/link";
import { publicUrl, resolveNavigationHref } from "@/lib/wexon/urls";

export default function NotFoundPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,#030712_0%,#07111f_48%,#050b16_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="min-w-0">
          <Link href={publicUrl("/")} className="mb-8 inline-flex rounded-full border border-white/10 bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-2xl shadow-emerald-950/20">
                Wexon
              </Link>
          <span className="mb-5 flex w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            Rota bulunamadı
              </span>
          <h1 className="max-w-3xl break-words text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            Bu sayfa Wexon haritasında görünmüyor.
              </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Aradığınız bağlantı taşınmış, kaldırılmış ya da henüz oluşturulmamış olabilir. Merak etmeyin; sistem hâlâ çalışıyor, sadece bu rota aktif değil.
              </p>
          <p className="mt-5 max-w-xl text-sm font-semibold leading-relaxed text-slate-400">
            Wexon Core, WexPay, WexHotel ve WexB2B ürünlerine ait erişimler hesabınıza ve lisans durumunuza göre değişebilir.
              </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={publicUrl("/")} className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400">
                  Ana sayfaya dön
                </Link>
            <Link href={resolveNavigationHref("/contact")} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">
              Destek talebi oluştur
                </Link>
              </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {["Wexon Core", "WexPay", "Lisans yönetimi", "Güvenli erişim"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-300">
                {item}
              </span>
            ))}
            </div>
        </div>

        <div className="relative min-w-0">
          <div className="pointer-events-none absolute -inset-6 rounded-[42px] bg-emerald-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Rota kontrolü</p>
                <p className="mt-1 text-sm font-bold text-slate-300">Wexon router</p>
                  </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                stable
              </span>
            </div>
            <div className="relative mb-8 rounded-[28px] border border-white/10 bg-slate-950/40 p-6 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.22),transparent_55%)]" />
              <p className="relative text-[5rem] font-black leading-none tracking-[-0.08em] text-white sm:text-[7rem] lg:text-[8rem]">
                404
              </p>
              <div className="relative mx-auto mt-4 h-1.5 max-w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ["İstek", "bilinmeyen rota"],
                ["Durum", "bulunamadı"],
                ["Sistem", "çalışıyor"],
                ["Öneri", "ana sayfadan devam edin"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
                  <span className="text-sm font-bold text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
