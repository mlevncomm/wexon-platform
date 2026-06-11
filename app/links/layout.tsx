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
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#060d18] text-[#f0f4f8] antialiased">
      {children}
    </div>
  );
}
