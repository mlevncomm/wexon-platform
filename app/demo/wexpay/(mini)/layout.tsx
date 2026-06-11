import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WexPay Demo",
  description: "WexPay QR menü, sipariş ve ödeme deneyimini canlı simüle edin.",
  robots: { index: true, follow: true },
};

export default function WexPayMiniDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_55%),#020617] text-white antialiased">
      {children}
    </div>
  );
}
