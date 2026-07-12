import type { ProductAccent, RoadmapProductContent } from "@/types/wexon";
import { Badge, Button, Eyebrow, WexonIcon } from "@/components/ui";
import { ACCENT_CLASSES } from "@/components/marketing/home/accent";

const BLUR_COLOR: Record<ProductAccent, string> = {
  emerald: "#10b981",
  indigo: "#6366f1",
  amber: "#f59e0b",
};

const PRIMARY_BTN: Record<ProductAccent, string> = {
  emerald: "",
  indigo: "!bg-indigo-500 hover:!bg-indigo-600 shadow-[0_18px_42px_-16px_rgba(99,102,241,0.7)]",
  amber: "!bg-amber-500 hover:!bg-amber-600 shadow-[0_18px_42px_-16px_rgba(245,158,11,0.7)]",
};

const NOTE_ICON: Record<ProductAccent, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-700",
};

export default function RoadmapHero({ content }: { content: RoadmapProductContent }) {
  const accent = ACCENT_CLASSES[content.accent];

  return (
    <section className="px-5 pb-16 pt-24 sm:px-8 md:pt-28 lg:px-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white px-6 py-14 shadow-[0_40px_100px_-55px_rgba(2,44,34,0.4)] sm:px-10 lg:px-16 lg:py-20">
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${BLUR_COLOR[content.accent]} 0%, transparent 66%)`,
              opacity: 0.13,
            }}
          />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <Eyebrow accent={content.accent}>{content.heroBadge}</Eyebrow>
              <Badge tone="dark">{content.statusLabel}</Badge>
            </div>
            <h1 className="mb-6 text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]">
              {content.heroTitle}
            </h1>
            <p className="mx-auto mb-9 max-w-2xl text-lg leading-relaxed text-slate-600">
              {content.heroDescription}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Button
                href={`/demo-request?product=${content.id}`}
                variant="primary"
                size="lg"
                withArrow
                className={PRIMARY_BTN[content.accent]}
              >
                Demo Talep Et
              </Button>
              <Button href="/products/wexpay" variant="secondary" size="lg">
                WexPay&apos;i şimdi keşfedin
              </Button>
            </div>

            <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${NOTE_ICON[content.accent]}`}
                >
                  <WexonIcon name="layers" size={14} />
                </span>
                <p className="text-sm leading-relaxed text-slate-600">{content.ecosystemNote}</p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${NOTE_ICON[content.accent]}`}
                >
                  <WexonIcon name="track" size={14} />
                </span>
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${accent.text}`}>
                    Yol haritası
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{content.roadmapNote}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
