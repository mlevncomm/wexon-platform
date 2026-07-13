import type { CoreCapability, ProductAccent } from "@/types/wexon";
import { FeatureChip, SectionHeading, SectionShell } from "@/components/ui";

export default function RoadmapCapabilityGrid({
  capabilities,
  accent,
}: {
  capabilities: CoreCapability[];
  accent: ProductAccent;
}) {
  return (
    <SectionShell tone="canvas">
      <SectionHeading
        eyebrow="Planlanan Modüller"
        title="Bu ürün kapsamında planlanan ana modüller"
        subtitle="Aşağıdaki modüller lansman sürecinde geliştirilecek kapsamı temsil eder; nihai özellik listesi ön kayıt ve demo süreciyle netleşir."
      />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((cap) => (
          <FeatureChip
            key={cap.title}
            icon={cap.icon}
            title={cap.title}
            description={cap.description}
            accent={accent}
            layout="stack"
          />
        ))}
      </div>
    </SectionShell>
  );
}
