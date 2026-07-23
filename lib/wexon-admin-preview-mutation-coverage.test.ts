import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ADMIN_PREVIEW_MUTATION_COVERAGE,
  listAdminPreviewPureDbActionKeys,
} from "@/lib/wexon-admin-preview-mutation-coverage";

function exportedActionNames(source: string) {
  const names = new Set<string>();
  for (const match of source.matchAll(/^export async function (\w+Action)\(/gm)) {
    names.add(match[1]!);
  }
  return [...names].sort();
}

describe("admin preview mutation coverage registry", () => {
  it("lists every exported *Action from wexpay-actions and requires capability/org/atomic flags", () => {
    const source = readFileSync(new URL("./wexpay-actions.ts", import.meta.url), "utf8");
    const exportedActions = exportedActionNames(source);
    const coveredExports = ADMIN_PREVIEW_MUTATION_COVERAGE.map((row) => row.actionExport).sort();

    assert.deepEqual(
      coveredExports,
      exportedActions,
      "ADMIN_PREVIEW_MUTATION_COVERAGE must include every wexpay-actions export",
    );

    for (const row of ADMIN_PREVIEW_MUTATION_COVERAGE) {
      assert.equal(row.requiresCapability, true, row.actionKey);
      assert.equal(row.requiresOrganizationId, true, row.actionKey);
      if (row.kind === "pure_db") {
        assert.equal(row.atomicAuditRequired, true, `${row.actionKey} must be atomic`);
      } else {
        assert.equal(row.atomicAuditRequired, false, `${row.actionKey} external must not claim atomic`);
      }
    }
  });

  it("pure_db actions bind preview audit and do not call post-commit audit helper", () => {
    const source = readFileSync(new URL("./wexpay-actions.ts", import.meta.url), "utf8");
    assert.equal(source.includes("auditAdminPreviewMutationIfNeeded"), false);
    for (const actionKey of listAdminPreviewPureDbActionKeys()) {
      assert.match(
        source,
        new RegExp(`bindAdminPreviewWriteIfNeeded\\(context, "${actionKey}"\\)`),
        `missing bind for ${actionKey}`,
      );
    }
  });

  it("service commits admin preview audit inside runInTransactionWithPreviewAudit", () => {
    const source = readFileSync(new URL("./wexpay-service.ts", import.meta.url), "utf8");
    assert.match(source, /function runInTransactionWithPreviewAudit/);
    assert.match(source, /writeAdminPreviewMutationAuditInTransaction/);
    assert.ok(source.includes("runInTransactionWithPreviewAudit(context,"));
  });
});
