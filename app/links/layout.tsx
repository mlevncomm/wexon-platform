import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wexon All Links",
  description:
    "Wexon Core, WexPay, WexHotel ve WexB2B bağlantıları tek yerde. Çok ürünlü SaaS ekosistemi.",
  openGraph: {
    title: "Wexon All Links",
    description:
      "Wexon Core, WexPay, WexHotel ve WexB2B bağlantıları tek yerde.",
    type: "website",
  },
};

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden text-[#f0f4f8] antialiased">
      {/* Yeşil → siyah ana zemin */}
      <div
        className="pointer-events-none fixed inset-0 bg-[#020604]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-8%,rgba(16,185,129,0.38)_0%,rgba(6,78,59,0.18)_32%,transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_55%_45%_at_12%_18%,rgba(20,184,166,0.14)_0%,transparent_62%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_55%_45%_at_88%_22%,rgba(5,150,105,0.12)_0%,transparent_62%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,#0a1f17_0%,#061410_22%,#030a08_52%,#010403_78%,#000000_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(16,185,129,0.07)_0%,transparent_55%)]"
        aria-hidden
      />
      {/* Kenar vignette — siyah derinlik */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_35%,rgba(0,0,0,0.55)_100%)]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
