import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lockWexPayActivationJourneyForUpdate,
  lockWexPayMenuImportJob,
  lockWexPayOrgProductLimit,
  lockWexPayOrgTableLimit,
  lockWexPayTableAccount,
} from "@/lib/wexpay-locks";

describe("wexpay locks helpers", () => {
  it("exposes table and org lock entry points", () => {
    assert.equal(typeof lockWexPayTableAccount, "function");
    assert.equal(typeof lockWexPayOrgTableLimit, "function");
    assert.equal(typeof lockWexPayOrgProductLimit, "function");
    assert.equal(typeof lockWexPayMenuImportJob, "function");
    assert.equal(typeof lockWexPayActivationJourneyForUpdate, "function");
  });

  it("uses a tenant-scoped SELECT FOR UPDATE journey lock", async () => {
    const calls: unknown[][] = [];
    const tx = {
      async $queryRaw(...args: unknown[]) {
        calls.push(args);
        return [{ id: "journey-1" }];
      },
    };
    const id = await lockWexPayActivationJourneyForUpdate(tx as never, "org-1");
    assert.equal(id, "journey-1");
    const [template, organizationId] = calls[0]!;
    assert.match(
      Array.from(template as TemplateStringsArray).join("?"),
      /"ActivationJourney"[\s\S]*organizationId[\s\S]*FOR UPDATE OF journey/,
    );
    assert.equal(organizationId, "org-1");
  });
});
