/**
 * Minimal error reporting to Sentry using its public envelope endpoint (no SDK needed).
 * Set NEXT_PUBLIC_SENTRY_DSN. If you prefer the full SDK, run `npx @sentry/wizard@latest -i nextjs` later;
 * reportError() can then be replaced by Sentry.captureException.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function parse(dsn: string) {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace("/", "");
    return { key: u.username, endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, project };
  } catch {
    return null;
  }
}

export function reportError(err: unknown, context: Record<string, string> = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  if (!DSN) {
    if (process.env.NODE_ENV !== "production") console.error("[reportError]", e, context);
    return;
  }
  const p = parse(DSN);
  if (!p) return;
  const event = {
    event_id: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    exception: { values: [{ type: e.name, value: e.message, stacktrace: undefined }] },
    tags: context,
    request: typeof window !== "undefined" ? { url: window.location.pathname } : undefined,
  };
  const body = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  try {
    fetch(`${p.endpoint}?sentry_version=7&sentry_key=${p.key}`, { method: "POST", body, keepalive: true });
  } catch {}
}

export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, { source: "window.onerror" }));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, { source: "unhandledrejection" }));
}
