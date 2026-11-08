"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Container } from "@/components/Container";
import { getSupabase } from "@/lib/supabase/client";

export default function ResetPage() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return setMsg("Accounts are not set up on this site yet.");
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else setDone(true);
  }
  return (
    <Container className="py-8">
      <h1 className="mb-6">Choose a new password</h1>
      {done ? (
        <p role="status">Your password is changed. <Link href="/account">Go to your account</Link>.</p>
      ) : (
        <form onSubmit={submit} className="card p-6 max-w-prose flex flex-col gap-4">
          <div><label className="label" htmlFor="pw">New password</label><input id="pw" type="password" minLength={8} required className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
          {msg && <p role="alert" className="text-error">{msg}</p>}
          <button className="btn-primary" type="submit">Save password</button>
        </form>
      )}
    </Container>
  );
}
