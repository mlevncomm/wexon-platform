import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearFakeEmailOutbox,
  escapeEmailHtml,
  getFakeEmailOutbox,
  resolveEmailTransportConfig,
  sanitizeEmailErrorCode,
  sendTransactionalEmail,
  buildStaffInviteEmailContent,
} from "./wexon-email";
import {
  generateSecureStaffInviteTokenMaterial,
  hashStaffInviteToken,
  sanitizeStaffInviteAuditMetadata,
  STAFF_INVITE_TOKEN_BYTES,
  STAFF_INVITE_TTL_MS,
  isInviteOpen,
} from "./wexpay-staff-invite";
import {
  ACTIVATION_STEP_LABELS,
  computeWizardProgress,
  isActivationStepActionable,
  maskTaxNoForAudit,
  PR2_WIZARD_STEPS,
} from "./wexpay-activation-journey";
import { ActivationJourneyStepStatus, ActivationStepKey } from ".prisma/client";

describe("staff invite tokens", () => {
  it("generates high-entropy base64url tokens and stable hashes", () => {
    const a = generateSecureStaffInviteTokenMaterial();
    const b = generateSecureStaffInviteTokenMaterial();
    assert.notEqual(a.plaintext, b.plaintext);
    assert.equal(a.tokenHash, hashStaffInviteToken(a.plaintext));
    assert.ok(Buffer.from(a.plaintext, "base64url").length >= STAFF_INVITE_TOKEN_BYTES);
    assert.equal(STAFF_INVITE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  });

  it("strips raw tokens from audit metadata", () => {
    const clean = sanitizeStaffInviteAuditMetadata({
      token: "secret",
      plaintext: "x",
      inviteUrl: "https://evil",
      role: "STAFF",
      tokenPrefix: "abc",
    });
    assert.deepEqual(clean, { role: "STAFF", tokenPrefix: "abc" });
  });

  it("classifies open invite state", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    assert.equal(isInviteOpen({ acceptedAt: null, revokedAt: null, expiresAt: future }), true);
    assert.equal(isInviteOpen({ acceptedAt: new Date(), revokedAt: null, expiresAt: future }), false);
    assert.equal(isInviteOpen({ acceptedAt: null, revokedAt: new Date(), expiresAt: future }), false);
    assert.equal(isInviteOpen({ acceptedAt: null, revokedAt: null, expiresAt: past }), false);
  });
});

describe("email adapter", () => {
  it("rejects fake provider in hosted production", () => {
    const cfg = resolveEmailTransportConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      WEXON_EMAIL_PROVIDER: "fake",
      RESEND_API_KEY: "re_test",
      WEXON_EMAIL_FROM: "Wexon <davet@mail.wexon.dev>",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.ready, false);
    if (!cfg.ready) assert.equal(cfg.reasonCode, "FAKE_FORBIDDEN_IN_PRODUCTION");
  });

  it("requires explicit From in production (no default)", () => {
    const cfg = resolveEmailTransportConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      WEXON_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test",
      WEXON_EMAIL_FROM: "",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.ready, false);
    if (!cfg.ready) assert.equal(cfg.reasonCode, "MISSING_OR_INVALID_EMAIL_FROM");
  });

  it("fail-closes in production without Resend key", () => {
    const cfg = resolveEmailTransportConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      WEXON_EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "",
      WEXON_EMAIL_FROM: "Wexon <davet@mail.wexon.dev>",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.ready, false);
    if (!cfg.ready) assert.equal(cfg.reasonCode, "MISSING_RESEND_API_KEY");
  });

  it("strips CRLF from subject headers", async () => {
    const prevProvider = process.env.WEXON_EMAIL_PROVIDER;
    const prevVercel = process.env.VERCEL_ENV;
    process.env.WEXON_EMAIL_PROVIDER = "fake";
    delete process.env.VERCEL_ENV;
    clearFakeEmailOutbox();
    try {
      const result = await sendTransactionalEmail({
        to: "a@example.com",
        subject: "Hello\r\nBcc: evil@x.com",
        html: "<p>x</p>",
        text: "x",
        idempotencyKey: "crlf-1",
      });
      assert.equal(result.ok, true);
      assert.ok(!getFakeEmailOutbox()[0]?.subject.includes("\n"));
      assert.ok(!getFakeEmailOutbox()[0]?.subject.includes("\r"));
    } finally {
      if (prevProvider === undefined) delete process.env.WEXON_EMAIL_PROVIDER;
      else process.env.WEXON_EMAIL_PROVIDER = prevProvider;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
    }
  });

  it("uses fake adapter outside production by default", async () => {
    clearFakeEmailOutbox();
    const cfg = resolveEmailTransportConfig({
      NODE_ENV: "test",
      WEXON_EMAIL_PROVIDER: "fake",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.ready, true);
    if (cfg.ready) assert.equal(cfg.provider, "fake");

    // Force fake via env for sendTransactionalEmail (reads process.env)
    const prevProvider = process.env.WEXON_EMAIL_PROVIDER;
    const prevVercel = process.env.VERCEL_ENV;
    process.env.WEXON_EMAIL_PROVIDER = "fake";
    delete process.env.VERCEL_ENV;
    try {
      const result = await sendTransactionalEmail({
        to: "a@example.com",
        subject: "t",
        html: "<p>x</p>",
        text: "x",
        idempotencyKey: "invite-1",
      });
      assert.equal(result.ok, true);
      assert.equal(getFakeEmailOutbox().length, 1);
      assert.equal(getFakeEmailOutbox()[0]?.idempotencyKey, "invite-1");
    } finally {
      if (prevProvider === undefined) delete process.env.WEXON_EMAIL_PROVIDER;
      else process.env.WEXON_EMAIL_PROVIDER = prevProvider;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
    }
  });

  it("escapes HTML and sanitizes provider errors", () => {
    assert.equal(escapeEmailHtml(`<a>"x"</a>`), "&lt;a&gt;&quot;x&quot;&lt;/a&gt;");
    assert.ok(!sanitizeEmailErrorCode("Bearer re_abc123 fail").includes("re_abc"));
    const content = buildStaffInviteEmailContent({
      organizationName: `Cafe <script>`,
      roleLabel: "Personel",
      invitePathToken: "tok",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });
    assert.ok(content.html.includes("&lt;script&gt;"));
    assert.ok(content.inviteUrl.includes("/invite/"));
    assert.ok(!content.html.includes("<script>"));
  });
});

describe("wizard helpers", () => {
  it("masks tax numbers for audit", () => {
    assert.equal(maskTaxNoForAudit("1234567890"), "****7890");
    assert.equal(maskTaxNoForAudit(null), null);
  });

  it("computes progress and lists PR-2 steps", () => {
    assert.deepEqual(PR2_WIZARD_STEPS, [
      ActivationStepKey.BUSINESS_PROFILE,
      ActivationStepKey.BRANCH_SETUP,
      ActivationStepKey.TABLE_SETUP,
      ActivationStepKey.STAFF_INVITE,
    ]);
    const progress = computeWizardProgress({
      id: "j",
      organizationId: "o",
      productId: "p",
      status: "IN_PROGRESS",
      source: "SELF_SERVE",
      currentStep: ActivationStepKey.BRANCH_SETUP,
      blockedReasonCode: null,
      completedAt: null,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        {
          id: "1",
          journeyId: "j",
          stepKey: ActivationStepKey.BUSINESS_PROFILE,
          status: ActivationJourneyStepStatus.COMPLETED,
          attemptCount: 1,
          lastErrorCode: null,
          completedAt: new Date(),
          safeMetadataJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    assert.equal(progress.completed, 1);
    assert.equal(progress.activeStep, ActivationStepKey.BRANCH_SETUP);
  });

  it("uses customer-facing Turkish labels and blocks unavailable continuation steps", () => {
    assert.equal(ACTIVATION_STEP_LABELS[ActivationStepKey.PAYMENT_PROVIDER], "Ödeme altyapısı");
    assert.equal(ACTIVATION_STEP_LABELS[ActivationStepKey.VALIDATION], "Son kontroller");
    assert.equal(ACTIVATION_STEP_LABELS[ActivationStepKey.GO_LIVE], "Yayına alma");
    assert.equal(isActivationStepActionable(ActivationStepKey.MENU_IMPORT), true);
    assert.equal(isActivationStepActionable(ActivationStepKey.PAYMENT_PROVIDER), false);
    assert.equal(isActivationStepActionable(ActivationStepKey.VALIDATION), false);
    assert.equal(isActivationStepActionable(ActivationStepKey.GO_LIVE), false);
  });
});
