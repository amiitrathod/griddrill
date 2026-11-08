import { PAYWALL_ENABLED } from "./config";

export type SubStatus = "none" | "active" | "past_due" | "cancelled" | "expired";
export type Sub = { status: SubStatus; renewsAt?: string | null; graceUntil?: string | null };

export const GRACE_DAYS = 7;

/** Pro access rules: active; failed payments get a 7-day grace period; a cancelled plan runs to the end of the paid period. */
export function isPro(sub: Sub | null | undefined, now: Date = new Date()): boolean {
  if (!sub) return false;
  const t = now.getTime();
  switch (sub.status) {
    case "active":
      return true;
    case "past_due":
      return !!sub.graceUntil && t < new Date(sub.graceUntil).getTime();
    case "cancelled":
      return !!sub.renewsAt && t < new Date(sub.renewsAt).getTime();
    default:
      return false;
  }
}

export function graceUntil(from: Date = new Date()): string {
  return new Date(from.getTime() + GRACE_DAYS * 86400000).toISOString();
}

/** Free: modules 1 to 3 and the shortcut trainer. Pro: everything. Open to all while the paywall is off. */
export function canOpenModule(tier: "free" | "pro", pro: boolean): boolean {
  return !PAYWALL_ENABLED || tier === "free" || pro;
}
