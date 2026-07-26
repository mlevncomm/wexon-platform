import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_INVOICE_MUTATION_LOCK_NAMESPACE,
  ADMIN_ORG_PRODUCT_COMMERCIAL_CREATE_LOCK_NAMESPACE,
  assertSubscriptionCreateStatus,
  mapSubscriptionCreateStatusToLicenseStatus,
  SUBSCRIPTION_CREATE_STATUSES,
} from "@/lib/wexon-admin-finance-operations";
import { AdminValidationError } from "@/lib/wexon-admin-validation";

describe("admin finance operations policy", () => {
  it("exposes invoice and commercial-create lock namespaces", () => {
    assert.equal(ADMIN_INVOICE_MUTATION_LOCK_NAMESPACE, "admin:invoice-mutation");
    assert.equal(
      ADMIN_ORG_PRODUCT_COMMERCIAL_CREATE_LOCK_NAMESPACE,
      "admin:organization-product-commercial-create",
    );
  });

  it("limits subscription create statuses to TRIALING/ACTIVE", () => {
    assert.deepEqual([...SUBSCRIPTION_CREATE_STATUSES], ["ACTIVE", "TRIALING"]);
    assert.doesNotThrow(() => assertSubscriptionCreateStatus("ACTIVE"));
    assert.doesNotThrow(() => assertSubscriptionCreateStatus("TRIALING"));
    assert.throws(() => assertSubscriptionCreateStatus("CANCELLED"), AdminValidationError);
    assert.throws(() => assertSubscriptionCreateStatus("PAST_DUE"), AdminValidationError);
    assert.throws(() => assertSubscriptionCreateStatus("EXPIRED"), AdminValidationError);
  });

  it("maps create statuses to license statuses", () => {
    assert.equal(mapSubscriptionCreateStatusToLicenseStatus("ACTIVE"), "ACTIVE");
    assert.equal(mapSubscriptionCreateStatusToLicenseStatus("TRIALING"), "TRIAL");
  });
});
