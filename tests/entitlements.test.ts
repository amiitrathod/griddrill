import { describe, it, expect } from "vitest";
import { isPro, graceUntil, GRACE_DAYS } from "../lib/entitlements";

const d = (s: string) => new Date(s);
describe("Pro entitlement", () => {
  it("active is Pro", () => expect(isPro({ status: "active" })).toBe(true));
  it("none and expired are not", () => {
    expect(isPro({ status: "none" })).toBe(false);
    expect(isPro({ status: "expired" })).toBe(false);
    expect(isPro(null)).toBe(false);
  });
  it("failed payments get a 7-day grace period", () => {
    const failed = d("2026-03-01T00:00:00Z");
    const sub = { status: "past_due" as const, graceUntil: graceUntil(failed) };
    expect(GRACE_DAYS).toBe(7);
    expect(isPro(sub, d("2026-03-07T23:00:00Z"))).toBe(true);
    expect(isPro(sub, d("2026-03-08T00:00:01Z"))).toBe(false);
  });
  it("a cancelled plan stays Pro until the paid period ends", () => {
    const sub = { status: "cancelled" as const, renewsAt: "2026-04-01T00:00:00Z" };
    expect(isPro(sub, d("2026-03-20T00:00:00Z"))).toBe(true);
    expect(isPro(sub, d("2026-04-02T00:00:00Z"))).toBe(false);
  });
});
