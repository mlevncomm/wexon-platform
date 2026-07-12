export function formatTry(value: number) {
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

export function cartStorageKey(qrCode: string) {
  return `wexon:qr-cart:${qrCode}`;
}
