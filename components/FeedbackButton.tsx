"use client";
import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useAuth } from "./Providers";

export function FeedbackButton({ lessonId }: { lessonId?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { getToken } = useAuth();
  const ref = useRef<HTMLTextAreaElement>(null);

  async function send() {
    if (msg.trim().length < 3) return;
    setState("sending");
    try {
      const token = await getToken();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ lessonId, message: msg.trim(), page: window.location.pathname, browser: navigator.userAgent.slice(0, 200) }),
      });
      if (!res.ok) throw new Error("failed");
      track("feedback_sent", { lessonId });
      setState("sent");
      setMsg("");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <button type="button" className="btn-link text-sm" onClick={() => { setOpen((o) => !o); setState("idle"); setTimeout(() => ref.current?.focus(), 0); }} aria-expanded={open}>
        Report a problem with this {lessonId ? "lesson" : "page"}
      </button>
      {open && (
        <div className="card p-4 mt-2 max-w-prose fade-in">
          {state === "sent" ? (
            <p>Thank you. We read every report.</p>
          ) : (
            <>
              <label htmlFor="fb" className="label">What went wrong? Do not include passwords.</label>
              <textarea id="fb" ref={ref} className="input" style={{ minHeight: 96 }} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} />
              {state === "error" && <p className="text-error mt-2">Could not send. Please try again, or email us from the Contact page.</p>}
              <div className="flex gap-2 mt-2">
                <button type="button" className="btn-secondary" onClick={send} disabled={state === "sending" || msg.trim().length < 3}>Send report</button>
                <button type="button" className="btn-link" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
