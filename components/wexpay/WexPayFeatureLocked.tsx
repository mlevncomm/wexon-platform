import type { ReactNode } from "react";
import Link from "next/link";
import { WexPayEmptyNotice, WexPayPanel } from "@/components/wexpay/WexPayBusinessUI";
import { coreNavigationUrl } from "@/lib/wexon/urls";

export function WexPayFeatureLockedPanel({
  title,
  featureLabel,
  description,
  organizationId,
}: {
  title: string;
  featureLabel: string;
  description?: string;
  organizationId?: string | null;
}) {
  const upgradeHref = organizationId
    ? coreNavigationUrl("/dashboard", `organizationId=${encodeURIComponent(organizationId)}`)
    : coreNavigationUrl("/dashboard");

  return (
    <WexPayPanel title={title} description={description ?? "Bu özellik mevcut paketinizde kapalı."}>
      <WexPayEmptyNotice
        action={
          <Link
            href={upgradeHref}
            className="inline-flex rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-500/25"
          >
            Paketi incele
          </Link>
        }
      >
        <span className="font-black text-slate-700">{featureLabel}</span> paketinizde yer almıyor. Growth
        veya üzeri pakete yükselterek açabilirsiniz.
      </WexPayEmptyNotice>
    </WexPayPanel>
  );
}

export function WexPayFeatureHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-950">
      {children}
    </div>
  );
}
