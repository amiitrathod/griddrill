/**
 * Product analytics (PRD section 14). Privacy rules, enforced here in one place:
 * - only the whitelisted properties below are ever sent; no email address and no text the learner typed
 * - nothing is sent until the learner allows analytics (unless NEXT_PUBLIC_ANALYTICS_DEFAULT=on)
 */
export const EVENT_NAMES = [
  "landing_view", "exercise_started", "exercise_checked", "hint_used", "answer_revealed", "lesson_completed",
  "signup_started", "signup_completed", "streak_extended", "shortcut_attempted", "test_started", "test_finished",
  "upgrade_viewed", "checkout_started", "subscription_started", "subscription_cancelled", "feedback_sent",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

type Props = Partial<{ lessonId: string; result: "correct" | "wrong"; attempts: number; hintLevel: number; shortcutId: string; testId: string; plan: string; page: string; source: string; score: number }>;
const ALLOWED = new Set(["lessonId", "result", "attempts", "hintLevel", "shortcutId", "testId", "plan", "page", "source", "score"]);

const CONSENT_KEY = "gridwise.consent.v1";
export type Consent = "granted" | "declined" | null;

let signedIn = false;
export function setSignedIn(v: boolean) {
  signedIn = v;
}

export function getConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}
export function setConsent(c: "granted" | "declined") {
  try {
    window.localStorage.setItem(CONSENT_KEY, c);
  } catch {}
}

function device(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

export function track(name: EventName, props: Props = {}) {
  if (typeof window === "undefined") return;
  const consent = getConsent();
  const allowedByDefault = process.env.NEXT_PUBLIC_ANALYTICS_DEFAULT === "on";
  if (consent === "declined" || (consent === null && !allowedByDefault)) return;
  const clean: Record<string, string | number | boolean> = { user: signedIn ? "signed_in" : "guest", device: device() };
  for (const [k, v] of Object.entries(props)) if (ALLOWED.has(k) && v !== undefined) clean[k] = v as string | number;
  const w = window as unknown as { plausible?: (n: string, o?: { props: unknown }) => void };
  if (w.plausible) w.plausible(name, { props: clean });
  try {
    const body = JSON.stringify({ name, props: clean, at: Date.now() });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } catch {}
}
