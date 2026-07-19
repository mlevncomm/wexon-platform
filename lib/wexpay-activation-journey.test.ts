import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVATION_STEP_ORDER,
  ACTIVATION_UI_NOT_STARTED,
  buildActivationJourneyView,
  SETTLED_ACTIVATION_FEE_STATUSES,
} from "./wexpay-activation-journey";
import {
  generateSecureTableQrTokenMaterial,
  hashTableQrToken,
  sanitizeTableQrTokenAuditMetadata,
  TABLE_QR_TOKEN_BYTES,
  TABLE_QR_TOKEN_PREFIX_LENGTH,
} from "./wexpay-table-qr-token";
import { buildOpaquePublicQrPath } from "./wexpay-public-table-url";
import { ActivationJourneySource, ActivationJourneyStatus, ActivationStepKey } from ".prisma/client";

describe("activation journey pure helpers", () => {
  it("derives NOT_STARTED when journey row is absent", () => {
    const view = buildActivationJourneyView(null);
    assert.equal(view.uiStatus, ACTIVATION_UI_NOT_STARTED);
    assert.equal(view.setupMode, true);
    assert.equal(view.publicLive, false);
    assert.equal(view.statusLabel, "Başlamadı");
  });

  it("READY keeps setup mode and does not open public live", () => {
    const view = buildActivationJourneyView({
      id: "j1",
      organizationId: "o1",
      productId: "p1",
      status: ActivationJourneyStatus.READY,
      source: ActivationJourneySource.SELF_SERVE,
      currentStep: ActivationStepKey.GO_LIVE,
      blockedReasonCode: null,
      completedAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [],
    });
    assert.equal(view.setupMode, true);
    assert.equal(view.publicLive, false);
    assert.match(view.statusLabel, /Canlıya Geçiş/);
  });

  it("ACTIVE opens public live and exits setup mode", () => {
    const view = buildActivationJourneyView({
      id: "j1",
      organizationId: "o1",
      productId: "p1",
      status: ActivationJourneyStatus.ACTIVE,
      source: ActivationJourneySource.LEGACY_BACKFILL,
      currentStep: ActivationStepKey.GO_LIVE,
      blockedReasonCode: null,
      completedAt: new Date(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [],
    });
    assert.equal(view.setupMode, false);
    assert.equal(view.publicLive, true);
    assert.equal(view.sourceLabel, "Kurucu İşletmeler Programı");
  });

  it("keeps settled fee statuses and ordered steps", () => {
    assert.deepEqual([...SETTLED_ACTIVATION_FEE_STATUSES], ["PAID", "WAIVED", "WAIVED_LEGACY"]);
    assert.equal(ACTIVATION_STEP_ORDER.length, 8);
    assert.equal(ACTIVATION_STEP_ORDER[0], ActivationStepKey.BUSINESS_PROFILE);
    assert.equal(ACTIVATION_STEP_ORDER[7], ActivationStepKey.GO_LIVE);
  });
});

describe("secure table QR token material", () => {
  it("generates at least 256-bit entropy base64url tokens with hash + prefix", () => {
    const material = generateSecureTableQrTokenMaterial();
    // base64url of 32 bytes is 43 chars without padding
    assert.ok(material.plaintext.length >= 43);
    assert.equal(Buffer.from(material.plaintext, "base64url").length, TABLE_QR_TOKEN_BYTES);
    assert.equal(material.tokenHash, hashTableQrToken(material.plaintext));
    assert.equal(material.tokenHash.length, 64);
    assert.equal(material.tokenPrefix, material.plaintext.slice(0, TABLE_QR_TOKEN_PREFIX_LENGTH));
    assert.ok(!material.tokenHash.includes(material.plaintext));
  });

  it("builds /q/{token} path", () => {
    assert.equal(buildOpaquePublicQrPath("abc-TOKEN"), "/q/abc-TOKEN");
  });

  it("strips raw token fields from audit metadata", () => {
    const clean = sanitizeTableQrTokenAuditMetadata({
      token: "SECRET",
      plaintext: "SECRET",
      rawToken: "SECRET",
      tokenPrefix: "abc",
      tableId: "t1",
    });
    assert.deepEqual(clean, { tokenPrefix: "abc", tableId: "t1" });
  });
});
