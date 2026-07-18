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
  const isolated = (process.env.WEXON_E2E_TARGET ?? "").trim().toLowerCase() === "isolated";
  const reason = wexPayMutationBlockedReason();

  if (isolated) {
    if (!fixtures.dbAvailable) {
      throw new Error(fixtures.setupError ?? "Isolated E2E requires a reachable database.");
    }
    if (!fixtures.fixturesReady || !fixtures.qrCode) {
      throw new Error(fixtures.setupError ?? "Isolated E2E requires licensed qr fixture.");
    }
    if (reason) {
      throw new Error(reason);
    }
    return;
  }

  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
  test.skip(!fixtures.fixturesReady || !fixtures.qrCode, fixtures.setupError ?? "licensed qr fixture required");
  test.skip(Boolean(reason), reason ?? `public API mutation blocked (${classifyE2EDatabase()})`);
}

export function skipUnlessDbReadable(fixtures: FixtureGate) {
  const isolated = (process.env.WEXON_E2E_TARGET ?? "").trim().toLowerCase() === "isolated";
  if (isolated && !fixtures.dbAvailable) {
    throw new Error(fixtures.setupError ?? "Isolated E2E requires a reachable database.");
  }
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
}
