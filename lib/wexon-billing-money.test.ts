import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExclusiveTax,
  majorFromMinor,
  minorFromMajor,
  parseMajorToMinor,
} from "@/lib/wexon-billing-money";
import { buildCheckoutQuote } from "@/lib/wexon-billing-tax-policy";

describe("wexon billing money", () => {
  it("converts TRY major/minor without floating drift on round trips", () => {
    assert.equal(minorFromMajor(7500), 750_000);
    assert.equal(majorFromMinor(750_000), 7500);
    assert.equal(parseMajorToMinor("20000"), 2_000_000);
  });

  it("computes EXCLUSIVE tax when enabled and zeros tax when disabled", () => {
    const enabled = computeExclusiveTax({
      netAmountMinor: 950_000,
      taxRateBps: 2000,
      taxEnabled: true,
    });
    assert.equal(enabled.taxAmountMinor, 190_000);
    assert.equal(enabled.grossAmountMinor, 1_140_000);

    const disabled = computeExclusiveTax({
      netAmountMinor: 950_000,
      taxRateBps: 2000,
      taxEnabled: false,
    });
    assert.equal(disabled.taxAmountMinor, 0);
    assert.equal(disabled.grossAmountMinor, 950_000);
  });

  it("splits subscription vs activation tax and keeps ledger line-item amounts separate", () => {
    const first = buildCheckoutQuote({
      subscriptionAmountMinor: 750_000,
      activationFeeAmountMinor: 2_000_000,
      currency: "TRY",
    });
    assert.equal(first.netAmountMinor, 2_750_000);
    assert.equal(first.taxEnabledAtPurchase, false);
    assert.equal(first.taxAmountMinor, 0);
    assert.equal(first.grossAmountMinor, 2_750_000);
    assert.equal(first.subscriptionTaxAmountMinor, 0);
    assert.equal(first.activationTaxAmountMinor, 0);
    assert.equal(first.activationGrossAmountMinor, 2_000_000);
    assert.equal(first.subscriptionGrossAmountMinor, 750_000);

    const renewal = buildCheckoutQuote({
      subscriptionAmountMinor: 750_000,
      activationFeeAmountMinor: 0,
    });
    assert.equal(renewal.grossAmountMinor, 750_000);
    assert.equal(renewal.activationGrossAmountMinor, 0);

    const taxed = buildCheckoutQuote({
      subscriptionAmountMinor: 750_000,
      activationFeeAmountMinor: 2_000_000,
      taxPolicy: { taxEnabled: true, taxRateBps: 2000, taxMode: "EXCLUSIVE" },
    });
    assert.equal(taxed.subscriptionTaxAmountMinor, 150_000);
    assert.equal(taxed.activationTaxAmountMinor, 400_000);
    assert.equal(taxed.taxAmountMinor, 550_000);
    assert.equal(taxed.grossAmountMinor, 3_300_000);
    assert.equal(taxed.activationGrossAmountMinor, 2_400_000);
    assert.equal(taxed.subscriptionGrossAmountMinor, 900_000);
    assert.equal(
      taxed.subscriptionTaxAmountMinor + taxed.activationTaxAmountMinor,
      taxed.taxAmountMinor,
    );
  });
});
