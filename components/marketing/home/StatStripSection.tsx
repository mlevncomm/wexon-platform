import { HOME_STATS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import StatStrip from "@/components/ui/StatStrip";
import Eyebrow from "@/components/ui/Eyebrow";

export default function StatStripSection() {
  return (
    <SectionShell tone="subtle" width="wide">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Neden Wexon</Eyebrow>
        <h2 className="mt-5 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">
          Dağınık araçlar yerine{" "}
          <span className="text-emerald-600">tek, bağlı bir platform</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Ürünler ayrı ayrı değil; ortak bir Core, ortak bir erişim mantığı ve ortak bir arayüz
          dili üzerinde çalışır.
        </p>
      </div>
      <div className="mt-12">
        <StatStrip items={HOME_STATS} />
      </div>
    </SectionShell>
  );
}
