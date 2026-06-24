import type { Metadata } from "next";
import WexonRouteTransition from "@/components/wexon/WexonRouteTransition";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wexon - Premium SaaS Platform",
  description: "Wexon is a premium multi-product SaaS platform built for modern teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <WexonRouteTransition>{children}</WexonRouteTransition>
      </body>
    </html>
  );
}
