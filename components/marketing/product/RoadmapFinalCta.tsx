import type { ProductAccent, ProductId } from "@/types/wexon";
import { Button } from "@/components/ui";

const ACCENT_GRADIENT: Record<ProductAccent, string> = {
  emerald: "from-emerald-300 to-emerald-500",
  indigo: "from-indigo-300 to-indigo-500",
  amber: "from-amber-300 to-amber-500",
};

const ACCENT_BADGE: Record<ProductAccent, string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  indigo: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
};

const ACCENT_DOT: Record<ProductAccent, string> = {
  emerald: "bg-emerald-400",
  indigo: "bg-indigo-400",
  amber: "bg-amber-400",
};

const ACCENT_BTN: Record<ProductAccent, string> = {
  emerald: "",
  indigo: "!bg-indigo-500 hover:!bg-indigo-600 shadow-[0_18px_42px_-16px_rgba(99,102,241,0.7)]",
  amber: "!bg-amber-500 hover:!bg-amber-600 shadow-[0_18px_42px_-16px_rgba(245,158,11,0.7)]",
};

export default function RoadmapFinalCta({
  productId,
  productName,
  accent = "emerald",
}: {
  productId: ProductId;
  productName: string;
  accent?: ProductAccent;
}) {
  return (
    <section className="relative bg-white px-5 pb-20 pt-4 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
      <div className="mx-auto max-w-[1180px]">
        <div className="wx-dark-panel relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-14 text-center shadow-[0_50px_120px_-50px_rgba(2,44,34,0.9)] sm:px-10 sm:py-16 lg:px-16">
          <div className="pointer-events-none absolute inset-0 wx-grid-overlay opacity-80" />
          <div className="relative mx-auto max-w-2xl">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${ACCENT_BADGE[accent]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`} />
              Roadmap ürünü
            </span>
            <h2 className="mt-6 text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              {productName} için{" "}
              <span className={`bg-gradient-to-r bg-clip-text text-transparent ${ACCENT_GRADIENT[accent]}`}>
                ön kayıt olun
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300/90 sm:text-lg">
              {productName} henüz lansmana çıkmadı; güncel fiyatlandırma lansman sürecinde paylaşılacaktır.
              Demo talep ederek ilginizi iletebilir, öncelikli bilgilendirme listesine katılabilirsiniz.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                href={`/demo-request?product=${productId}`}
                variant="primary"
                size="lg"
                withArrow
                fullWidth
                className={`sm:w-auto ${ACCENT_BTN[accent]}`}
              >
                Demo Talep Et / Ön Kayıt Ol
              </Button>
              <Button href="/products/wexpay" variant="onDarkGhost" size="lg" fullWidth className="sm:w-auto">
                Şimdi WexPay ile başlayın
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
