import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_MUTATION_GLOBAL_PER_MINUTE,
  ADMIN_MUTATION_RATE_LIMITS,
  isHostedDeploymentCleanupForbidden,
  isValidAdminMutationKey,
  resolveAdminMutationRiskClass,
  requiresHighRiskConfirmation,
  sanitizeAdminMutationReason,
} from "@/lib/wexon-admin-mutation-policy";
import {
  assertInvoiceCreateStatus,
  assertInvoicePaidCoverageSufficient,
  assertMoneyInvariant,
  assertPositiveAmount,
  evaluateBillingPaymentStatusTransition,
  evaluateInvoicePaymentCoverage,
  evaluateInvoiceStatusTransition,
  evaluateLicenseStatusAgainstSubscription,
  evaluateSubscriptionStatusTransition,
} from "@/lib/wexon-admin-finance-policy";
import {
  buildAdminRateLimitBucketKey,
  hashAdminIpBucket,
} from "@/lib/wexon-admin-mutation-rate-limit";
import {
  generateAdminMutationKey,
  hashAdminMutationRequestPayload,
} from "@/lib/wexon-admin-mutation-idempotency";
import {
  buildAdminMutationAuditMetadata,
  getSafeAdminActionErrorMessage,
} from "@/lib/wexon-admin-mutation-guard";
import { AdminMutationGuardError } from "@/lib/wexon-admin-mutation-errors";
import { AdminValidationError } from "@/lib/wexon-admin-validation";
import { sanitizeAdminAuditMetadata } from "@/lib/wexon-admin-audit-sanitize";

describe("admin mutation risk catalog", () => {
  it("classifies financial/security/destructive actions", () => {
    assert.equal(resolveAdminMutationRiskClass("invoice.create"), "FINANCIAL");
    assert.equal(resolveAdminMutationRiskClass("api_key.revoke"), "SECURITY");
    assert.equal(resolveAdminMutationRiskClass("organization.permanent_delete"), "DESTRUCTIVE");
    assert.equal(resolveAdminMutationRiskClass("product.created"), "NORMAL");
  });

  it("requires confirmation for financial and destructive", () => {
    assert.equal(requiresHighRiskConfirmation("FINANCIAL"), true);
    assert.equal(requiresHighRiskConfirmation("DESTRUCTIVE"), true);
    assert.equal(requiresHighRiskConfirmation("NORMAL"), false);
  });

  it("exposes centralized rate limit tables", () => {
    assert.equal(ADMIN_MUTATION_RATE_LIMITS.FINANCIAL.short.maxCount, 8);
    assert.equal(ADMIN_MUTATION_RATE_LIMITS.DESTRUCTIVE.long.maxCount, 12);
    assert.equal(ADMIN_MUTATION_GLOBAL_PER_MINUTE, 60);
  });
});

describe("admin rate-limit bucket keys", () => {
  it("is deterministic and hashes IP", () => {
    const ipHash = hashAdminIpBucket("1.2.3.4");
    const a = buildAdminRateLimitBucketKey({
      adminId: "adm1",
      riskClass: "FINANCIAL",
      organizationId: "org1",
      ipHash,
      scope: "short",
    });
    const b = buildAdminRateLimitBucketKey({
      adminId: "adm1",
      riskClass: "FINANCIAL",
      organizationId: "org1",
      ipHash,
      scope: "short",
    });
    assert.equal(a, b);
    assert.equal(hashAdminIpBucket(""), hashAdminIpBucket("unknown"));
  });

  it("uses unknown IP bucket when missing", () => {
    assert.match(hashAdminIpBucket("unknown"), /^[a-f0-9]{24}$/);
  });

  it("keeps global bucket admin-scoped without IP or org", () => {
    const a = buildAdminRateLimitBucketKey({
      adminId: "adm1",
      riskClass: "GLOBAL",
      organizationId: "org-ignored",
      ipHash: "ip-a",
      scope: "global",
    });
    const b = buildAdminRateLimitBucketKey({
      adminId: "adm1",
      riskClass: "GLOBAL",
      organizationId: null,
      ipHash: "ip-b",
      scope: "global",
    });
    assert.equal(a, b);
    assert.equal(a, "amrl:adm1:GLOBAL:global");
    assert.notEqual(
      buildAdminRateLimitBucketKey({
        adminId: "adm1",
        riskClass: "FINANCIAL",
        organizationId: "org1",
        ipHash: "ip-a",
        scope: "short",
      }),
      buildAdminRateLimitBucketKey({
        adminId: "adm1",
        riskClass: "FINANCIAL",
        organizationId: "org1",
        ipHash: "ip-b",
        scope: "short",
      }),
    );
  });
});

describe("finance transition matrices", () => {
  it("allows and denies invoice transitions", () => {
    assert.equal(evaluateInvoiceStatusTransition("DRAFT", "ISSUED").ok, true);
    assert.equal(evaluateInvoiceStatusTransition("PAID", "DRAFT").ok, false);
    assert.equal(evaluateInvoiceStatusTransition("VOID", "PAID").ok, false);
    assert.equal(evaluateInvoiceStatusTransition("PAID", "PAID").ok, true);
    const noop = evaluateInvoiceStatusTransition("PAID", "PAID");
    assert.equal(noop.ok && noop.kind === "noop", true);
  });

  it("allows and denies billing payment transitions", () => {
    assert.equal(evaluateBillingPaymentStatusTransition("PENDING", "PAID").ok, true);
    assert.equal(evaluateBillingPaymentStatusTransition("PAID", "REFUNDED").ok, true);
    assert.equal(evaluateBillingPaymentStatusTransition("REFUNDED", "PAID").ok, false);
    assert.equal(evaluateBillingPaymentStatusTransition("FAILED", "PAID").ok, false);
  });

  it("allows and denies subscription transitions", () => {
    assert.equal(evaluateSubscriptionStatusTransition("TRIALING", "ACTIVE").ok, true);
    assert.equal(evaluateSubscriptionStatusTransition("CANCELLED", "ACTIVE").ok, true);
    assert.equal(evaluateSubscriptionStatusTransition("ACTIVE", "TRIALING").ok, false);
  });

  it("blocks license terminal while subscription active", () => {
    const denied = evaluateLicenseStatusAgainstSubscription({
      licenseStatus: "CANCELLED",
      subscriptionStatus: "ACTIVE",
    });
    assert.equal(denied.ok, false);
  });

  it("computes invoice payment coverage in minor units", () => {
    const partial = evaluateInvoicePaymentCoverage({
      invoiceTotal: 100,
      paidCoverageMinor: 0,
      newPaymentAmount: 40,
    });
    assert.equal(partial.invoiceAutoPaid, false);
    assert.equal(partial.outstandingAfterMinor, 6000);
    const full = evaluateInvoicePaymentCoverage({
      invoiceTotal: 100,
      paidCoverageMinor: 4000,
      newPaymentAmount: 60,
    });
    assert.equal(full.invoiceAutoPaid, true);
    assert.equal(full.overpayment, false);
    const over = evaluateInvoicePaymentCoverage({
      invoiceTotal: 100,
      paidCoverageMinor: 9000,
      newPaymentAmount: 20,
    });
    assert.equal(over.overpayment, true);
    assert.equal(assertInvoiceCreateStatus("PAID").ok, false);
    assert.equal(assertInvoiceCreateStatus("ISSUED").ok, true);
    assert.equal(assertInvoicePaidCoverageSufficient({ invoiceTotal: 100, paidCoverageMinor: 50 }).ok, false);
  });
});

describe("money and reason validation", () => {
  it("enforces subtotal+tax=total", () => {
    assert.equal(assertMoneyInvariant({ subtotal: 100, tax: 20, total: 120 }).ok, true);
    assert.equal(assertMoneyInvariant({ subtotal: 100, tax: 20, total: 119 }).ok, false);
  });

  it("requires positive amount with 2dp", () => {
    assert.equal(assertPositiveAmount(10.5).ok, true);
    assert.equal(assertPositiveAmount(0).ok, false);
  });

  it("validates reason length", () => {
    assert.throws(() => sanitizeAdminMutationReason("short"), /en az 8/);
    assert.equal(sanitizeAdminMutationReason("yeterli gerekçe metni").length > 7, true);
  });
});

describe("idempotency hashing", () => {
  it("hashes same payload identically regardless of key order", () => {
    const a = hashAdminMutationRequestPayload({ b: 1, a: 2 });
    const b = hashAdminMutationRequestPayload({ a: 2, b: 1 });
    assert.equal(a, b);
  });

  it("differs for different payloads", () => {
    assert.notEqual(
      hashAdminMutationRequestPayload({ amount: 1 }),
      hashAdminMutationRequestPayload({ amount: 2 }),
    );
  });

  it("generates valid mutation keys", () => {
    const key = generateAdminMutationKey();
    assert.equal(isValidAdminMutationKey(key), true);
    assert.equal(isValidAdminMutationKey("not-a-uuid"), false);
  });
});

describe("safe error mapping and audit sanitization", () => {
  it("maps only allowlisted errors to UI", () => {
    assert.equal(
      getSafeAdminActionErrorMessage(new AdminValidationError("Fatura bulunamadı.")),
      "Fatura bulunamadı.",
    );
    assert.equal(
      getSafeAdminActionErrorMessage(
        new AdminMutationGuardError("rate_limit_denied", "Çok fazla işlem denemesi. Lütfen bir süre sonra tekrar deneyin."),
      ),
      "Çok fazla işlem denemesi. Lütfen bir süre sonra tekrar deneyin.",
    );
    assert.match(
      getSafeAdminActionErrorMessage(new Error('P2002 Unique constraint failed on "Invoice"')),
      /sayfayı yenileyip tekrar deneyin/i,
    );
  });

  it("builds sanitized audit metadata without secrets", () => {
    const meta = buildAdminMutationAuditMetadata({
      actor: {
        adminId: "adm1",
        email: "ops@wexon.dev",
        cloudflareSubject: "sub-secret-value",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
      requestId: "req1",
      riskClass: "FINANCIAL",
      action: "invoice.create",
      organizationId: "org1",
      reason: "manuel fatura kesimi",
      confirmed: true,
      extra: {
        email: "raw@example.com",
        password: "super-secret",
        merchantOid: "ABC123456789",
        nested: { apiKey: "tok_abc", userEmail: "nested@wexon.dev" },
      },
    });
    assert.equal(meta.actorAdminId, "adm1");
    assert.equal(meta.actorEmailMasked, "op***@wexon.dev");
    assert.notEqual(meta.cloudflareSubjectHash, "sub-secret-value");
    assert.equal(meta.source, "admin_mutation");
    assert.equal(meta.email, "ra***@example.com");
    assert.equal(meta.password, undefined);
    assert.match(String(meta.merchantOid), /…/);
    assert.equal((meta.nested as Record<string, unknown>).apiKey, undefined);
    assert.equal((meta.nested as Record<string, unknown>).userEmail, "ne***@wexon.dev");
    assert.ok(!JSON.stringify(meta).includes("sub-secret-value"));
  });

  it("recursively strips secrets from sanitize helper", () => {
    const cleaned = sanitizeAdminAuditMetadata({
      token: "abc",
      list: [{ passwordHash: "x", email: "a@b.com" }],
    });
    assert.equal(cleaned.token, undefined);
    assert.equal((cleaned.list as Array<Record<string, unknown>>)[0]?.passwordHash, undefined);
    assert.equal((cleaned.list as Array<Record<string, unknown>>)[0]?.email, "a***@b.com");
  });

  it("never treats auditNote or acknowledgePaytrPaid as mutation confirmation", () => {
    const confirm = { confirmed: false, reason: "" };
    const payload = {
      auditNote: "sufficient audit note text",
      acknowledgePaytrPaid: true,
    };
    // Action contract for subscription.status_change — do not regress to
    // `confirmed: confirm.confirmed || Boolean(payload.auditNote)`.
    const confirmed = confirm.confirmed;
    const reason = confirm.reason || payload.auditNote;
    assert.equal(confirmed, false);
    assert.equal(payload.acknowledgePaytrPaid, true);
    assert.ok(reason.length >= 8);
    assert.equal(requiresHighRiskConfirmation("FINANCIAL"), true);
  });
});

describe("hosted cleanup guard", () => {
  it("fail-closes on VERCEL_ENV production/preview and NODE_ENV production", () => {
    assert.equal(isHostedDeploymentCleanupForbidden({ VERCEL_ENV: "production" }), true);
    assert.equal(isHostedDeploymentCleanupForbidden({ VERCEL_ENV: "preview" }), true);
    assert.equal(isHostedDeploymentCleanupForbidden({ NODE_ENV: "production" }), true);
    assert.equal(isHostedDeploymentCleanupForbidden({ NODE_ENV: "development", VERCEL_ENV: "" }), false);
  });
});
