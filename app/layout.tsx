import type { Metadata } from "next";
import CookieConsentGate from "@/components/marketing/CookieConsentGate";
import WexonRouteTransition from "@/components/wexon/WexonRouteTransition";
import {
  WEXON_DEFAULT_DESCRIPTION,
  WEXON_DEFAULT_TITLE,
  WEXON_KEYWORDS,
  WEXON_SITE_NAME,
  WEXON_SITE_URL,
} from "@/lib/wexon-site-metadata";
import { WEXON_INSTAGRAM } from "@/lib/wexon/social-links";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(WEXON_SITE_URL),
  applicationName: WEXON_SITE_NAME,
  title: {
    default: WEXON_DEFAULT_TITLE,
    template: `%s | ${WEXON_SITE_NAME}`,
  },
  description: WEXON_DEFAULT_DESCRIPTION,
  keywords: [...WEXON_KEYWORDS],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "48x48", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: `${WEXON_SITE_URL}/`,
    siteName: WEXON_SITE_NAME,
    title: WEXON_DEFAULT_TITLE,
    description: WEXON_DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: WEXON_DEFAULT_TITLE,
    description: WEXON_DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${WEXON_SITE_URL}/#organization`,
      name: WEXON_SITE_NAME,
      alternateName: ["wexon.dev", "WexPay", "WexHotel", "WexB2B"],
      url: `${WEXON_SITE_URL}/`,
      logo: `${WEXON_SITE_URL}/apple-icon`,
      description: WEXON_DEFAULT_DESCRIPTION,
      sameAs: [WEXON_INSTAGRAM.href],
      brand: [
        { "@type": "Brand", name: "Wexon" },
        { "@type": "Brand", name: "WexPay" },
        { "@type": "Brand", name: "WexHotel" },
        { "@type": "Brand", name: "WexB2B" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${WEXON_SITE_URL}/#website`,
      name: WEXON_SITE_NAME,
      alternateName: ["wexon.dev", "WexPay", "WexHotel", "WexB2B"],
      url: `${WEXON_SITE_URL}/`,
      publisher: { "@id": `${WEXON_SITE_URL}/#organization` },
      inLanguage: "tr-TR",
    },
    {
      "@type": "ItemList",
      "@id": `${WEXON_SITE_URL}/#main-pages`,
      itemListElement: [
        { "@type": "SiteNavigationElement", position: 1, name: "WexPay", url: `${WEXON_SITE_URL}/products/wexpay` },
        { "@type": "SiteNavigationElement", position: 2, name: "WexHotel", url: `${WEXON_SITE_URL}/products/wexhotel` },
        { "@type": "SiteNavigationElement", position: 3, name: "WexB2B", url: `${WEXON_SITE_URL}/products/wexb2b` },
        { "@type": "SiteNavigationElement", position: 4, name: "Demo Talep Et", url: `${WEXON_SITE_URL}/demo-request` },
        { "@type": "SiteNavigationElement", position: 5, name: "İletişim", url: `${WEXON_SITE_URL}/contact` },
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
        <CookieConsentGate />
      </body>
    </html>
  );
}
