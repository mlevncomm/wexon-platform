import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildModifierCartIdentity,
  moneyToMinor,
  minorToMoney,
  normalizeModifierOptionIds,
  priceOrderLine,
  resolveProductModifiers,
  sumPricedLinesSubtotal,
  type CatalogProductForOrder,
} from "./wexpay-order-pricing";
import { WexPayValidationError } from "./wexpay-validation-error";

function productFixture(overrides: Partial<CatalogProductForOrder> = {}): CatalogProductForOrder {
  const sizeGroup = {
    id: "g-size",
    branchId: "b1",
    name: "Boyut",
    selectionType: "SINGLE" as const,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 0,
    isActive: true,
    options: [
      {
        id: "opt-std",
        groupId: "g-size",
        name: "Standart",
        priceDelta: 0,
        sortOrder: 0,
        isActive: true,
      },
      {
        id: "opt-lg",
        groupId: "g-size",
        name: "Büyük",
        priceDelta: "25.00",
        sortOrder: 1,
        isActive: true,
      },
    ],
  };

  const extrasGroup = {
    id: "g-extra",
    branchId: "b1",
    name: "Ekstra",
    selectionType: "MULTI" as const,
    minSelect: 0,
    maxSelect: 2,
    sortOrder: 1,
    isActive: true,
    options: [
      {
        id: "opt-cheese",
        groupId: "g-extra",
        name: "Peynir",
        priceDelta: 10,
        sortOrder: 0,
        isActive: true,
      },
      {
        id: "opt-sauce",
        groupId: "g-extra",
        name: "Sos",
        priceDelta: 5,
        sortOrder: 1,
        isActive: true,
      },
      {
        id: "opt-inactive",
        groupId: "g-extra",
        name: "Pasif",
        priceDelta: 50,
        sortOrder: 2,
        isActive: false,
      },
    ],
  };

  return {
    id: "p1",
    branchId: "b1",
    name: "Burger",
    price: "100.00",
    isActive: true,
    inStock: true,
    productModifierGroups: [
      { groupId: "g-size", sortOrder: 0, isActive: true, group: sizeGroup },
      { groupId: "g-extra", sortOrder: 1, isActive: true, group: extrasGroup },
    ],
    ...overrides,
  };
}

describe("money minor units", () => {
  it("converts decimal strings without float drift for known values", () => {
    assert.equal(moneyToMinor("10.10"), 1010);
    assert.equal(minorToMoney(1010), 10.1);
    assert.equal(moneyToMinor(0.1 + 0.2), 30);
  });
});

describe("normalizeModifierOptionIds", () => {
  it("accepts empty / rejects duplicates", () => {
    assert.deepEqual(normalizeModifierOptionIds(undefined), []);
    assert.throws(() => normalizeModifierOptionIds(["a", "a"]), WexPayValidationError);
  });
});

describe("buildModifierCartIdentity", () => {
  it("is deterministic regardless of option order", () => {
    const a = buildModifierCartIdentity("p1", ["opt-lg", "opt-cheese"], " Az ");
    const b = buildModifierCartIdentity("p1", ["opt-cheese", "opt-lg"], "az");
    assert.equal(a, b);
  });

  it("changes when modifiers differ", () => {
    const plain = buildModifierCartIdentity("p1", ["opt-std"], "");
    const big = buildModifierCartIdentity("p1", ["opt-lg"], "");
    assert.notEqual(plain, big);
  });
});

describe("modifier validation + pricing", () => {
  it("prices products without modifiers when no required groups", () => {
    const product = productFixture({
      productModifierGroups: [],
    });
    const line = priceOrderLine({ product, branchId: "b1", quantity: 2 });
    assert.equal(line.unitPrice, 100);
    assert.equal(line.totalPrice, 200);
    assert.equal(line.modifiers.length, 0);
  });

  it("rejects missing required SINGLE selection", () => {
    assert.throws(
      () => priceOrderLine({ product: productFixture(), branchId: "b1", quantity: 1, modifierOptionIds: [] }),
      (error: unknown) => error instanceof WexPayValidationError && /Boyut/i.test(error.message),
    );
  });

  it("allows optional MULTI empty", () => {
    const line = priceOrderLine({
      product: productFixture(),
      branchId: "b1",
      quantity: 1,
      modifierOptionIds: ["opt-std"],
    });
    assert.equal(line.totalPrice, 100);
    assert.equal(line.modifiers.length, 1);
  });

  it("accepts SINGLE one selection", () => {
    const line = priceOrderLine({
      product: productFixture(),
      branchId: "b1",
      quantity: 1,
      modifierOptionIds: ["opt-lg"],
    });
    assert.equal(line.unitPrice, 100);
    assert.equal(line.totalPrice, 125);
    assert.equal(line.modifiers[0]?.optionName, "Büyük");
    assert.equal(line.modifiers[0]?.priceDelta, 25);
  });

  it("rejects SINGLE two selections", () => {
    assert.throws(
      () =>
        priceOrderLine({
          product: productFixture(),
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std", "opt-lg"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects MULTI below minSelect", () => {
    const product = productFixture();
    product.productModifierGroups[1]!.group.minSelect = 1;
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std"],
        }),
      (error: unknown) => error instanceof WexPayValidationError && /Ekstra/i.test(error.message),
    );
  });

  it("rejects MULTI above maxSelect", () => {
    const product = productFixture();
    product.productModifierGroups[1]!.group.maxSelect = 1;
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std", "opt-cheese", "opt-sauce"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects duplicate option IDs", () => {
    assert.throws(
      () =>
        priceOrderLine({
          product: productFixture(),
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std", "opt-std"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects unknown option", () => {
    assert.throws(
      () =>
        priceOrderLine({
          product: productFixture(),
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std", "opt-unknown"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects inactive option", () => {
    assert.throws(
      () =>
        priceOrderLine({
          product: productFixture(),
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std", "opt-inactive"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects inactive group", () => {
    const product = productFixture();
    product.productModifierGroups[0]!.group.isActive = false;
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects inactive product-group link", () => {
    const product = productFixture();
    product.productModifierGroups[0]!.isActive = false;
    // No required groups remain active → empty selection OK but opted id invalid
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std"],
        }),
      WexPayValidationError,
    );
    const ok = priceOrderLine({ product, branchId: "b1", quantity: 1, modifierOptionIds: [] });
    assert.equal(ok.totalPrice, 100);
  });

  it("rejects option belonging to another group identity mismatch", () => {
    const product = productFixture();
    product.productModifierGroups[0]!.group.options[0]!.groupId = "other-group";
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects option from another product catalog", () => {
    const product = productFixture({ productModifierGroups: [] });
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-lg"],
        }),
      WexPayValidationError,
    );
  });

  it("rejects option from another branch", () => {
    const product = productFixture();
    product.productModifierGroups[0]!.group.branchId = "b2";
    assert.throws(
      () =>
        priceOrderLine({
          product,
          branchId: "b1",
          quantity: 1,
          modifierOptionIds: ["opt-std"],
        }),
      WexPayValidationError,
    );
  });

  it("uses server priceDelta; ignores client money in pure pricing path", () => {
    const line = priceOrderLine({
      product: productFixture(),
      branchId: "b1",
      quantity: 2,
      modifierOptionIds: ["opt-lg", "opt-cheese"],
    });
    // base 100 + 25 + 10 = 135 × 2 = 270
    assert.equal(line.unitPrice, 100);
    assert.equal(line.totalPrice, 270);
    assert.equal(sumPricedLinesSubtotal([line]), 270);
  });

  it("keeps immutable snapshot fields independent of later catalog mutation objects", () => {
    const product = productFixture();
    const snaps = resolveProductModifiers(product, "b1", ["opt-lg"]);
    product.productModifierGroups[0]!.group.options[1]!.name = "XXL";
    product.productModifierGroups[0]!.group.options[1]!.priceDelta = 99;
    product.productModifierGroups[0]!.group.name = "Size";
    assert.equal(snaps[0]?.optionName, "Büyük");
    assert.equal(snaps[0]?.groupName, "Boyut");
    assert.equal(snaps[0]?.priceDelta, 25);
  });
});
