import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_NOTE_MAX_LENGTH,
  validateOrderItems,
  validatePublicNote,
  WexPayValidationError,
} from "./wexpay-validation";

describe("validateOrderItems", () => {
  it("accepts productId + quantity only", () => {
    const items = validateOrderItems([{ productId: "p1", quantity: 2 }]);
    assert.deepEqual(items, [{ productId: "p1", quantity: 2 }]);
  });

  it("rejects client price manipulation fields", () => {
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, unitPrice: 1 }]),
      (error: unknown) => error instanceof WexPayValidationError && /Fiyat alanı/i.test(error.message),
    );
    assert.throws(
      () => validateOrderItems([{ productId: "p1", quantity: 1, price: 9.99 }]),
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
