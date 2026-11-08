"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PLACEMENT, shuffled, startModuleFor } from "@/lib/placement";
import { useProgress } from "./Providers";

export function Placement({ modules, firstLessons }: { modules: { id: string; number: number; title: string }[]; firstLessons: Record<string, string> }) {
  const { setPlacement } = useProgress();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const seed = useMemo(() => Math.floor(Math.random() * 1000), []);
  const q = PLACEMENT[i];
  const sh = useMemo(() => (q ? shuffled(q, seed) : null), [q, seed]);

  if (!q || !sh) {
    const start = startModuleFor(answers);
    const mod = modules[start - 1];
    const score = answers.filter(Boolean).length;
    return (
      <div className="card p-6 max-w-prose fade-in" role="status">
        <h2 style={{ fontSize: "1.25rem" }}>{score} of 8 right. Start with module {mod.number}: {mod.title}.</h2>
        <p className="mt-2 text-neutral-700">{start === 1 ? "Module 1 takes about 10 minutes and covers the basics every later lesson uses." : `You can skip the earlier modules. They are still open if you want a refresher.`}</p>
        <div className="mt-4 flex gap-2">
          <Link href={`/lessons/${firstLessons[mod.id]}`} className="btn-primary" onClick={() => setPlacement(start, score)}>Start module {mod.number}</Link>
          <Link href="/lessons" className="btn-secondary" onClick={() => setPlacement(start, score)}>See all lessons</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card p-6 max-w-prose" onSubmit={(e) => { e.preventDefault(); if (picked === null) return; setAnswers((a) => [...a, picked === sh.correct]); setPicked(null); setI(i + 1); }}>
      <p className="text-sm text-neutral-700">Question {i + 1} of {PLACEMENT.length}</p>
      <fieldset className="mt-2">
        <legend className="text-lg font-semibold">{q.prompt}</legend>
        <div className="mt-4 flex flex-col gap-2">
          {sh.choices.map((c, k) => (
            <label key={c} className={`flex items-center gap-2 rounded-control border px-4 bg-surface ${picked === k ? "border-primary" : "border-neutral-300"}`} style={{ minHeight: 44 }}>
              <input type="radio" name="a" checked={picked === k} onChange={() => setPicked(k)} />
              <span className={q.code ? "font-mono" : ""}>{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn-primary mt-4" disabled={picked === null}>{i + 1 < PLACEMENT.length ? "Next question" : "See my starting point"}</button>
    </form>
  );
}
