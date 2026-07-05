import type { Metadata } from "next";
import WexonRouteTransition from "@/components/wexon/WexonRouteTransition";
import "./globals.css";

const siteUrl = "https://www.wexon.dev";
const siteDescription =
  "Wexon; WexPay, WexHotel ve WexB2B ürünlerini tek Core lisans, abonelik ve erişim altyapısında birleştiren SaaS ekosistemidir.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Wexon",
  title: {
    default: "Wexon Dev - Wexon SaaS Platform",
    template: "%s | Wexon",
  },
  description: siteDescription,
  keywords: ["Wexon Dev", "Wexon", "WexPay", "WexHotel", "WexB2B", "SaaS", "QR menü", "otel yönetimi", "B2B satış"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: `${siteUrl}/`,
    siteName: "Wexon",
    title: "Wexon Dev - Wexon SaaS Platform",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Wexon Dev - Wexon SaaS Platform",
    description: siteDescription,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Wexon",
      alternateName: ["Wexon Dev", "wexon.dev"],
      url: `${siteUrl}/`,
      logo: `${siteUrl}/favicon.svg`,
      description: siteDescription,
      brand: [
        { "@type": "Brand", name: "Wexon" },
        { "@type": "Brand", name: "WexPay" },
        { "@type": "Brand", name: "WexHotel" },
        { "@type": "Brand", name: "WexB2B" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Wexon",
      alternateName: ["Wexon Dev", "wexon.dev", "WexPay", "WexHotel", "WexB2B"],
      url: `${siteUrl}/`,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "tr-TR",
    },
    {
      "@type": "ItemList",
      "@id": `${siteUrl}/#main-pages`,
      itemListElement: [
        { "@type": "SiteNavigationElement", position: 1, name: "WexPay", url: `${siteUrl}/products/wexpay` },
        { "@type": "SiteNavigationElement", position: 2, name: "WexHotel", url: `${siteUrl}/products/wexhotel` },
        { "@type": "SiteNavigationElement", position: 3, name: "WexB2B", url: `${siteUrl}/products/wexb2b` },
        { "@type": "SiteNavigationElement", position: 4, name: "Demo Talep Et", url: `${siteUrl}/demo-request` },
        { "@type": "SiteNavigationElement", position: 5, name: "İletişime geç", url: `${siteUrl}/contact` },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
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
