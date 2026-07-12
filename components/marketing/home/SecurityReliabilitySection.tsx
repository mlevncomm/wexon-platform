import { SECURITY_ITEMS } from "@/lib/wexon-home-content";
import SectionShell from "@/components/ui/SectionShell";
import SectionHeading from "./SectionHeading";
import { WexonIcon } from "./icons";

export default function SecurityReliabilitySection() {
  return (
    <SectionShell tone="white" width="wide">
      <SectionHeading
        eyebrow="Güven & altyapı"
        title={
          <>
            Kontrollü erişim, izlenebilir operasyon,{" "}
            <span className="text-emerald-600">güvenli altyapı</span>
          </>
        }
        subtitle="Wexon'da erişim kararları lisans ve entitlement mantığına dayanır; ödeme, fatura ve kullanıcı süreçleri merkezi olarak izlenebilir."
      />

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY_ITEMS.map((item) => (
          <article
            key={item.title}
            className="wx-lift rounded-[24px] border border-slate-200 bg-white p-6 hover:border-emerald-200"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-emerald-400">
              <WexonIcon name={item.icon} size={20} />
            </div>
            <h3 className="mt-4 text-[15px] font-bold tracking-tight text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
