"use client";
import Link from "next/link";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { useAuth, useProgress } from "./Providers";
import { canOpenModule } from "@/lib/entitlements";
import { PAYWALL_ENABLED } from "@/lib/config";

type M = { id: string; number: number; title: string; summary: string; tier: "free" | "pro" };
type L = { id: string; module: string; title: string; minutes: number };

export function LessonList({ modules, lessons }: { modules: M[]; lessons: L[] }) {
  const { state, ready } = useProgress();
  const { pro } = useAuth();
  const firstOpen = lessons.find((l) => state.lessons[l.id]?.status !== "completed")?.id;
  const startModule = state.placement ? modules[state.placement.startModule - 1]?.id : undefined;
  return (
    <div className="flex flex-col gap-8">
      {modules.map((m) => {
        const ls = lessons.filter((l) => l.module === m.id);
        const done = ls.filter((l) => state.lessons[l.id]?.status === "completed").length;
        const open = canOpenModule(m.tier, pro);
        return (
          <section key={m.id} aria-labelledby={`m-${m.id}`}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 id={`m-${m.id}`}>{m.number}. {m.title}</h2>
              <span className="text-sm text-neutral-700">{ready ? `${done} of ${ls.length} done` : `${ls.length} lessons`}</span>
              {PAYWALL_ENABLED && m.tier === "pro" && <span className="text-sm font-semibold text-neutral-700 inline-flex items-center gap-1"><Lock size={20} aria-hidden /> Pro</span>}
              {startModule === m.id && <span className="text-sm font-semibold text-primary">Your starting point</span>}
            </div>
            <p className="text-neutral-700 mt-1">{m.summary}</p>
            <ul className="card mt-2 divide-y divide-neutral-200">
              {ls.map((l) => {
                const completed = state.lessons[l.id]?.status === "completed";
                return (
                  <li key={l.id}>
                    <Link href={`/lessons/${l.id}`} className="flex items-center gap-4 px-4 text-ink" style={{ minHeight: 52, textDecoration: "none" }}>
                      {completed ? <CheckCircle2 size={20} className="text-success shrink-0" aria-label="Completed" /> : open ? <Circle size={20} className="text-neutral-400 shrink-0" aria-label="Not started" /> : <Lock size={20} className="text-neutral-500 shrink-0" aria-label="Pro only" />}
                      <span className="flex-1">{l.title}</span>
                      {l.id === firstOpen && !completed && <span className="text-sm font-semibold text-primary">Next</span>}
                      <span className="text-sm text-neutral-600">{l.minutes} min</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
