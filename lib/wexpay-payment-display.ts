export function formatWexPayPaymentProvider(provider: string | null | undefined): string {
  const normalized = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (!normalized || normalized === "manual") return "Manuel tahsilat";
  if (normalized === "paytr") return "PayTR sanal POS";
  return provider ?? "Operasyonel ödeme";
}

export function isPaytrPendingPayment(provider: string | null | undefined, status: string): boolean {
  return provider === "paytr" && status === "PENDING";
}
