const STATS: { value: string; label: string; emphasized?: boolean }[] = [
  { value: "3 ürün", label: "Tek ekosistem" },
  { value: "1 Core", label: "Merkezi lisans altyapısı" },
  { value: "Pilot", label: "WexPay aktif", emphasized: true },
  { value: "3 lisans modeli", label: "Aylık / yıllık / tek seferlik" },
];

export default function WexonStatsStrip() {
  return (
    <section className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-24 lg:px-12 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-[1480px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Wexon ekosistemi tek bakışta
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
            Sade rakamlar, net altyapı
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) =>
            stat.emphasized ? (
              <div
                key={stat.value}
                className="relative overflow-hidden rounded-2xl border border-transparent bg-emerald-500 p-7 text-white shadow-xl shadow-emerald-500/25"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/30 blur-2xl" />
                <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                  Pilot
                </p>
                <p className="relative mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {stat.value}
                </p>
                <p className="relative mt-2 text-sm font-semibold text-emerald-50">{stat.label}</p>
              </div>
            ) : (
              <div
                key={stat.value}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm shadow-slate-200/40 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Wexon
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{stat.label}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
