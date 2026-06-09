import { NotificationType } from ".prisma/client";
import { prisma } from "@/lib/prisma";

export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function createMenuNotification({
  branchId,
  title,
  message,
}: {
  branchId: string;
  title: string;
  message: string;
}) {
  return prisma.businessNotification.create({
    data: {
      branchId,
      title,
      message,
      type: NotificationType.MENU_UPDATED,
    },
  });
}

export function toOrderResponse(order: {
  id: string;
  orderNo: string;
  status: string;
  note: string | null;
  subtotal: unknown;
  receiptRequested: boolean;
  createdAt: Date;
  table: {
    id: string;
    label: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: unknown;
    totalPrice: unknown;
  }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNo,
    status: order.status,
    note: order.note,
    totalAmount: Number(order.subtotal),
    receiptRequested: order.receiptRequested,
    createdAt: order.createdAt.toISOString(),
    table: {
      id: order.table.id,
      name: order.table.label,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.productName,
      quantity: item.quantity,
      price: Number(item.unitPrice),
      lineTotal: Number(item.totalPrice),
    })),
  };
}

export function toPaymentResponse(payment: {
  id: string;
  amount: unknown;
  status: string;
  provider: string | null;
  providerRef: string | null;
  receiptRequested: boolean;
  createdAt: Date;
  table: {
    id: string;
    label: string;
  };
  order: {
    id: string;
    orderNo: string;
  } | null;
}) {
  return {
    id: payment.id,
    amount: Number(payment.amount),
    status: payment.status,
    provider: payment.provider,
    transactionId: payment.providerRef,
    receiptRequested: payment.receiptRequested,
    createdAt: payment.createdAt.toISOString(),
    table: {
      id: payment.table.id,
      name: payment.table.label,
    },
    order: payment.order
      ? {
          id: payment.order.id,
          orderNumber: payment.order.orderNo,
        }
      : null,
  };
}

export function toTableResponse(table: {
  id: string;
  label: string;
  qrCode: string;
  status: string;
  orders: Array<{
    id: string;
    orderNo: string;
    status: string;
    note: string | null;
    subtotal: unknown;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: unknown;
      totalPrice: unknown;
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: unknown;
    status: string;
    provider: string | null;
    providerRef: string | null;
    receiptRequested: boolean;
    createdAt: Date;
  }>;
  receiptRequests: Array<{
    status: string;
  }>;
}) {
  const isOperationallyEmpty = table.status === "EMPTY" || table.status === "CLOSED";
  const activeOrders = isOperationallyEmpty
    ? []
    : table.orders.filter((order) => order.status !== "CANCELLED");
  const operationalPayments = isOperationallyEmpty ? [] : table.payments;
  const paidPayments = operationalPayments.filter(
    (payment) => payment.status === "PAID" || payment.status === "SUCCEEDED",
  );
  const totalAmount = activeOrders.reduce((sum, order) => sum + Number(order.subtotal), 0);
  const paidAmount = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const receiptRequested =
    !isOperationallyEmpty &&
    (table.receiptRequests.some((request) => request.status === "REQUESTED") ||
      operationalPayments.some((payment) => payment.receiptRequested));

  return {
    id: table.id,
    name: table.label,
    code: table.label,
    status: table.status,
    qrToken: table.qrCode,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(totalAmount - paidAmount, 0),
    receiptRequested,
    activeOrders: activeOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNo,
      status: order.status,
      totalAmount: Number(order.subtotal),
      note: order.note,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.productName,
        quantity: item.quantity,
        price: Number(item.unitPrice),
        lineTotal: Number(item.totalPrice),
      })),
    })),
    payments: operationalPayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      provider: payment.provider,
      transactionId: payment.providerRef,
      receiptRequested: payment.receiptRequested,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export function toProductResponse(product: {
  id: string;
  name: string;
  description: string | null;
  price: unknown;
  imageUrl: string | null;
  isActive: boolean;
  inStock: boolean;
  isPopular: boolean;
  categoryId: string;
  category: { name: string };
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    inStock: product.inStock,
    isPopular: product.isPopular,
    categoryId: product.categoryId,
    categoryName: product.category.name,
  };
}
