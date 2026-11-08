"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useProgress } from "./Providers";
import { SHORTCUTS, choicesFor, comboFor, detectPlatform, eventToCombo, isReserved, prettyCombo, type Platform, type Shortcut } from "@/lib/shortcuts";
import { pickShortcuts, SLOW_MS } from "@/lib/progress/logic";
import { track } from "@/lib/analytics";

const SESSION = 5;
type Row = { s: Shortcut; ok: boolean; ms: number; xp: number };

export function ShortcutTrainer() {
  const progress = useProgress();
  const [platform, setPlatform] = useState<Platform>("windows");
  const [coarse, setCoarse] = useState(false);
  const [queue, setQueue] = useState<Shortcut[] | null>(null);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; pressed: string; xp: number; ms: number }>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const t0 = useRef(0);
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const start = useCallback(() => {
    const ids = pickShortcuts(progress.state.shortcuts, SHORTCUTS.map((s) => s.id), SESSION);
    setQueue(ids.map((id) => SHORTCUTS.find((s) => s.id === id)!));
    setI(0);
    setRows([]);
    setFeedback(null);
    t0.current = performance.now();
  }, [progress.state.shortcuts]);

  const cur = queue && i < queue.length ? queue[i] : null;
  const choiceMode = !!cur && (coarse || isReserved(cur, platform));
  const choices = useMemo(() => (cur ? choicesFor(cur, platform, SHORTCUTS, i + 1) : []), [cur, platform, i]);

  useEffect(() => {
    if (cur && !feedback && !choiceMode) area.current?.focus();
    if (cur && !feedback) t0.current = performance.now();
  }, [cur, feedback, choiceMode]);

  function answer(pressed: string) {
    if (!cur || feedback) return;
    const ms = Math.round(performance.now() - t0.current);
    const ok = pressed === comboFor(cur, platform);
    const xp = progress.shortcut(cur.id, ok, ms);
    track("shortcut_attempted", { shortcutId: cur.id, result: ok ? "correct" : "wrong" });
    setFeedback({ ok, pressed, xp, ms });
    setRows((r) => [...r, { s: cur, ok, ms, xp }]);
  }

  function onKey(e: React.KeyboardEvent) {
    if (feedback) return;
    const combo = eventToCombo(e.nativeEvent);
    if (!combo) return;
    e.preventDefault();
    e.stopPropagation();
    answer(combo);
  }

  const next = () => {
    setFeedback(null);
    setI((n) => n + 1);
  };

  if (!queue) {
    return (
      <div className="card p-6 max-w-prose">
        <h2 style={{ fontSize: "1.25rem" }}>Practise five shortcuts</h2>
        <p className="mt-2">You are shown what you want to do. Press the keys on your own keyboard and get an answer instantly. Shortcuts you are slow at come back sooner.</p>
        <fieldset className="mt-4">
          <legend className="label">Your keyboard</legend>
          <div className="flex gap-2">
            {(["windows", "mac"] as const).map((p) => (
              <label key={p} className={`flex items-center gap-2 rounded-control border px-4 ${platform === p ? "border-primary" : "border-neutral-300"} bg-surface`} style={{ minHeight: 44 }}>
                <input type="radio" name="platform" checked={platform === p} onChange={() => setPlatform(p)} /> {p === "windows" ? "Windows" : "Mac"}
              </label>
            ))}
          </div>
        </fieldset>
        {coarse && <p className="mt-2 text-sm text-neutral-700">This looks like a touch screen, so you will pick the right keys from three choices.</p>}
        <button type="button" className="btn-primary mt-4" onClick={start}>Start</button>
      </div>
    );
  }

  if (!cur) {
    const good = rows.filter((r) => r.ok).length;
    const xp = rows.reduce((a, r) => a + r.xp, 0);
    return (
      <div className="card p-6 max-w-prose fade-in" role="status">
        <h2 style={{ fontSize: "1.25rem" }}>{good} of {rows.length} right{xp > 0 ? `, +${xp} XP` : ""}</h2>
        <ul className="mt-4 divide-y divide-neutral-200">
          {rows.map((r) => (
            <li key={r.s.id} className="py-2 flex flex-wrap items-center gap-x-4">
              {r.ok ? <CheckCircle2 size={20} className="text-success" aria-label="Right" /> : <XCircle size={20} className="text-error" aria-label="Missed" />}
              <span className="flex-1 min-w-[160px]">{r.s.name}</span>
              <kbd className="font-mono text-sm">{prettyCombo(comboFor(r.s, platform), platform)}</kbd>
              <span className="text-sm text-neutral-700">{(r.ms / 1000).toFixed(1)} s{r.ok && r.ms > SLOW_MS ? ", a bit slow" : ""}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" onClick={start}>Five more</button>
          <button type="button" className="btn-secondary" onClick={() => setQueue(null)}>Finish</button>
        </div>
      </div>
    );
  }

  const target = comboFor(cur, platform);
  return (
    <div className="card p-6 max-w-prose">
      <p className="text-sm text-neutral-700">Shortcut {i + 1} of {queue.length}</p>
      <h2 className="mt-1" style={{ fontSize: "1.25rem" }}>{cur.prompt}</h2>

      {!feedback && !choiceMode && (
        <div ref={area} tabIndex={0} role="group" aria-label="Press the keys now" onKeyDown={onKey} className="mt-4 rounded-card border border-dashed border-neutral-400 bg-neutral-50 px-4 py-6 text-neutral-700">
          Press the keys now. Hold the modifier keys, then tap the last key.
        </div>
      )}
      {!feedback && choiceMode && (
        <div className="mt-4">
          <p className="text-sm text-neutral-700">{isReserved(cur, platform) ? "Your browser keeps these keys for itself, so we cannot capture them. Pick the right ones." : "Pick the right keys."}</p>
          <div className="mt-2 flex flex-col gap-2" role="group" aria-label="Choices">
            {choices.map((c) => (
              <button key={c} type="button" className="btn-secondary justify-start font-mono" onClick={() => answer(c)}>{prettyCombo(c, platform)}</button>
            ))}
          </div>
        </div>
      )}
      {!feedback && !choiceMode && <button type="button" className="btn-link mt-2" onClick={() => answer("skipped")}>I do not know this one</button>}

      {feedback && (
        <div role="status" className="mt-4 fade-in">
          {feedback.ok ? (
            <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 size={20} aria-hidden /> Correct <span className="text-ink font-normal">in {(feedback.ms / 1000).toFixed(1)} s{feedback.xp ? `, +${feedback.xp} XP` : ""}</span></p>
          ) : (
            <p className="flex items-start gap-2"><XCircle size={20} className="text-error shrink-0 mt-1" aria-hidden /><span><span className="font-semibold text-error">Not quite.</span> {feedback.pressed === "skipped" ? "" : <>You pressed <kbd className="font-mono">{prettyCombo(feedback.pressed, platform)}</kbd>. </>}It is <kbd className="font-mono font-semibold">{prettyCombo(target, platform)}</kbd>.</span></p>
          )}
          <button type="button" className="btn-primary mt-4" onClick={next} autoFocus>{i + 1 < queue.length ? "Next shortcut" : "See results"}</button>
        </div>
      )}
    </div>
  );
}
