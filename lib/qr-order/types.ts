export type QrView = "landing" | "menu" | "cart" | "success" | "bill" | "status";

export type QrModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
};

export type QrModifierGroup = {
  id: string;
  name: string;
  selectionType: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: QrModifierOption[];
};

export type QrProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  isPopular?: boolean;
  /** Present only when the product has active linked modifier groups. */
  modifierGroups?: QrModifierGroup[];
};

export type QrCategory = {
  id: string;
  name: string;
  products: QrProduct[];
};

export type QrTableContext = {
  qrCode: string;
  restaurantName: string;
  branchName: string;
  tableLabel: string;
  tableStatus: string;
};

export type QrCartLine = {
  /** Stable key so same product with different notes stays separate. */
  key: string;
  product: QrProduct;
  quantity: number;
  note: string;
};

export type QrOrderStatus = "NEW" | "PREPARING" | "SERVED" | "CANCELLED";

export type QrOrderSuccess = {
  orderId: string;
  orderNo: string;
  subtotal: number;
  status: string;
};

export type QrBillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderNo: string;
  status: string;
  modifiers?: Array<{
    groupName: string;
    optionName: string;
    priceDelta: number;
    sortOrder: number;
  }>;
};

export type QrBillSnapshot = {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  lines: QrBillLine[];
  empty: boolean;
};

export type WaiterReason = "order_help" | "payment_help" | "table_clean" | "other";

export const WAITER_REASON_LABELS: Record<WaiterReason, string> = {
  order_help: "Sipariş için yardım",
  payment_help: "Ödeme için yardım",
  table_clean: "Masa temizliği",
  other: "Diğer",
};

export const ORDER_STATUS_LABELS: Record<QrOrderStatus, string> = {
  NEW: "Sipariş alındı",
  PREPARING: "Hazırlanıyor",
  SERVED: "Servis edildi",
  CANCELLED: "İptal edildi",
};

export function normalizeOrderStatus(value: string): QrOrderStatus | null {
  const upper = value.trim().toUpperCase();
  if (upper === "NEW" || upper === "PREPARING" || upper === "SERVED" || upper === "CANCELLED") {
    return upper;
  }
  return null;
}

export function orderStatusLabel(value: string): string {
  const normalized = normalizeOrderStatus(value);
  return normalized ? ORDER_STATUS_LABELS[normalized] : value;
}
