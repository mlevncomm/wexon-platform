import type { ReactNode } from "react";
import type { Viewport } from "next";

/**
 * Public WexPay routes (QR diner) — kit light surface (`--wx-surface`).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f6f8f7",
};

export default function WexPayPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qr-public-root flex min-h-[100dvh] w-full max-w-[100vw] flex-1 flex-col items-center overflow-x-hidden bg-wx-surface text-wx-ink antialiased">
      <div className="flex w-full max-w-[100vw] flex-1 flex-col items-center">{children}</div>
    </div>
  );
}
