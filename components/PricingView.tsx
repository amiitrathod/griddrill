"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "./Providers";
import { PAYWALL_ENABLED, PRICES } from "@/lib/config";
import { track } from "@/lib/analytics";
import { tokens } from "@/docs/design-tokens";

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } } }

const FREE = ["Modules 1 to 3: 17 lessons from entering data to locking references", "The shortcut trainer with all 40 core shortcuts", "The 8-question placement check", "One sample job test, scored on the server"];
const PRO = ["Every module, including Logic and Lookups", "Timed job tests for accounting, MIS and data entry roles", "A score report that names your three weakest topics", "A certificate you can share, with a link that proves it is real", "Messy Data Lab, Formula Notebook export and the daily challenge"];

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("script"));
    document.body.appendChild(s);
  });
}

export function PricingView() {
  const auth = useAuth();
  const [region, setRegion] = useState<"IN" | "GLOBAL">("IN");
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    track("upgrade_viewed");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRegion(tz === "Asia/Calcutta" || tz === "Asia/Kolkata" ? "IN" : "GLOBAL");
  }, []);
  const P = PRICES[region];
  const price = plan === "monthly" ? P.monthly : P.yearly;
  const perMonth = plan === "yearly" ? Math.round(P.yearly / 12) : null;

  async function checkout() {
    setMsg(null);
    if (!auth.user) return;
    setBusy(true);
    track("checkout_started", { plan });
    try {
      const token = await auth.getToken();
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ plan, currency: P.currency }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not start checkout.");
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      const rz = new window.Razorpay!({
        key: j.keyId,
        subscription_id: j.subscriptionId,
        name: "Gridwise Pro",
        description: plan === "monthly" ? "Monthly plan" : "Yearly plan",
        prefill: { name: j.name ?? "", email: j.email ?? "" },
        handler: async (resp: Record<string, string>) => {
          const t = await auth.getToken();
          const v = await fetch("/api/billing/verify", { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(resp) });
          if (v.ok) {
            track("subscription_started", { plan });
            await auth.refreshSub();
            setMsg("Payment received. Pro is on.");
          } else setMsg("Payment went through but we could not confirm it yet. Pro will switch on within a few minutes; contact us if it does not.");
        },
      });
      rz.open();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {!PAYWALL_ENABLED && (
        <div className="card p-4 max-w-prose" role="note"><p><span className="font-semibold">Everything is free during the public beta.</span> The prices below start when Pro opens, and beta learners are told before that happens.</p></div>
      )}
      <div className="flex flex-wrap gap-4">
        <fieldset><legend className="label">Billing</legend>
          <div className="flex gap-2">
            {(["monthly", "yearly"] as const).map((p) => <label key={p} className={`rounded-control border px-4 flex items-center gap-2 bg-surface ${plan === p ? "border-primary" : "border-neutral-300"}`} style={{ minHeight: 44 }}><input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} />{p === "monthly" ? "Monthly" : "Yearly"}</label>)}
          </div>
        </fieldset>
        <fieldset><legend className="label">Pay in</legend>
          <div className="flex gap-2">
            {(["IN", "GLOBAL"] as const).map((r) => <label key={r} className={`rounded-control border px-4 flex items-center gap-2 bg-surface ${region === r ? "border-primary" : "border-neutral-300"}`} style={{ minHeight: 44 }}><input type="radio" name="region" checked={region === r} onChange={() => setRegion(r)} />{r === "IN" ? "Rupees" : "US dollars"}</label>)}
          </div>
        </fieldset>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="card p-6" aria-labelledby="free">
          <h2 id="free" style={{ fontSize: "1.25rem" }}>Free</h2>
          <p className="text-3xl font-semibold mt-2">{P.symbol}0</p>
          <ul className="mt-4 flex flex-col gap-2">{FREE.map((f) => <li key={f} className="flex gap-2"><Check size={20} className="text-success shrink-0 mt-1" aria-hidden />{f}</li>)}</ul>
          <Link href="/lessons" className="btn-secondary mt-6">Start free</Link>
        </section>
        <section className="card p-6 border-primary" aria-labelledby="pro" style={{ borderColor: tokens.color.primary }}>
          <h2 id="pro" style={{ fontSize: "1.25rem" }}>Pro</h2>
          <p className="text-3xl font-semibold mt-2">{P.symbol}{price}<span className="text-base font-normal text-neutral-700"> per {plan === "monthly" ? "month" : "year"}</span></p>
          {perMonth && <p className="text-sm text-neutral-700">That is about {P.symbol}{perMonth} a month.</p>}
          <ul className="mt-4 flex flex-col gap-2">{PRO.map((f) => <li key={f} className="flex gap-2"><Check size={20} className="text-success shrink-0 mt-1" aria-hidden />{f}</li>)}</ul>
          {PAYWALL_ENABLED ? (
            auth.pro && auth.sub?.status === "active" ? <p className="mt-6 font-semibold">You are on Pro.</p> :
            auth.user ? <button type="button" className="btn-primary mt-6" onClick={checkout} disabled={busy}>Get Pro</button> :
            <Link href="/account?mode=signup" className="btn-primary mt-6">Create an account to get Pro</Link>
          ) : <p className="mt-6 text-neutral-700">Opens after the public beta.</p>}
          {msg && <p role="status" className="mt-2">{msg}</p>}
          <p className="mt-4 text-sm text-neutral-700">Cancel any time; Pro runs to the end of the period you paid for. Payments are handled by a licensed processor, and card details never reach our servers.</p>
        </section>
      </div>
      <section className="max-w-prose" aria-labelledby="classroom"><h2 id="classroom" style={{ fontSize: "1.25rem" }}>Teaching a group?</h2><p className="mt-2 text-neutral-700">Trainers and colleges: create a class, assign modules and see who has finished what. <Link href="/classroom">Classroom tools</Link> are free while we run pilots.</p></section>
    </div>
  );
}
