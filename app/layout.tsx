import type { Metadata } from "next";
import WexonRouteTransition from "@/components/wexon/WexonRouteTransition";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wexon.dev"),
  title: {
    default: "Wexon - Premium SaaS Platform",
    template: "%s | Wexon",
  },
  description: "Wexon; WexPay, WexHotel ve WexB2B ürünlerini tek Core lisans, abonelik ve erişim altyapısında birleştiren SaaS ekosistemidir.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://www.wexon.dev/",
    siteName: "Wexon",
    title: "Wexon - Premium SaaS Platform",
    description: "WexPay ile başlayan, Wexon Core tarafından yönetilen çok ürünlü SaaS ekosistemi.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wexon - Premium SaaS Platform",
    description: "WexPay ile başlayan, Wexon Core tarafından yönetilen çok ürünlü SaaS ekosistemi.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <head>
        <link
          rel="preload"
          href="/fonts/Urbanist-VariableFont_wght.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <WexonRouteTransition>{children}</WexonRouteTransition>
      </body>
    </html>
  );
}
