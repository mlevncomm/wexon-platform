import type { ReactNode } from "react";
import type { Viewport } from "next";

/**
 * Public WexPay routes (QR diner, etc.) — light cool-gray canvas.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F5F7FB",
};

export default function WexPayPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qr-public-root flex min-h-[100dvh] w-full max-w-[100vw] flex-1 flex-col items-center overflow-x-hidden bg-[#F5F7FB] text-slate-950 antialiased">
      <div className="flex w-full max-w-[100vw] flex-1 flex-col items-center">{children}</div>
    </div>
  );
}
