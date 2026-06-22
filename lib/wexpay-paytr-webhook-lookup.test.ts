import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePaytrWebhookPaymentCandidates } from "./wexpay-paytr-webhook-lookup";

function candidate(id: string, organizationId: string | null) {
  return {
    id,
    branch: { restaurant: { organizationId } },
  } as Parameters<typeof resolvePaytrWebhookPaymentCandidates>[0][number];
}

describe("resolvePaytrWebhookPaymentCandidates", () => {
  it("returns payment_not_found when empty", () => {
    const result = resolvePaytrWebhookPaymentCandidates([]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "payment_not_found");
  });

  it("returns ambiguous_payment_ref when multiple candidates", () => {
    const result = resolvePaytrWebhookPaymentCandidates([
      candidate("p1", "org-1"),
      candidate("p2", "org-2"),
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "ambiguous_payment_ref");
  });

  it("returns tenant_unresolvable when organizationId missing", () => {
    const result = resolvePaytrWebhookPaymentCandidates([candidate("p1", null)]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "tenant_unresolvable");
  });

  it("returns unique payment when single candidate has tenant", () => {
    const result = resolvePaytrWebhookPaymentCandidates([candidate("p1", "org-1")]);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.payment.id, "p1");
  });
});
