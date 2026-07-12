import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartStorageKey } from "@/lib/qr-order/format";
import {
  buildCartLineKey,
  buildOrderNote,
  cartItemCount,
  cartSubtotal,
  lineTotal,
  validateRequiredOptions,
} from "@/lib/qr-order/pricing";
import type { QrCartLine, QrOptionGroup, QrProduct } from "@/lib/qr-order/types";

const product: QrProduct = {
  id: "p1",
  name: "Classic Burger",
  description: null,
  price: 100,
  currency: "TRY",
};

const groups: QrOptionGroup[] = [
  {
    id: "size",
    label: "Porsiyon",
    required: true,
    multi: false,
    choices: [
      { id: "regular", label: "Standart" },
      { id: "large", label: "Büyük", priceDelta: 20 },
    ],
  },
];

describe("qr-order pricing", () => {
  it("computes line total with option deltas", () => {
    const line: QrCartLine = {
      key: "k1",
      product,
      quantity: 2,
      selectedOptions: { size: ["large"] },
      note: "",
    };
    assert.equal(lineTotal(line, groups), 240);
  });

  it("sums cart subtotal and item count", () => {
    const lines: QrCartLine[] = [
      {
        key: "a",
        product,
        quantity: 1,
        selectedOptions: { size: ["regular"] },
        note: "",
      },
      {
        key: "b",
        product: { ...product, id: "p2", price: 50 },
        quantity: 3,
        selectedOptions: {},
        note: "",
      },
    ];
    assert.equal(cartSubtotal(lines, { p1: groups }), 250);
    assert.equal(cartItemCount(lines), 4);
  });

  it("validates required options", () => {
    assert.equal(validateRequiredOptions({ size: [] }, groups), "Porsiyon seçimi zorunludur.");
    assert.equal(validateRequiredOptions({ size: ["regular"] }, groups), null);
  });

  it("builds order note from options and line notes", () => {
    const lines: QrCartLine[] = [
      {
        key: "a",
        product,
        quantity: 1,
        selectedOptions: { size: ["large"] },
        note: "Soğansız",
      },
    ];
    const note = buildOrderNote(lines, { p1: groups }, "Hızlı servis");
    assert.match(note ?? "", /Classic Burger/);
    assert.match(note ?? "", /Büyük/);
    assert.match(note ?? "", /Soğansız/);
    assert.match(note ?? "", /Hızlı servis/);
  });

  it("builds distinct cart keys for option differences", () => {
    const a = buildCartLineKey("p1", { size: ["regular"] }, "");
    const b = buildCartLineKey("p1", { size: ["large"] }, "");
    assert.notEqual(a, b);
  });
});

describe("qr-order cart key isolation", () => {
  it("scopes localStorage keys by qr token", () => {
    assert.equal(cartStorageKey("TABLE-A"), "wexon:qr-cart:TABLE-A");
    assert.equal(cartStorageKey("TABLE-B"), "wexon:qr-cart:TABLE-B");
    assert.notEqual(cartStorageKey("TABLE-A"), cartStorageKey("TABLE-B"));
  });
});
