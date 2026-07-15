import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartStorageKey } from "@/lib/qr-order/format";
import {
  buildCartLineKey,
  buildOrderNote,
  cartItemCount,
  cartSubtotal,
  lineTotal,
} from "@/lib/qr-order/pricing";
import type { QrCartLine, QrProduct } from "@/lib/qr-order/types";

const product: QrProduct = {
  id: "p1",
  name: "Classic Burger",
  description: null,
  price: 100,
  currency: "TRY",
};

describe("qr-order pricing", () => {
  it("computes catalog line totals without modifier deltas", () => {
    const line: QrCartLine = {
      key: "k1",
      product,
      quantity: 2,
      note: "",
    };
    assert.equal(lineTotal(line), 200);
  });

  it("sums cart subtotal and item count", () => {
    const lines: QrCartLine[] = [
      {
        key: "a",
        product,
        quantity: 1,
        note: "",
      },
      {
        key: "b",
        product: { ...product, id: "p2", price: 50 },
        quantity: 3,
        note: "",
      },
    ];
    assert.equal(cartSubtotal(lines), 250);
    assert.equal(cartItemCount(lines), 4);
  });

  it("builds order note from line and order notes", () => {
    const lines: QrCartLine[] = [
      {
        key: "a",
        product,
        quantity: 1,
        note: "Soğansız",
      },
    ];
    const note = buildOrderNote(lines, "Hızlı servis");
    assert.match(note ?? "", /Classic Burger/);
    assert.match(note ?? "", /Soğansız/);
    assert.match(note ?? "", /Hızlı servis/);
    assert.doesNotMatch(note ?? "", /Büyük|Ekstra peynir|priceDelta/i);
  });

  it("builds distinct cart keys for note differences", () => {
    const a = buildCartLineKey("p1", "");
    const b = buildCartLineKey("p1", "Soğansız");
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
