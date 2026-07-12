import type { ReactNode } from "react";

/**
 * Public WexPay routes (QR diner, etc.) — light full-bleed canvas so the dark
 * root body background never shows at the edges.
 */
export default function WexPayPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qr-public-root min-h-[100dvh] w-full flex-1 bg-[#F6F8F5]">{children}</div>
  );
}
