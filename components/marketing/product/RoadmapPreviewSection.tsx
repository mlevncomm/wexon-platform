import type { ReactNode } from "react";
import { SectionHeading, SectionShell } from "@/components/ui";

export default function RoadmapPreviewSection({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SectionShell tone="subtle" width="wide">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <div className="mx-auto mt-12 max-w-5xl">{children}</div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
        Örnek arayüz — lansmanda güncellenebilir. Gerçek operasyonda veriler ilgili ürün ve Wexon Core üzerinden gelir.
      </p>
    </SectionShell>
  );
}
