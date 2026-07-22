import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WexPayProviderCredentialMode } from ".prisma/client";
import {
  ActivationPaymentProviderError,
  buildActivationPaymentProviderSafeMetadata,
  parseActivationPaymentProviderInput,
} from "./wexpay-activation-payment-provider";
import {
  buildActivationValidationSafeMetadata,
  canRetryActivationValidation,
  summarizeActivationValidation,
} from "./wexpay-activation-validation";
import {
  isGoLiveIdempotentReplayVersion,
  validateGoLiveConfirmation,
} from "./wexpay-activation-go-live";
import { sanitizeAdminActivationBlockInput } from "./wexpay-activation-admin";
import { mapPaytrCredentialConfig } from "./wexpay-paytr-adapter";
import { sanitizeProviderCredentialAuditMetadata } from "./wexpay-provider-credentials";
import { isPaytrModeAllowedForPublicCheckout } from "./wexpay-public-payment-availability";

describe("activation payment provider parser", () => {
  it("requires explicit MANUAL acknowledgement and forbids credentials", () => {
    assert.throws(
      () => parseActivationPaymentProviderInput({ provider: "MANUAL" }),
      (error: unknown) =>
        error instanceof ActivationPaymentProviderError &&
        error.code === "MANUAL_ACK_REQUIRED",
    );
    assert.deepEqual(
      parseActivationPaymentProviderInput({
        provider: "MANUAL",
        manualAcknowledged: "true",
      }),
      { provider: "MANUAL", manualAcknowledged: true },
    );
    assert.throws(
      () =>
        parseActivationPaymentProviderInput({
          provider: "MANUAL",
          manualAcknowledged: "1",
          merchantKey: "must-not-be-accepted",
        }),
      (error: unknown) =>
        error instanceof ActivationPaymentProviderError &&
        error.code === "MANUAL_CREDENTIAL_FORBIDDEN",
    );
  });

  it("defaults PayTR to TEST and accepts backward-compatible field names", () => {
    const parsed = parseActivationPaymentProviderInput({
      provider: "paytr",
      PAYTR_MERCHANT_ID: "merchant-id",
      apiKey: "merchant-key",
      secret: "merchant-salt",
    });
    assert.deepEqual(parsed, {
      provider: "PAYTR",
      mode: WexPayProviderCredentialMode.TEST,
      merchantId: "merchant-id",
      merchantKey: "merchant-key",
      merchantSalt: "merchant-salt",
    });
    assert.deepEqual(
      mapPaytrCredentialConfig({
        merchantId: "merchant-id",
        secretKey: "merchant-key",
        secret: "merchant-salt",
      }),
      {
        merchantId: "merchant-id",
        merchantKey: "merchant-key",
        merchantSalt: "merchant-salt",
      },
    );
  });

  it("rejects iyzico and Param hidden-form values", () => {
    for (const provider of ["iyzico", "PARAM"]) {
      assert.throws(
        () => parseActivationPaymentProviderInput({ provider }),
        (error: unknown) =>
          error instanceof ActivationPaymentProviderError &&
          error.code === "UNSUPPORTED_PROVIDER",
      );
    }
  });

  it("emits exact safe metadata without credential material", () => {
    assert.deepEqual(
      buildActivationPaymentProviderSafeMetadata({
        provider: "MANUAL",
        manualAcknowledged: true,
      }),
      {
        provider: "MANUAL",
        acknowledged: true,
        onlinePaymentReady: false,
      },
    );

    const previousFlag = process.env.WEXPAY_PAYTR_ENABLE_API;
    process.env.WEXPAY_PAYTR_ENABLE_API = "true";
    try {
      const metadata = buildActivationPaymentProviderSafeMetadata(
        {
          provider: "PAYTR",
          mode: WexPayProviderCredentialMode.LIVE,
          merchantId: "merchant-id",
          merchantKey: "merchant-key",
          merchantSalt: "merchant-salt",
        },
        {
          credential: {
            id: "credential-1",
            mode: WexPayProviderCredentialMode.LIVE,
            keyFingerprint: "0123456789abcdef",
          },
          configCheckedAt: new Date("2026-07-22T12:00:00.000Z"),
        },
      );
      assert.deepEqual(metadata, {
        provider: "PAYTR",
        credentialId: "credential-1",
        mode: "LIVE",
        keyFingerprint: "0123456789abcdef",
        configCheckedAt: "2026-07-22T12:00:00.000Z",
        onlinePaymentApiEnabled: true,
      });
      const blob = JSON.stringify(metadata);
      assert.ok(!blob.includes("merchant-id"));
      assert.ok(!blob.includes("merchant-key"));
      assert.ok(!blob.includes("merchant-salt"));
    } finally {
      if (previousFlag === undefined) delete process.env.WEXPAY_PAYTR_ENABLE_API;
      else process.env.WEXPAY_PAYTR_ENABLE_API = previousFlag;
    }
  });
});

describe("activation validation state helpers", () => {
  it("exposes required check fields and persists only safe summary", () => {
    const report = summarizeActivationValidation([
      {
        key: "A",
        status: "PASS",
        title: "Başlık A",
        description: "Güvenli açıklama",
        remediationHref: "/dashboard/wexpay/activation",
        metadata: { count: 1 },
      },
      {
        key: "B",
        status: "WARNING",
        title: "Başlık B",
        description: "Güvenli uyarı",
      },
    ]);
    assert.equal(report.overall, "WARNING");
    assert.equal(report.failCount, 0);
    assert.deepEqual(report.checks[0], {
      key: "A",
      status: "PASS",
      title: "Başlık A",
      description: "Güvenli açıklama",
      remediationHref: "/dashboard/wexpay/activation",
      metadata: { count: 1 },
    });
    assert.deepEqual(buildActivationValidationSafeMetadata(report), {
      result: "WARNING",
      passCount: 1,
      warningCount: 1,
      failCount: 0,
      checks: [
        { key: "A", status: "PASS" },
        { key: "B", status: "WARNING" },
      ],
    });
  });

  it("blocks only ADMIN_BLOCKED validation retries", () => {
    assert.equal(canRetryActivationValidation(null), true);
    assert.equal(canRetryActivationValidation("VALIDATION_FAILED"), true);
    assert.equal(canRetryActivationValidation("ADMIN_BLOCKED"), false);
  });

  it("requires explicit go-live confirmation with exact case", () => {
    assert.equal(
      validateGoLiveConfirmation({
        confirmed: true,
        confirmationText: "Acme",
        organizationName: "Acme",
        organizationSlug: "acme",
      }),
      "NAME",
    );
    assert.throws(() =>
      validateGoLiveConfirmation({
        confirmed: true,
        confirmationText: "ACME",
        organizationName: "Acme",
        organizationSlug: "acme",
      }),
    );
  });

  it("accepts only the immediately completed go-live version as idempotent", () => {
    assert.equal(isGoLiveIdempotentReplayVersion(8, 7), true);
    assert.equal(isGoLiveIdempotentReplayVersion(8, 6), false);
    assert.equal(isGoLiveIdempotentReplayVersion(8, 8), false);
  });

  it("requires LIVE for production public checkout only", () => {
    assert.equal(
      isPaytrModeAllowedForPublicCheckout(
        WexPayProviderCredentialMode.TEST,
        {
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        } as NodeJS.ProcessEnv,
      ),
      false,
    );
    assert.equal(
      isPaytrModeAllowedForPublicCheckout(
        WexPayProviderCredentialMode.LIVE,
        {
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        } as NodeJS.ProcessEnv,
      ),
      true,
    );
    assert.equal(
      isPaytrModeAllowedForPublicCheckout(
        WexPayProviderCredentialMode.TEST,
        {
          NODE_ENV: "development",
          VERCEL_ENV: "development",
        } as NodeJS.ProcessEnv,
      ),
      true,
    );
  });
});

describe("activation audit sanitization", () => {
  it("keeps only credential audit allowlist fields", () => {
    assert.deepEqual(
      sanitizeProviderCredentialAuditMetadata({
        provider: "paytr",
        mode: "TEST",
        ok: true,
        merchantKey: "secret",
        merchant_salt: "secret",
        configCiphertext: "ciphertext",
      }),
      { provider: "paytr", mode: "TEST", ok: true },
    );
  });

  it("normalizes admin reasons and records only note length", () => {
    assert.deepEqual(
      sanitizeAdminActivationBlockInput({
        reason: " compliance hold ",
        note: "Customer verification is pending.",
      }),
      { reasonCode: "COMPLIANCE_HOLD", noteLength: 33 },
    );
    assert.throws(() =>
      sanitizeAdminActivationBlockInput({ reason: "ops", note: "short" }),
    );
  });
});
