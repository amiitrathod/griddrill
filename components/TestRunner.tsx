"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Grid } from "./grid/Grid";
import { useSheetController } from "./grid/useSheetController";
import { useAuth } from "./Providers";
import { track } from "@/lib/analytics";
import type { PublicTask, TestResult } from "@/lib/jobtest";

type Started = { attemptId: string; title: string; timeLimitSeconds: number; startedAt: string; tasks: PublicTask[] };
type Done = TestResult & { passMark: number; late: boolean; certificate: { code: string } | null; title: string };

function TaskGrid({ task, hidden, onAnswer }: { task: PublicTask; hidden: boolean; onAnswer: (id: string, raw: string) => void }) {
  const g = useSheetController(task.grid, task.target);
  const last = useRef("");
  useEffect(() => {
    const raw = g.sheet.raw(task.target);
    if (raw !== last.current) { last.current = raw; onAnswer(task.id, raw); }
  });
  return (
    <div hidden={hidden}>
      <Grid controller={g} markers={{ target: task.target }} tools={["copy", "paste", "fill", "undo"]} label={`Spreadsheet for task ${task.id}`} />
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function TestRunner({ testId, title, minutes, proOnly, blurb }: { testId: string; title: string; minutes: number; proOnly: boolean; blurb: string }) {
  const { user, pro, getToken } = useAuth();
  const [run, setRun] = useState<Started | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [left, setLeft] = useState(0);
  const [holder, setHolder] = useState("");
  const answers = useRef<Record<string, string>>({});
  const submitting = useRef(false);

  const submit = useCallback(async () => {
    if (!run || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const token = await getToken();
      const r = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ attemptId: run.attemptId, answers: answers.current, holderName: holder }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Could not submit. Try again."); submitting.current = false; return; }
      setDone(j);
      track("test_finished", { testId, score: Math.round(j.percent) });
    } catch {
      setErr("Could not reach the server. Your answers are still here, try again."); submitting.current = false;
    } finally { setBusy(false); }
  }, [run, getToken, holder, testId]);

  useEffect(() => {
    if (!run || done) return;
    const end = new Date(run.startedAt).getTime() + run.timeLimitSeconds * 1000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) void submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [run, done, submit]);

  async function start() {
    setErr(""); setBusy(true);
    try {
      const token = await getToken();
      const r = await fetch("/api/tests/start", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ testId }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Could not start the test."); return; }
      answers.current = {}; submitting.current = false;
      setRun(j); setIdx(0); setVisited(new Set([0]));
      track("test_started", { testId });
    } catch { setErr("Could not reach the server."); } finally { setBusy(false); }
  }

  const onAnswer = useCallback((id: string, raw: string) => { answers.current[id] = raw; }, []);
  const go = (i: number) => { setIdx(i); setVisited((v) => new Set(v).add(i)); };

  if (done) {
    return (
      <div className="card p-6 max-w-prose" role="status">
        <h1 style={{ fontSize: "1.5rem" }}>{done.title}: {Math.round(done.percent)}%</h1>
        <p className="mt-2">{done.correct} of {done.total} tasks correct.{done.late && " Time ran out before the answers arrived, so this attempt scored zero."}</p>
        {done.weakest.length > 0 && done.percent < 100 && (
          <>
            <h2 className="mt-4" style={{ fontSize: "1.125rem" }}>Repeat these lessons</h2>
            <ul className="mt-2 grid gap-1">
              {done.weakest.map((w) => (<li key={w.topic}><Link href={`/lessons/${w.lessonId}`} className="underline">{w.name}</Link> <span className="text-neutral-700">({w.correct} of {w.total} correct)</span></li>))}
            </ul>
          </>
        )}
        {!done.certificate && proOnly && !done.late && done.percent < done.passMark && <p className="mt-4">A certificate needs {done.passMark}% or more. Repeat the lessons above and try again.</p>}
        {done.certificate && (
          <p className="mt-4">Certificate issued: <a className="underline" href={`/api/certificates/${done.certificate.code}/pdf`} target="_blank" rel="noreferrer">download the PDF</a> or share <Link className="underline" href={`/verify/${done.certificate.code}`}>the verify link</Link>.</p>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" onClick={() => { setDone(null); setRun(null); }}>Take it again with new data</button>
          <Link href="/practice" className="btn-secondary">All tests</Link>
        </div>
      </div>
    );
  }

  if (!run) {
    const locked = proOnly && !pro;
    return (
      <div className="card p-6 max-w-prose">
        <h1 style={{ fontSize: "1.5rem" }}>{title}</h1>
        <p className="mt-2">{blurb}</p>
        <p className="mt-2">{minutes} minutes. One task at a time. No hints. The data is new every attempt.</p>
        {proOnly && <p className="mt-2 text-sm text-neutral-700">A finished Pro test earns a certificate you can verify online.</p>}
        {!user ? (
          <p className="mt-4"><Link href="/account" className="btn-primary">Log in to start</Link></p>
        ) : locked ? (
          <p className="mt-4"><Link href="/pricing" className="btn-primary">See Pro</Link></p>
        ) : (
          <div className="mt-4">
            {proOnly && (
              <label className="block mb-3 max-w-xs">
                <span className="text-sm">Name on the certificate</span>
                <input className="input mt-1 w-full" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={60} autoComplete="name" />
              </label>
            )}
            <button type="button" className="btn-primary" onClick={start} disabled={busy}>{busy ? "Starting…" : "Start the test"}</button>
          </div>
        )}
        {err && <p role="alert" className="mt-3 text-error">{err}</p>}
      </div>
    );
  }

  const task = run.tasks[idx];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold">Task {idx + 1} of {run.tasks.length}</p>
        <p className={left <= 60 ? "font-semibold text-error" : "font-semibold"} aria-live="off">Time left {fmt(left)}</p>
      </div>
      <div className="card p-4 mt-3"><p>{task.prompt}</p><p className="text-sm text-neutral-700 mt-1">Answer goes in cell {task.target}.</p></div>
      <div className="mt-3">
        {run.tasks.map((t, i) => visited.has(i) && <TaskGrid key={t.id} task={t} hidden={i !== idx} onAnswer={onAnswer} />)}
      </div>
      {err && <p role="alert" className="mt-3 text-error">{err}</p>}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button type="button" className="btn-secondary" disabled={idx === 0} onClick={() => go(idx - 1)}>Previous</button>
        {idx < run.tasks.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => go(idx + 1)}>Next task</button>
        ) : (
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Scoring…" : "Finish and score"}</button>
        )}
        {idx < run.tasks.length - 1 && <button type="button" className="btn-secondary" onClick={submit} disabled={busy}>Finish now</button>}
      </div>
    </div>
  );
}
