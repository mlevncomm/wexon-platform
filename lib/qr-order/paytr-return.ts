import type { QrPaytrReturn } from "@/lib/qr-order/types";

/** Pure banner copy for PayTR guest return params (no network). */
export function resolvePaytrReturnBanner(paytrReturn: QrPaytrReturn | null | undefined): string | null {
  if (!paytrReturn) return null;
  if (paytrReturn.result === "failed") {
    return "Online ödeme tamamlanamadı. İsterseniz tekrar deneyin veya restorandan ödeyin.";
  }
  if (!paytrReturn.paymentId) {
    return "Ödeme dönüşü alındı. Onay için lütfen personelle teyit edin veya hesabı yenileyin.";
  }
  return "Ödeme sonucu kontrol ediliyor…";
}
