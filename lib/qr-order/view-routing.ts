import type { QrPaytrReturn, QrView } from "@/lib/qr-order/types";

/** Initial guest view: PayTR return → bill; otherwise choice landing. */
export function getInitialQrView(initialPaytrReturn: QrPaytrReturn | null | undefined): QrView {
  return initialPaytrReturn ? "bill" : "landing";
}

/** Bottom nav only after leaving the choice landing. */
export function shouldShowQrBottomNav(view: QrView): boolean {
  return view === "menu" || view === "status" || view === "bill";
}
