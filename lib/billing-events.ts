import { GRACE_DAYS, type SubStatus } from "./entitlements";

/** Pure state machine for subscription webhooks. The webhook route only parses, verifies and stores; the rules live here. */
export type SubRow = {
  status: SubStatus;
  renews_at: string | null;
  grace_until: string | null;
  cancelled_at: string | null;
};

export type RzEvent = {
  event: string;
  payload?: { subscription?: { entity?: { id: string; status?: string; current_end?: number | null; notes?: Record<string, string> } } };
};

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

export function applySubscriptionEvent(ev: RzEvent, prev: SubRow | null, now: Date = new Date()): SubRow | null {
  const ent = ev.payload?.subscription?.entity;
  const base: SubRow = prev ?? { status: "none", renews_at: null, grace_until: null, cancelled_at: null };
  const end = iso(ent?.current_end) ?? base.renews_at;
  const grace = new Date(now.getTime() + GRACE_DAYS * 86400000).toISOString();

  switch (ev.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return { status: "active", renews_at: end, grace_until: null, cancelled_at: null };
    case "subscription.pending": // a charge failed; the processor will retry
    case "subscription.halted": // retries exhausted
      // Keep the original grace deadline if there already is one, so repeated events cannot extend it forever.
      return { ...base, status: "past_due", renews_at: end, grace_until: base.status === "past_due" && base.grace_until ? base.grace_until : grace };
    case "subscription.cancelled":
      return { ...base, status: "cancelled", renews_at: end ?? now.toISOString(), grace_until: null, cancelled_at: base.cancelled_at ?? now.toISOString() };
    case "subscription.completed":
    case "subscription.expired":
      return { ...base, status: "expired", grace_until: null };
    default:
      return null; // not an event we act on (for example authenticated, updated)
  }
}
