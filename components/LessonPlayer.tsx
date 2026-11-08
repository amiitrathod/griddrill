"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Lightbulb, WifiOff } from "lucide-react";
import { Grid, type ToolId } from "./grid/Grid";
import { useSheetController } from "./grid/useSheetController";
import { FeedbackButton } from "./FeedbackButton";
import { UpgradeNotice } from "./UpgradeNotice";
import { useAuth, useProgress } from "./Providers";
import { checkAnswer } from "@/lib/checker/check";
import { makeVariant } from "@/lib/checker/variant";
import type { CheckResult, Lesson } from "@/lib/checker/types";
import { canOpenModule } from "@/lib/entitlements";
import { track } from "@/lib/analytics";
import { tokens } from "@/docs/design-tokens";
import { completedCount } from "@/lib/progress/logic";

type Props = {
  lesson: Lesson;
  moduleTitle: string;
  moduleTier: "free" | "pro";
  moduleLessonIds: string[];
  next: { id: string; title: string } | null;
  /** When true (embedded exercises on marketing pages) the chrome is minimal and progress is not recorded. */
  embedded?: boolean;
};

function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const f = () => setOn(navigator.onLine);
    f();
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);
  return on;
}

export function LessonPlayer(props: Props) {
  const { pro } = useAuth();
  if (!props.embedded && !canOpenModule(props.moduleTier, pro)) return <UpgradeNotice moduleTitle={props.moduleTitle} />;
  return <Player {...props} />;
}

function Player({ lesson: base, moduleTitle, moduleLessonIds, next, embedded }: Props) {
  const progress = useProgress();
  const { user } = useAuth();
  const online = useOnline();
  const [variantN, setVariantN] = useState(0);
  const lesson = useMemo(() => (variantN === 0 ? base : makeVariant(base, `v${variantN}`)), [base, variantN]);
  const [phase, setPhase] = useState<"working" | "complete">("working");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<number | undefined>(undefined);
  const [gained, setGained] = useState(0);
  const started = useRef(false);

  const g = useSheetController(lesson.grid, lesson.target);
  const rec = progress.state.lessons[base.id];

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      track("exercise_started", { lessonId: base.id });
    }
  }, [base.id]);

  const tools: ToolId[] = useMemo(() => {
    const t: ToolId[] = ["copy", "paste", "undo"];
    if (lesson.module === "references") t.push("fill");
    if (lesson.check.type === "select") t.push("range");
    if (lesson.check.type === "format") t.push("bold", "format");
    return t;
  }, [lesson]);

  const doCheck = useCallback(() => {
    if (phase !== "working") return;
    const st = g.state();
    const r = checkAnswer(lesson, { raw: st.raw, formats: st.formats, bolds: st.bolds, selection: st.selection, choice });
    setResult(r);
    if (!embedded) progress.attempt(base.id);
    track("exercise_checked", { lessonId: base.id, result: r.ok ? "correct" : "wrong", attempts: wrong + 1 });
    if (r.ok) {
      if (!embedded) {
        if (revealed) progress.reveal(base.id);
        const xp = progress.complete(base.id, base.xp);
        setGained(xp);
        track("lesson_completed", { lessonId: base.id });
      }
      setPhase("complete");
    } else setWrong((w) => w + 1);
  }, [phase, g, lesson, choice, embedded, progress, base.id, base.xp, wrong, revealed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doCheck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doCheck]);

  function showHint() {
    const level = Math.min(hintLevel + 1, lesson.hints.length);
    if (level !== hintLevel) {
      setHintLevel(level);
      if (!embedded) progress.hint(base.id);
      track("hint_used", { lessonId: base.id, hintLevel: level });
    }
  }

  function reveal() {
    setRevealed(true);
    if (!embedded) progress.reveal(base.id);
    track("answer_revealed", { lessonId: base.id });
  }

  function similarTask() {
    setVariantN((n) => n + 1);
    setResult(null);
    setHintLevel(0);
    setChoice(undefined);
    setWrong(0);
  }

  const done = completedCount(progress.state, moduleLessonIds);
  const pct = phase === "complete" ? 100 : result ? 50 : 0;
  const quick = lesson.check.type === "quick" ? lesson.check : null;
  const sentences = [lesson.teach, lesson.example].filter(Boolean).join(" ");

  if (phase === "complete") {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-6 fade-in">
        <div role="status" className="card p-6 max-w-prose">
          <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 size={20} aria-hidden /> Correct.{gained > 0 && <span className="text-ink font-normal"> +{gained} XP</span>}</p>
          <h1 className="mt-4" style={{ fontSize: "1.5rem" }}>{lesson.title}</h1>
          <p className="mt-2"><span className="font-semibold">What you learned: </span>{lesson.teach}</p>
          {lesson.limit && <p className="mt-2 text-sm text-neutral-700"><span className="font-semibold">Good to know: </span>{lesson.limit}</p>}
          {!embedded && (
            <>
              <p className="mt-4 text-sm text-neutral-700">{moduleTitle}: {done} of {moduleLessonIds.length} lessons done.</p>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {next ? <Link href={`/lessons/${next.id}`} className="btn-primary">Next lesson: {next.title}</Link> : <Link href="/lessons" className="btn-primary">Back to all lessons</Link>}
                <Link href="/lessons" className="btn-secondary">All lessons</Link>
              </div>
              {!user && done >= 3 && (
                <p className="mt-4 text-sm">You have finished {done} lessons on this device. <Link href="/account?mode=signup">Create a free account</Link> to keep them if you switch devices.</p>
              )}
              <p className="mt-4 text-sm text-neutral-700">Pro adds every module, timed job tests and a certificate. <Link href="/pricing">See what Pro includes</Link>.</p>
            </>
          )}
        </div>
        {!embedded && <div className="mt-4"><FeedbackButton lessonId={base.id} /></div>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-content px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-700 min-w-0 truncate">
          {embedded ? "Try it" : <Link href="/lessons" className="text-neutral-700">{moduleTitle}</Link>} <span aria-hidden>/</span> <span className="font-semibold text-ink">{lesson.title}</span>
        </p>
        <div role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1 w-24 shrink-0 bg-neutral-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%`, transition: "width 180ms" }} />
        </div>
      </div>

      {!online && <p className="text-sm flex items-center gap-2 text-neutral-700"><WifiOff size={20} aria-hidden /> You are offline. Checking still works, and progress syncs when you reconnect.</p>}

      <div className="grid md:grid-cols-3 gap-4 items-start">
        <section aria-label="Task" className="md:col-span-1 flex flex-col gap-4">
          <p className="text-neutral-700">{sentences}</p>
          <p className="font-semibold text-lg" style={{ maxWidth: 640 }}>{lesson.task}</p>
          {variantN > 0 && <p className="text-sm text-neutral-700">This is a similar task with new numbers. Finish it to earn the points.</p>}

          {quick && (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Choose one answer</legend>
              {quick.choices.map((c, i) => (
                <label key={i} className={`flex items-center gap-2 rounded-control border px-4 ${choice === i ? "border-primary bg-surface" : "border-neutral-300 bg-surface"}`} style={{ minHeight: 44 }}>
                  <input type="radio" name="choice" checked={choice === i} onChange={() => setChoice(i)} />
                  <span className="font-mono">{c}</span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={doCheck} disabled={quick ? choice === undefined : false}>Check</button>
            <button type="button" className="btn-secondary" onClick={showHint} disabled={hintLevel >= lesson.hints.length}><Lightbulb size={20} aria-hidden /> Hint{hintLevel > 0 ? ` (${hintLevel}/${lesson.hints.length})` : ""}</button>
          </div>

          {hintLevel > 0 && (
            <ol className="list-decimal pl-6 flex flex-col gap-1 fade-in" aria-label="Hints">
              {lesson.hints.slice(0, hintLevel).map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          )}

          <div aria-live="polite" className="flex flex-col gap-2">
            {result && !result.ok && (
              <div className="card p-4 border-l-4 fade-in" style={{ borderLeftColor: tokens.color.error }}>
                <p className="flex items-center gap-2 font-semibold text-error"><AlertCircle size={20} aria-hidden /> Not quite</p>
                <dl className="mt-2 flex flex-col gap-1 text-base">
                  <div><dt className="inline font-semibold">Expected: </dt><dd className="inline font-mono">{result.expected}</dd></div>
                  <div><dt className="inline font-semibold">Found: </dt><dd className="inline font-mono">{result.found}</dd></div>
                  {result.explanation && <div><dt className="inline font-semibold">Likely cause: </dt><dd className="inline">{result.explanation.message}</dd></div>}
                </dl>
                {result.extra && result.extra.length > 0 && result.explanation?.rule !== "range" && (
                  <p className="mt-2 text-sm text-neutral-700">After copying down, {result.extra[0].cell} gives {result.extra[0].found}; it should give {result.extra[0].expected}.</p>
                )}
              </div>
            )}
          </div>

          {wrong >= 3 && !revealed && <button type="button" className="btn-link" onClick={reveal}>Show the answer</button>}
          {revealed && (
            <div className="card p-4 fade-in">
              <p className="font-semibold">One answer that works</p>
              <p className="font-mono mt-1 break-words">{lesson.accepted[0]}</p>
              <p className="text-sm text-neutral-700 mt-2">You earn full points by doing a similar task.</p>
              {variantN === 0 && <button type="button" className="btn-secondary mt-2" onClick={similarTask}>Try a similar task</button>}
            </div>
          )}
          {lesson.limit && <p className="text-sm text-neutral-700"><span className="font-semibold">Good to know: </span>{lesson.limit}</p>}
        </section>

        <section aria-label="Spreadsheet" className="md:col-span-2 min-w-0" key={`${lesson.id}-${variantN}`}>
          <Grid controller={g} tools={tools} markers={{ target: lesson.target, flagged: result && !result.ok ? result.explanation?.cells : [] }} />
          <p className="text-sm text-neutral-700 mt-2">The dashed cell is {lesson.target}. Press Ctrl+Enter to check from anywhere.</p>
        </section>
      </div>
      {!embedded && <FeedbackButton lessonId={base.id} />}
    </div>
  );
}
