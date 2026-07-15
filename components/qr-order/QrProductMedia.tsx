"use client";

import { productVisual } from "@/components/qr-order/qr-theme";

export default function QrProductMedia({
  name,
  imageUrl,
  className = "h-24 w-24",
  large = false,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  large?: boolean;
}) {
  const visual = productVisual(name);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[22px] bg-gradient-to-br ${visual.gradient} ${className}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote restaurant URLs; Next/Image domains not configured per tenant
        <img src={imageUrl} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className={`font-black text-emerald-800/35 ${large ? "text-5xl" : "text-3xl"}`}>
            {visual.glyph}
          </span>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_55%)]" />
        </div>
      )}
    </div>
  );
}
