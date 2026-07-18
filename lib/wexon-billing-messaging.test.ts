import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCustomerBillingNotices } from "./wexon-billing-messaging";

describe("buildCustomerBillingNotices", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("surfaces PAST_DUE access-retained messaging", () => {
    const notices = buildCustomerBillingNotices({
      subscription: {
        status: "PAST_DUE",
        cancelAt: null,
        currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      },
      license: null,
      paytrSubscriptionEnabled: false,
      now,
    });
    assert.ok(notices.some((notice) => /PAST_DUE|gecik/i.test(notice.title + notice.body)));
    assert.ok(notices.some((notice) => notice.tone === "warning"));
  });

  it("surfaces scheduled cancelAt messaging", () => {
    const notices = buildCustomerBillingNotices({
      subscription: {
        status: "CANCELLED",
        cancelAt: new Date("2026-08-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      },
      license: null,
      paytrSubscriptionEnabled: true,
      now,
    });
    assert.ok(notices.some((notice) => /İptal planlandı/i.test(notice.title)));
  });

  it("surfaces renewal-soon when period end within 30 days", () => {
    const notices = buildCustomerBillingNotices({
      subscription: {
        status: "ACTIVE",
        cancelAt: null,
        currentPeriodEnd: new Date("2026-07-25T00:00:00.000Z"),
      },
      license: { endsAt: new Date("2026-07-25T00:00:00.000Z"), status: "ACTIVE" },
      paytrSubscriptionEnabled: true,
      now,
    });
    assert.ok(notices.some((notice) => /Yenileme yaklaşıyor/i.test(notice.title)));
  });
});
