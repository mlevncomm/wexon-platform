import Link from "next/link";

export default function WexonCTA() {
  return (
    <section className="relative px-5 py-16 sm:px-8 sm:py-24 lg:px-12 lg:py-28 xl:px-16 2xl:px-20">
      <div className="relative mx-auto max-w-[1560px]">
        <div className="relative overflow-hidden rounded-[28px] border border-white/5 bg-[radial-gradient(circle_at_20%_-10%,#0f3024_0%,transparent_55%),radial-gradient(circle_at_85%_120%,#0a4a36_0%,transparent_50%),linear-gradient(180deg,#06101c_0%,#0a1626_100%)] px-5 py-16 text-center shadow-2xl shadow-slate-950/30 sm:rounded-[36px] sm:px-10 sm:py-24 lg:px-16">
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(circle at 50% 50%, black 0%, black 55%, transparent 90%)",
              WebkitMaskImage:
                "radial-gradient(circle at 50% 50%, black 0%, black 55%, transparent 90%)",
            }}
          />
          <div className="pointer-events-none absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[160px]" />
          <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-[160px]" />

          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Wexon ile başlayın
            </span>

            <h2 className="mt-6 text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl lg:text-[3.4rem] lg:leading-[1.05]">
              Wexon ekosistemini{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                işletmeniz için
              </span>{" "}
              planlayalım
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300/90 sm:text-lg">
              WexPay, Wexon Core ve gelecek Wexon ürünlerinin işletmenizde nasıl çalışacağını
              birlikte değerlendirelim.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/demo-request"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-500/30 transition-all hover:bg-emerald-400 hover:shadow-emerald-400/40 sm:w-auto"
              >
                Demo Talep Et
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/book-demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition-colors hover:border-white/30 hover:bg-white/10 sm:w-auto"
              >
                Randevu Al
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Hızlı yanıt
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Sektöre özel kurgu
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Canlı demo eşliğinde
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
