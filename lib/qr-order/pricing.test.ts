import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartStorageKey } from "@/lib/qr-order/format";
import {
  catalogUnitPriceWithModifiers,
  productRequiresModifierSelection,
  toggleModifierOption,
  validateModifierSelections,
} from "@/lib/qr-order/modifiers";
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

const mercimek: QrProduct = {
  id: "soup",
  name: "Mercimek",
  description: null,
  price: 80,
  currency: "TRY",
  modifierGroups: [
    {
      id: "g1",
      name: "Boyut",
      selectionType: "SINGLE",
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      options: [
        { id: "opt-s", name: "Küçük", priceDelta: 0, sortOrder: 0 },
        { id: "opt-l", name: "Büyük", priceDelta: 25, sortOrder: 1 },
      ],
    },
  ],
};

describe("qr-order pricing", () => {
  it("computes catalog line totals with modifier deltas for display", () => {
    const line: QrCartLine = {
      key: "k1",
      product: mercimek,
      quantity: 2,
      note: "",
      modifierOptionIds: ["opt-l"],
    };
    assert.equal(lineTotal(line), 210);
  });

  it("sums cart subtotal and item count", () => {
    const lines: QrCartLine[] = [
      {
        key: "a",
        product,
        quantity: 1,
        note: "",
        modifierOptionIds: [],
      },
      {
        key: "b",
        product: { ...product, id: "p2", price: 50 },
        quantity: 3,
        note: "",
        modifierOptionIds: [],
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
        modifierOptionIds: [],
      },
    ];
    const note = buildOrderNote(lines, "Hızlı servis");
    assert.match(note ?? "", /Classic Burger/);
    assert.match(note ?? "", /Soğansız/);
    assert.match(note ?? "", /Hızlı servis/);
  });

  it("builds distinct cart keys for note differences", () => {
    const a = buildCartLineKey("p1", "");
    const b = buildCartLineKey("p1", "Soğansız");
    assert.notEqual(a, b);
  });

  it("builds same cart key when modifier option order differs", () => {
    const a = buildCartLineKey("p1", "", ["opt-b", "opt-a"]);
    const b = buildCartLineKey("p1", "", ["opt-a", "opt-b"]);
    assert.equal(a, b);
  });
});

describe("qr-order modifiers", () => {
  it("requires selection when minSelect > 0", () => {
    assert.equal(productRequiresModifierSelection(mercimek), true);
    assert.equal(productRequiresModifierSelection(product), false);
  });

  it("validates required single selection", () => {
    assert.match(validateModifierSelections(mercimek, []) ?? "", /en az 1/);
    assert.equal(validateModifierSelections(mercimek, ["opt-l"]), null);
    assert.equal(catalogUnitPriceWithModifiers(mercimek, ["opt-l"]), 105);
  });

  it("toggles single-select options", () => {
    const group = mercimek.modifierGroups![0];
    const afterFirst = toggleModifierOption(group, [], "opt-s");
    assert.deepEqual(afterFirst, ["opt-s"]);
    const afterSecond = toggleModifierOption(group, afterFirst, "opt-l");
    assert.deepEqual(afterSecond, ["opt-l"]);
  });
});

describe("qr-order cart key isolation", () => {
  it("scopes localStorage keys by qr token", () => {
    assert.equal(cartStorageKey("TABLE-A"), "wexon:qr-cart:TABLE-A");
    assert.equal(cartStorageKey("TABLE-B"), "wexon:qr-cart:TABLE-B");
    assert.notEqual(cartStorageKey("TABLE-A"), cartStorageKey("TABLE-B"));
  });
});
