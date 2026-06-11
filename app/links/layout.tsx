import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WexPay Links",
  description:
    "Restoranlar için QR menü, sipariş ve ödeme. WexPay demo ve bağlantılar tek yerde.",
  openGraph: {
    title: "WexPay Links",
    description: "QR menü, sipariş ve ödeme deneyimi — WexPay bağlantı merkezi.",
    type: "website",
  },
};

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f6f8f7] text-slate-950 antialiased">
      {children}
    </div>
  );
}
