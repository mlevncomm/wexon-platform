/**
 * Shared helpers for WexPay isolated mutation E2E suites.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createWexPayRunMarker, wexPayMutationBlockedReason } from "./lead-isolation";
import { loadFixtures } from "./helpers";

const runArtifactPath = resolve(process.cwd(), "e2e", ".wexpay-run.json");

export type WexPayRunArtifact = {
  runId: string;
  token: string;
  note: string;
  startedAt: string;
  orderIds: string[];
  notificationIds: string[];
  paymentIds: string[];
  idempotencyKeys: string[];
  tableIds: string[];
};

export function skipUnlessIsolatedMutation() {
  const fixtures = loadFixtures();
  test.skip(!fixtures.dbAvailable, fixtures.setupError ?? "database unavailable");
  test.skip(
    !fixtures.fixturesReady || !fixtures.qrCode || !fixtures.licensedOrgId,
    fixtures.setupError ?? "licensed WexPay fixture required",
  );
  const reason = wexPayMutationBlockedReason();
  test.skip(Boolean(reason), reason ?? "mutation blocked");
}

export function ensureRunArtifact(): WexPayRunArtifact {
  if (existsSync(runArtifactPath)) {
    const existing = JSON.parse(readFileSync(runArtifactPath, "utf8")) as WexPayRunArtifact;
    if (!existing.note && existing.token) {
      existing.note = `${existing.token} isolated WexPay E2E run`;
      saveArtifact(existing);
    }
    return existing;
  }
  const marker = createWexPayRunMarker();
  const artifact: WexPayRunArtifact = {
    runId: marker.runId,
    token: marker.token,
    note: marker.note,
    startedAt: new Date().toISOString(),
    orderIds: [],
    notificationIds: [],
    paymentIds: [],
    idempotencyKeys: [],
    tableIds: [],
  };
  writeFileSync(runArtifactPath, JSON.stringify(artifact, null, 2), "utf8");
  return artifact;
}

function saveArtifact(artifact: WexPayRunArtifact) {
  writeFileSync(runArtifactPath, JSON.stringify(artifact, null, 2), "utf8");
}

export function trackOrderId(orderId: string) {
  const artifact = ensureRunArtifact();
  artifact.orderIds = [...new Set([...(artifact.orderIds ?? []), orderId])];
  saveArtifact(artifact);
}

export function trackIdempotencyKey(scopeKey: string) {
  const artifact = ensureRunArtifact();
  artifact.idempotencyKeys = [...new Set([...(artifact.idempotencyKeys ?? []), scopeKey])];
  saveArtifact(artifact);
}

export async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

export async function assertNoSecrets(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/riskReasons/i);
  expect(body).not.toMatch(/organizationId/i);
  expect(body).not.toMatch(/merchant_key|PAYTR_MERCHANT|API[_-]?KEY/i);
  expect(body).not.toMatch(/provider.?hash|providerReference/i);
}

export async function dismissCookieBanner(page: Page) {
  const manage = page.getByRole("button", { name: /Tercihlerimi Yönet|Kabul|Accept|Tamam/i });
  if (await manage.count()) {
    const acceptAll = page.getByRole("button", { name: /Tümünü kabul|Accept all|Kabul et/i });
    if (await acceptAll.count()) {
      await acceptAll.click({ force: true }).catch(() => undefined);
    } else {
      await manage.first().click({ force: true }).catch(() => undefined);
      const save = page.getByRole("button", { name: /Kaydet|Save|Onayla/i });
      if (await save.count()) {
        await save.first().click({ force: true }).catch(() => undefined);
      }
    }
  }
  // Hide sticky cookie chrome if still present so CTAs remain clickable.
  await page.evaluate(() => {
    document.querySelectorAll('[class*="fixed"][class*="bottom-0"]').forEach((el) => {
      if (el.textContent && /çerez|cookie|Tercih/i.test(el.textContent)) {
        (el as HTMLElement).style.display = "none";
      }
    });
  });
}

/** Fail-closed cleanup via isolated guard script (also runs if tests fail). */
export function cleanupAfterSuite() {
  const result = spawnSync(process.execPath, ["scripts/cleanup-wexpay-e2e.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      WEXON_E2E_TARGET: process.env.WEXON_E2E_TARGET || "isolated",
      WEXON_E2E_CONFIRM_ISOLATED: process.env.WEXON_E2E_CONFIRM_ISOLATED || "true",
    },
  });
  if (result.stdout) console.log(result.stdout);
  if (result.status !== 0) {
    console.warn("[wexpay-mutation] cleanup exit", result.status, result.stderr || result.stdout);
  }
}
