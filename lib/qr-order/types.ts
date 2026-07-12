export type QrView = "landing" | "menu" | "cart" | "success" | "bill";

export type QrProductBadge = "popular" | "spicy" | "vegetarian" | "new";

export type QrProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  isPopular?: boolean;
  badges?: QrProductBadge[];
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

export type QrOptionChoice = {
  id: string;
  label: string;
  priceDelta?: number;
};

export type QrOptionGroup = {
  id: string;
  label: string;
  required: boolean;
  multi: boolean;
  choices: QrOptionChoice[];
};

export type QrCartLine = {
  /** Stable key so same product with different options stays separate. */
  key: string;
  product: QrProduct;
  quantity: number;
  selectedOptions: Record<string, string[]>;
  note: string;
};

export type QrOrderSuccess = {
  orderId: string;
  orderNo: string;
  subtotal: number;
};

export type QrBillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderNo: string;
  status: string;
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
