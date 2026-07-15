import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrderStatus, PaymentStatus, TableStatus } from ".prisma/client";
import {
  buildTableBillWaves,
  calculateTableAccount,
  canCloseTableFromAccount,
  closeTableBlockReason,
  filterChargeableOrders,
  sumOrderItemsSubtotal,
} from "./wexpay-account";

function order(partial: {
  status: string;
  subtotal: number;
  receiptRequested?: boolean;
}) {
  return {
    status: partial.status,
    subtotal: partial.subtotal,
    receiptRequested: partial.receiptRequested ?? false,
  };
}

describe("active table bill aggregation", () => {
  it("sums multiple chargeable waves and excludes CANCELLED", () => {
    const account = calculateTableAccount({
      orders: [
        order({ status: OrderStatus.NEW, subtotal: 100 }),
        order({ status: OrderStatus.PREPARING, subtotal: 50 }),
        order({ status: OrderStatus.SERVED, subtotal: 25 }),
        order({ status: OrderStatus.CANCELLED, subtotal: 999 }),
      ],
      payments: [],
    });

    assert.equal(account.totalAmount, 175);
    assert.equal(account.remainingAmount, 175);
    assert.equal(account.hasOpenOrders, true);
    assert.equal(account.status, TableStatus.OCCUPIED);
  });

  it("computes remaining from server-side paid payments only", () => {
    const account = calculateTableAccount({
      orders: [
        order({ status: OrderStatus.SERVED, subtotal: 200 }),
        order({ status: OrderStatus.SERVED, subtotal: 40 }),
      ],
      payments: [
        { status: PaymentStatus.PAID, amount: 100 },
        { status: PaymentStatus.PENDING, amount: 40 },
      ],
    });

    assert.equal(account.totalAmount, 240);
    assert.equal(account.paidAmount, 100);
    assert.equal(account.remainingAmount, 140);
    assert.equal(account.hasOpenOrders, false);
    assert.equal(canCloseTableFromAccount(account), false);
    assert.match(closeTableBlockReason(account) ?? "", /Kalan ödeme|adisyon/i);
  });

  it("blocks close while NEW/PREPARING exist even if balance is zero", () => {
    const account = calculateTableAccount({
      orders: [order({ status: OrderStatus.PREPARING, subtotal: 0 })],
      payments: [],
    });
    assert.equal(account.hasOpenOrders, true);
    assert.equal(canCloseTableFromAccount(account), false);
    assert.match(closeTableBlockReason(account) ?? "", /NEW\/PREPARING|aktif/i);
  });

  it("does not treat missing payments (payment-request) as paid", () => {
    const before = calculateTableAccount({
      orders: [order({ status: OrderStatus.SERVED, subtotal: 80 })],
      payments: [],
    });
    // Notifications are not payments — account unchanged without Payment rows.
    const after = calculateTableAccount({
      orders: [order({ status: OrderStatus.SERVED, subtotal: 80 })],
      payments: [],
    });
    assert.equal(before.remainingAmount, after.remainingAmount);
    assert.equal(after.paidAmount, 0);
    assert.equal(canCloseTableFromAccount(after), false);
  });

  it("builds bill waves with server-side line math and skips CANCELLED", () => {
    const waves = buildTableBillWaves([
      {
        id: "o1",
        orderNo: "WXP-1",
        status: OrderStatus.SERVED,
        createdAt: new Date("2026-01-01T10:00:00Z"),
        subtotal: 999,
        note: null,
        items: [
          { id: "i1", productName: "Çay", quantity: 2, unitPrice: 15, totalPrice: 30 },
          { id: "i2", name: "Su", quantity: 1, unitPrice: 10, totalPrice: 10 },
        ],
      },
      {
        id: "o2",
        orderNo: "WXP-2",
        status: OrderStatus.NEW,
        createdAt: new Date("2026-01-01T10:05:00Z"),
        subtotal: 50,
        note: "ikinci dalga",
        items: [{ id: "i3", productName: "Kahve", quantity: 1, unitPrice: 50, totalPrice: 50 }],
      },
      {
        id: "o3",
        orderNo: "WXP-3",
        status: OrderStatus.CANCELLED,
        createdAt: new Date("2026-01-01T10:06:00Z"),
        subtotal: 100,
        items: [{ id: "i4", productName: "X", quantity: 1, unitPrice: 100, totalPrice: 100 }],
      },
    ]);

    assert.equal(waves.length, 2);
    assert.equal(waves[0].orderNo, "WXP-1");
    assert.equal(waves[0].subtotal, 40);
    assert.equal(waves[1].status, OrderStatus.NEW);
    assert.equal(filterChargeableOrders([{ status: "CANCELLED" }, { status: "NEW" }]).length, 1);
    assert.equal(sumOrderItemsSubtotal([{ quantity: 3, unitPrice: 12.5 }]), 37.5);
  });

  it("allows close when SERVED only and remaining is zero after real PAID", () => {
    const account = calculateTableAccount({
      orders: [order({ status: OrderStatus.SERVED, subtotal: 50 })],
      payments: [{ status: PaymentStatus.PAID, amount: 50 }],
    });
    assert.equal(canCloseTableFromAccount(account), true);
    assert.equal(closeTableBlockReason(account), null);
  });
});
