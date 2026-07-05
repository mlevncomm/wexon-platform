import Link from "next/link";
import WexonFooter from "@/components/marketing/WexonFooter";
import WexonNavbar from "@/components/marketing/WexonNavbar";

const plannedModules = [
  "Bayi yönetimi",
  "Ürün katalogları",
  "Teklif yönetimi",
  "Sipariş yönetimi",
  "Cari ve ödeme takibi",
  "Raporlama",
];

function PlannedModuleCard({ module }: { module: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-2 w-10 rounded-full bg-[#5dff65]" />
      <p className="text-base font-bold text-slate-950">{module}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        WexB2B ürün kapsamı içinde planlanan ana modüllerden biri.
      </p>
    </div>
  );
}

export default function WexB2BPage() {
  return (
    <>
      <WexonNavbar />
      <main className="flex-1 bg-[#f6f8f7] text-slate-950">
        <section className="px-5 pb-16 pt-24 sm:px-8 md:pt-28 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-6 py-14 shadow-sm sm:px-10 lg:px-16 lg:py-20">
              <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative z-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                    Yakında
                  </span>
                  <h1 className="mb-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                    WexB2B yakında Wexon ekosisteminde
                  </h1>
                  <p className="mb-9 max-w-2xl text-lg leading-relaxed text-slate-600">
                    WexB2B; bayi, toptan satış, teklif, sipariş, cari ve ödeme süreçlerini dijitalleştirmek için planlanan Wexon ürünüdür. Şu anda ürün kapsamı ve mimari planlaması devam etmektedir.
                  </p>
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                    <Link href="/products/wexpay" className="inline-flex items-center justify-center rounded-2xl bg-[#5dff65] px-8 py-3.5 text-base font-semibold text-white shadow-sm shadow-[#5dff65]/20 transition-colors hover:bg-[#48e050]">
                      WexPay&apos;i İncele
                    </Link>
                    <Link href="/demo-request" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50">
                      Demo Talep Et
                    </Link>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
                  <p className="text-sm font-semibold text-[#5dff65]">Planlanan konum</p>
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">Üçüncü ana Wexon ürünü</h2>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    WexB2B, Wexon ekosisteminin üçüncü ana ürünü olarak WexPay ve WexHotel&apos;den sonra geliştirilecektir.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {plannedModules.slice(0, 4).map((module) => (
                      <div key={module} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-bold text-slate-950">{module}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1480px]">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <span className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                Planlanan Modüller
              </span>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                B2B satış operasyonu için planlanan temel yapı
              </h2>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                WexB2B aktif ürün değildir; kapsam ve mimari kararlar Wexon ürün yol haritasına göre netleştirilecektir.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plannedModules.map((module) => (
                <PlannedModuleCard key={module} module={module} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="mx-auto max-w-[1280px] rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <span className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              Wexon Yol Haritası
            </span>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              WexB2B, WexPay ve WexHotel&apos;den sonra gelecek
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600">
              Wexon ekosisteminde şu anda hazır ürün WexPay&apos;dir. Bayi, toptan satış ve cari takip kapsamı WexB2B planlamasında ele alınacaktır.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/products/wexpay" className="inline-flex items-center justify-center rounded-2xl bg-[#5dff65] px-9 py-4 text-base font-semibold text-white transition-colors hover:bg-[#48e050]">
                WexPay&apos;i İncele
              </Link>
              <Link href="/demo-request" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-9 py-4 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50">
                Demo Talep Et
              </Link>
            </div>
          </div>
        </section>
      </main>
      <WexonFooter />
    </>
  );
}