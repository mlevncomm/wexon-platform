import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseModifierGroupCreate,
  parseModifierOptionCreate,
  parseTableBulkCreate,
  PUBLIC_NOTE_MAX_LENGTH,
  validateOrderItems,
  validatePublicNote,
  WexPayValidationError,
} from "./wexpay-validation";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("validateOrderItems", () => {
  it("accepts productId + quantity only", () => {
    const items = validateOrderItems([{ productId: "p1", quantity: 2 }]);
    assert.deepEqual(items, [{ productId: "p1", quantity: 2 }]);
  });

  it("accepts modifierOptionIds", () => {
    const items = validateOrderItems([{ productId: "p1", quantity: 1, modifierOptionIds: ["o1", "o2"] }]);
    assert.deepEqual(items, [{ productId: "p1", quantity: 1, modifierOptionIds: ["o1", "o2"] }]);
  });

  it("rejects client price manipulation fields", () => {
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, unitPrice: 1 }]),
      (error: unknown) => error instanceof WexPayValidationError && /Fiyat|seçenek/i.test(error.message),
    );
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, price: 9.99 }]),
      WexPayValidationError,
    );
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, priceDelta: 5 }]),
      WexPayValidationError,
    );
  });

  it("rejects duplicate modifier option ids in payload", () => {
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, modifierOptionIds: ["o1", "o1"] }]),
      WexPayValidationError,
    );
  });

  it("rejects empty and oversized carts", () => {
    assert.throws(() => validateOrderItems([]), WexPayValidationError);
    assert.throws(
      () => validateOrderItems(Array.from({ length: 51 }, (_, i) => ({ productId: `p${i}`, quantity: 1 }))),
      WexPayValidationError,
    );
  });

  it("rejects invalid quantities", () => {
    assert.throws(() => validateOrderItems([{ productId: "p1", quantity: 0 }]), WexPayValidationError);
    assert.throws(() => validateOrderItems([{ productId: "p1", quantity: 1.5 }]), WexPayValidationError);
  });
});

describe("validatePublicNote", () => {
  it("returns null for empty notes", () => {
    assert.equal(validatePublicNote(null), null);
    assert.equal(validatePublicNote("   "), null);
  });

  it("trims and accepts bounded notes", () => {
    assert.equal(validatePublicNote("  Az acılı  "), "Az acılı");
  });

  it("rejects oversized notes", () => {
    assert.throws(
      () => validatePublicNote("x".repeat(PUBLIC_NOTE_MAX_LENGTH + 1)),
      WexPayValidationError,
    );
  });
});

describe("parseTableBulkCreate", () => {
  it("accepts bounded bulk create input", () => {
    const parsed = parseTableBulkCreate(
      form({
        branchId: "br_1",
        prefix: "Masa",
        count: "12",
        seats: "4",
        startNumber: "3",
      }),
    );
    assert.deepEqual(parsed, {
      branchId: "br_1",
      prefix: "Masa",
      count: 12,
      seats: 4,
      startNumber: 3,
    });
  });

  it("rejects count outside 1-50", () => {
    assert.throws(
      () => parseTableBulkCreate(form({ branchId: "br_1", prefix: "Masa", count: "0" })),
      WexPayValidationError,
    );
    assert.throws(
      () => parseTableBulkCreate(form({ branchId: "br_1", prefix: "Masa", count: "51" })),
      WexPayValidationError,
    );
  });

  it("rejects invalid seats and startNumber", () => {
    assert.throws(
      () => parseTableBulkCreate(form({ branchId: "br_1", prefix: "Masa", count: "2", seats: "0" })),
      WexPayValidationError,
    );
    assert.throws(
      () =>
        parseTableBulkCreate(
          form({ branchId: "br_1", prefix: "Masa", count: "2", startNumber: "10000" }),
        ),
      WexPayValidationError,
    );
  });
});

describe("parseModifierGroupCreate / option create", () => {
  it("forces SINGLE maxSelect to 1", () => {
    const parsed = parseModifierGroupCreate(
      form({
        branchId: "br_1",
        name: "Boyut",
        selectionType: "SINGLE",
        minSelect: "1",
        maxSelect: "5",
      }),
    );
    assert.equal(parsed.selectionType, "SINGLE");
    assert.equal(parsed.minSelect, 1);
    assert.equal(parsed.maxSelect, 1);
  });

  it("rejects MULTI when minSelect exceeds maxSelect", () => {
    assert.throws(
      () =>
        parseModifierGroupCreate(
          form({
            branchId: "br_1",
            name: "Ekstralar",
            selectionType: "MULTI",
            minSelect: "3",
            maxSelect: "2",
          }),
        ),
      WexPayValidationError,
    );
  });

  it("parses non-negative option priceDelta", () => {
    const parsed = parseModifierOptionCreate(
      form({ groupId: "g1", name: "Extra cheese", priceDelta: "12,5" }),
    );
    assert.deepEqual(parsed, { groupId: "g1", name: "Extra cheese", priceDelta: 12.5 });
  });
});
