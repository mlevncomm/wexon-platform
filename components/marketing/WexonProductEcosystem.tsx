import { PRODUCTS } from "@/lib/wexon-mock-data";
import WexonProductCard from "./WexonProductCard";

export default function WexonProductEcosystem() {
  return (
    <section id="products" className="relative overflow-hidden bg-[#f6f8f7] px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-32 xl:px-16 2xl:px-20">
      <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="mx-auto max-w-[1480px]">
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5dff65]" />
            Wexon ürünleri
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl lg:text-6xl">
            Üç Ürün. <span className="text-emerald-600">Tek Altyapı.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Her Wexon ürünü tek başına güçlüdür; birlikte ise müşteri, lisans, abonelik ve
            faturalandırma süreçlerini Wexon Core üzerinden ortak yönetir.
          </p>
          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-600">
            {["WexPay aktif", "WexHotel yakında", "WexB2B yakında", "Wexon Core ortak altyapı"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-sm shadow-slate-200/50">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5dff65]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch lg:gap-8">
          {PRODUCTS.map((product) => (
            <WexonProductCard
              key={product.id}
              product={product}
              highlighted={product.id === "wexpay"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
