/**
 * Shared skip helper for mutation-capable public QR / smoke API tests.
 */
import { test } from "@playwright/test";
import { classifyE2EDatabase, wexPayMutationBlockedReason } from "./lead-isolation";

type FixtureGate = {
  dbAvailable: boolean;
  fixturesReady?: boolean;
  setupError?: string | null;
  qrCode?: string | null;
};

export function skipUnlessPublicApiMutationAllowed(fixtures: FixtureGate) {
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
  test.skip(!fixtures.fixturesReady || !fixtures.qrCode, fixtures.setupError ?? "licensed qr fixture required");
  const reason = wexPayMutationBlockedReason();
  test.skip(Boolean(reason), reason ?? `public API mutation blocked (${classifyE2EDatabase()})`);
}

export function skipUnlessDbReadable(fixtures: FixtureGate) {
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
}
