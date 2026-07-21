import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
  });
});
