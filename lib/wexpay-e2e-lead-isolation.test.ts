import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEligibilityLeadMarker,
  E2E_ELIGIBILITY_SOURCE_BASE,
  E2E_LEAD_PREFIX,
  leadMutationBlockedReason,
} from "../e2e/lead-isolation";

describe("e2e lead isolation markers", () => {
  it("builds unique source/email/company with E2E prefix", () => {
    const marker = createEligibilityLeadMarker("abc123");
    assert.equal(marker.source, `${E2E_ELIGIBILITY_SOURCE_BASE}.abc123`);
    assert.equal(marker.email, "e2e.elig.abc123@example.com");
    assert.ok(marker.company.startsWith(E2E_LEAD_PREFIX));
    assert.match(marker.message, /E2E\[WXP\]/);
  });

  it("blocks shared remote mutation without allow flag", () => {
    const prevAllow = process.env.WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION;
    const prevSkip = process.env.WEXON_E2E_SKIP_LEAD_MUTATION;
    const prevTarget = process.env.WEXON_E2E_TARGET;
    const prevConfirm = process.env.WEXON_E2E_CONFIRM_PRODUCTION;
    try {
      delete process.env.WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION;
      delete process.env.WEXON_E2E_SKIP_LEAD_MUTATION;
      process.env.WEXON_E2E_TARGET = "local";
      delete process.env.WEXON_E2E_CONFIRM_PRODUCTION;
      const reason = leadMutationBlockedReason();
      // On this workspace DATABASE_URL is shared supabase → blocked without allow flag.
      if (String(process.env.DATABASE_URL || process.env.DIRECT_URL || "").includes("supabase")) {
        assert.ok(reason);
        assert.match(reason!, /shared remote-unverified/);
      }
    } finally {
      if (prevAllow == null) delete process.env.WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION;
      else process.env.WEXON_E2E_ALLOW_SHARED_LEAD_MUTATION = prevAllow;
      if (prevSkip == null) delete process.env.WEXON_E2E_SKIP_LEAD_MUTATION;
      else process.env.WEXON_E2E_SKIP_LEAD_MUTATION = prevSkip;
      if (prevTarget == null) delete process.env.WEXON_E2E_TARGET;
      else process.env.WEXON_E2E_TARGET = prevTarget;
      if (prevConfirm == null) delete process.env.WEXON_E2E_CONFIRM_PRODUCTION;
      else process.env.WEXON_E2E_CONFIRM_PRODUCTION = prevConfirm;
    }
  });
});
