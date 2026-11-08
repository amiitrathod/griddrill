"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./Providers";
import { PAYWALL_ENABLED } from "@/lib/config";
import { track } from "@/lib/analytics";

type Invoice = { id: string; amount: number; currency: string; status: string; at: number | null; url: string | null };
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "");

export function BillingPanel() {
  const { sub, getToken, refreshSub, pro } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sub || sub.status === "none") return;
    (async () => {
      const token = await getToken();
      const r = await fetch("/api/billing/invoices", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (r.ok) {
        const j = await r.json();
        setInvoices(j.invoices ?? []);
        setManageUrl(j.manageUrl ?? null);
      }
    })();
  }, [sub, getToken]);

  async function cancel() {
    const token = await getToken();
    const r = await fetch("/api/billing/cancel", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.ok) {
      track("subscription_cancelled");
      setMsg(`Cancelled. Pro stays on until ${date(sub?.renewsAt)}.`);
      setConfirm(false);
      refreshSub();
    } else setMsg((await r.json().catch(() => ({}))).error ?? "Could not cancel.");
  }

  if (!PAYWALL_ENABLED) {
    return (
      <section className="card p-6 max-w-prose" aria-labelledby="plan">
        <h2 id="plan" style={{ fontSize: "1.25rem" }}>Your plan</h2>
        <p className="mt-2">Everything is open during the public beta. <Link href="/pricing">See what Pro will include</Link>.</p>
      </section>
    );
  }
  return (
    <section className="card p-6 max-w-prose" aria-labelledby="plan">
      <h2 id="plan" style={{ fontSize: "1.25rem" }}>Your plan</h2>
      {!sub || sub.status === "none" || sub.status === "expired" ? (
        <>
          <p className="mt-2">You are on the free plan: modules 1 to 3 and the shortcut trainer.</p>
          <Link href="/pricing" className="btn-primary mt-4">See Pro</Link>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <p><span className="font-semibold">Pro</span> {sub.status === "active" && <>renews on {date(sub.renewsAt)}.</>}{sub.status === "cancelled" && <>ends on {date(sub.renewsAt)}. It will not renew.</>}{sub.status === "past_due" && <>The last payment failed. Pro stays on until {date(sub.graceUntil)} while we retry.</>}</p>
          {sub.status === "past_due" && manageUrl && <a className="btn-primary" href={manageUrl}>Update payment method</a>}
          {sub.status === "active" && !confirm && <div><button type="button" className="btn-secondary" onClick={() => setConfirm(true)}>Cancel plan</button></div>}
          {confirm && (
            <div role="alertdialog" aria-label="Confirm cancellation" className="flex flex-wrap gap-2 items-center">
              <p className="w-full">Pro keeps working until {date(sub?.renewsAt)}. You will not be charged again.</p>
              <button type="button" className="btn-primary" onClick={cancel}>Yes, cancel at the end of the period</button>
              <button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>Keep Pro</button>
            </div>
          )}
          {msg && <p role="status">{msg}</p>}
          {invoices.length > 0 && (
            <div className="mt-2">
              <h3>Receipts</h3>
              <ul className="mt-1 divide-y divide-neutral-200">
                {invoices.map((i) => (
                  <li key={i.id} className="py-2 flex flex-wrap gap-x-4">
                    <span className="flex-1">{i.at ? new Date(i.at * 1000).toLocaleDateString() : ""}</span>
                    <span>{i.currency} {i.amount}</span>
                    {i.url && <a href={i.url}>View</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {!pro && sub?.status === "past_due" && <p className="mt-2 text-error">Your grace period has ended.</p>}
    </section>
  );
}
