import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WexPay Demo",
  description: "WexPay QR menü, sipariş ve ödeme deneyimini canlı simüle edin.",
  robots: { index: true, follow: true },
};

export default function WexPayMiniDemoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh overflow-x-hidden bg-[#f6f8f7] antialiased">{children}</div>;
}
