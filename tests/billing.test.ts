import { describe, it, expect } from "vitest";
import { applySubscriptionEvent, type RzEvent, type SubRow } from "../lib/billing-events";
import { isPro } from "../lib/entitlements";
import crypto from "node:crypto";
import { verifySignature } from "../lib/server/billing";

const ev = (event: string, end?: number): RzEvent => ({ event, payload: { subscription: { entity: { id: "sub_1", current_end: end } } } });
const now = new Date("2026-03-01T00:00:00Z");
const end = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
const toSub = (r: SubRow | null) => ({ status: r!.status, renewsAt: r!.renews_at, graceUntil: r!.grace_until });

describe("subscription webhooks", () => {
  it("activation turns Pro on until the period end", () => {
    const r = applySubscriptionEvent(ev("subscription.activated", end), null, now)!;
    expect(r.status).toBe("active");
    expect(isPro(toSub(r), now)).toBe(true);
  });
  it("a failed payment gives exactly 7 days of grace", () => {
    const active = applySubscriptionEvent(ev("subscription.activated", end), null, now)!;
    const failed = applySubscriptionEvent(ev("subscription.pending", end), active, now)!;
    expect(failed.status).toBe("past_due");
    expect(failed.grace_until).toBe("2026-03-08T00:00:00.000Z");
    expect(isPro(toSub(failed), new Date("2026-03-07T12:00:00Z"))).toBe(true);
    expect(isPro(toSub(failed), new Date("2026-03-08T12:00:00Z"))).toBe(false);
  });
  it("repeated failure events do not extend the grace period", () => {
    const active = applySubscriptionEvent(ev("subscription.activated", end), null, now)!;
    const first = applySubscriptionEvent(ev("subscription.pending", end), active, now)!;
    const later = applySubscriptionEvent(ev("subscription.halted", end), first, new Date("2026-03-05T00:00:00Z"))!;
    expect(later.grace_until).toBe(first.grace_until);
  });
  it("a later successful charge clears the grace period", () => {
    const failed = applySubscriptionEvent(ev("subscription.pending", end), null, now)!;
    const ok = applySubscriptionEvent(ev("subscription.charged", end + 2592000), failed, now)!;
    expect(ok.status).toBe("active");
    expect(ok.grace_until).toBeNull();
  });
  it("cancelling keeps Pro until the paid period ends", () => {
    const active = applySubscriptionEvent(ev("subscription.activated", end), null, now)!;
    const c = applySubscriptionEvent(ev("subscription.cancelled", end), active, new Date("2026-03-10T00:00:00Z"))!;
    expect(c.status).toBe("cancelled");
    expect(isPro(toSub(c), new Date("2026-03-20T00:00:00Z"))).toBe(true);
    expect(isPro(toSub(c), new Date("2026-04-02T00:00:00Z"))).toBe(false);
  });
  it("ignores events it does not act on", () => expect(applySubscriptionEvent(ev("subscription.authenticated"), null, now)).toBeNull());
  it("completion expires the plan", () => expect(applySubscriptionEvent(ev("subscription.completed"), null, now)!.status).toBe("expired"));
});

describe("webhook signature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "subscription.charged" });
  const good = crypto.createHmac("sha256", secret).update(body).digest("hex");
  it("accepts the right signature", () => expect(verifySignature(body, good, secret)).toBe(true));
  it("rejects a changed body", () => expect(verifySignature(body + " ", good, secret)).toBe(false));
  it("rejects a wrong or missing signature", () => {
    expect(verifySignature(body, "00".repeat(32), secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
    expect(verifySignature(body, good, "")).toBe(false);
  });
});
