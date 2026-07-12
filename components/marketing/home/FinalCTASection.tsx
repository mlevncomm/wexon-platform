import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

export default function FinalCTASection() {
  return (
    <section className="relative bg-slate-50 px-5 pb-20 pt-4 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28">
      <div className="mx-auto max-w-[1180px]">
        <div className="wx-dark-panel relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-14 text-center shadow-[0_50px_120px_-50px_rgba(2,44,34,0.9)] sm:px-10 sm:py-16 lg:px-16">
          <div className="pointer-events-none absolute inset-0 wx-grid-overlay opacity-80" />
          <div className="relative mx-auto max-w-2xl">
            <Badge tone="onDark" dot>
              Wexon ile başlayın
            </Badge>
            <h2 className="mt-6 text-3xl font-black tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Wexon ekosistemini işletmeniz için{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                birlikte planlayalım
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300/90 sm:text-lg">
              Restoran, otel veya B2B operasyonunuz için hangi ürünlerin, hangi lisans modeliyle
              başlayacağını birlikte netleştirelim.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/demo-request" variant="primary" size="lg" withArrow fullWidth className="sm:w-auto">
                Demo Talep Et
              </Button>
              <Button href="/#products" variant="onDarkGhost" size="lg" fullWidth className="sm:w-auto">
                Ürünleri İncele
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
