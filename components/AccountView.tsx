"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth, useProgress } from "./Providers";
import { BillingPanel } from "./BillingPanel";
import { levelInfo, localDay, streakView } from "@/lib/progress/logic";
import { PRODUCT } from "@/lib/config";
import { tokens } from "@/docs/design-tokens";

export function AccountView() {
  const params = useSearchParams();
  const auth = useAuth();
  const { state, xp } = useProgress();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lvl = levelInfo(xp);
  const sv = streakView(state.streak, localDay());
  const done = Object.values(state.lessons).filter((l) => l.status === "completed").length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    let err: string | null = null;
    if (mode === "login") err = await auth.signIn(email, password);
    else if (mode === "signup") {
      err = await auth.signUp(email, password, name || email.split("@")[0]);
      if (!err) setMsg({ kind: "info", text: "Check your email for a confirmation link. Your progress from this device will be added to the account when you sign in." });
    } else {
      err = await auth.resetPassword(email);
      if (!err) setMsg({ kind: "info", text: "If that address has an account, a reset link is on its way." });
    }
    if (err) setMsg({ kind: "error", text: err });
    setBusy(false);
  }

  const summary = (
    <section aria-labelledby="progress" className="card p-6">
      <h2 id="progress" style={{ fontSize: "1.25rem" }}>Your progress</h2>
      <dl className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><dt className="text-sm text-neutral-700">Level</dt><dd className="text-2xl font-semibold">{lvl.level}</dd></div>
        <div><dt className="text-sm text-neutral-700">XP</dt><dd className="text-2xl font-semibold">{xp}</dd></div>
        <div><dt className="text-sm text-neutral-700">Streak</dt><dd className="text-2xl font-semibold">{sv.current} {sv.current === 1 ? "day" : "days"}</dd></div>
        <div><dt className="text-sm text-neutral-700">Lessons done</dt><dd className="text-2xl font-semibold">{done}</dd></div>
      </dl>
      <div role="progressbar" aria-label={`Progress to level ${lvl.level + 1}`} aria-valuenow={lvl.pct} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-1 bg-neutral-200 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${lvl.pct}%` }} /></div>
      <p className="mt-2 text-sm text-neutral-700">{lvl.needed - lvl.into} XP to level {lvl.level + 1}. {sv.broken ? sv.line : state.streak.longest > sv.current ? `Longest streak: ${state.streak.longest} days.` : ""}</p>
    </section>
  );

  if (!auth.configured) {
    return (
      <div className="flex flex-col gap-6">
        {summary}
        <div className="card p-6 max-w-prose">
          <h2 style={{ fontSize: "1.25rem" }}>Accounts</h2>
          <p className="mt-2">Accounts are not switched on for this copy of the site yet, so progress is saved only on this device. The site owner connects Supabase to turn on sign-up, sync and the guest-to-account merge (see SETUP.md).</p>
        </div>
      </div>
    );
  }

  if (auth.loading) return <p>Loading your account.</p>;

  if (!auth.user) {
    return (
      <div className="flex flex-col gap-6">
        {done > 0 && summary}
        <form onSubmit={submit} className="card p-6 max-w-prose flex flex-col gap-4">
          <h2 style={{ fontSize: "1.25rem" }}>{mode === "login" ? "Log in" : mode === "signup" ? "Create a free account" : "Reset your password"}</h2>
          {mode === "signup" && done > 0 && <p className="text-neutral-700">The {done} lessons you finished on this device will be added to your account.</p>}
          {mode === "signup" && (
            <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
          )}
          <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          {mode !== "forgot" && (
            <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /><p className="text-sm text-neutral-700 mt-1">At least 8 characters.</p></div>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-1" /><span>I am at least {PRODUCT.minimumAge} years old and accept the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.</span></label>
          )}
          {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "text-error" : "text-ink"}>{msg.text}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>{mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}</button>
          {mode !== "forgot" && <button type="button" className="btn-secondary" onClick={async () => { const e = await auth.signInGoogle(); if (e) setMsg({ kind: "error", text: e }); }}>Continue with Google</button>}
          <div className="flex flex-wrap gap-4 text-sm">
            {mode !== "login" && <button type="button" className="btn-link" onClick={() => setMode("login")}>I have an account</button>}
            {mode !== "signup" && <button type="button" className="btn-link" onClick={() => setMode("signup")}>Create an account</button>}
            {mode !== "forgot" && <button type="button" className="btn-link" onClick={() => setMode("forgot")}>Forgot password</button>}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ fontSize: "1.25rem" }}>Hello, {auth.user.name}</h2>
        <p className="text-neutral-700">{auth.user.email}</p>
      </div>
      {summary}
      <BillingPanel />
      <section className="card p-6 max-w-prose">
          <h2 style={{ fontSize: "1.25rem" }}>Teaching a group?</h2>
          <p className="mt-2">Trainers can create a class, assign modules and see who has finished what.</p>
          <Link href="/classroom" className="btn-secondary mt-4">Open classroom tools</Link>
        </section>
      <section className="card p-6 max-w-prose" aria-labelledby="settings">
        <h2 id="settings" style={{ fontSize: "1.25rem" }}>Settings</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div><button type="button" className="btn-secondary" onClick={() => auth.signOut()}>Sign out</button></div>
          <div>
            <h3>Delete account</h3>
            <p className="text-neutral-700 mt-1">This permanently deletes your account and every lesson, point, streak and certificate attached to it. Progress saved on this device stays.</p>
            {!confirmDelete ? (
              <button type="button" className="btn-secondary mt-2" onClick={() => setConfirmDelete(true)}>Delete my account</button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2" role="alertdialog" aria-label="Confirm account deletion">
                <button type="button" className="btn-primary" style={{ background: tokens.color.error, borderColor: tokens.color.error }} onClick={async () => { const e = await auth.deleteAccount(); if (e) setMsg({ kind: "error", text: e }); }}>Yes, delete everything</button>
                <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>Keep my account</button>
              </div>
            )}
            {msg && <p role="alert" className="text-error mt-2">{msg.text}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
