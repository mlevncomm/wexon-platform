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
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[#04080f] text-[#f0f4f8] antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.14),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
