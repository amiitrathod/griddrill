"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth, useProgress } from "../Providers";
import { levelInfo, localDay, streakView } from "@/lib/progress/logic";
import { track } from "@/lib/analytics";

type Item = { id: string; title: string };

export function Hero({ first, all }: { first: Item; all: Item[] }) {
  const { state, ready, xp } = useProgress();
  const { user } = useAuth();
  useEffect(() => track("landing_view"), []);
  const resume = ready ? all.find((l) => state.lessons[l.id]?.status !== "completed") : undefined;
  const hasProgress = ready && Object.keys(state.lessons).length > 0;
  const target = hasProgress && resume ? resume : first;
  const lvl = levelInfo(xp);
  const sv = streakView(state.streak, localDay());
  return (
    <div>
      <h1 style={{ fontSize: "2.25rem" }}>Type the formula. Get checked in a second.</h1>
      <p className="mt-4 text-lg text-neutral-800">
        A practice spreadsheet in your browser. Each lesson is one small task. When your answer is wrong, it tells you which cell and why.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={`/lessons/${target.id}`} className="btn-primary">{hasProgress ? "Continue where you left off" : "Start learning"}</Link>
        {hasProgress && <span className="text-neutral-700">Next: {target.title}</span>}
      </div>
      {hasProgress && (
        <div className="mt-6 card p-4 max-w-prose" aria-label="Your progress">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <p><span className="font-semibold">Level {lvl.level}</span> <span className="text-neutral-700">{xp} XP</span></p>
            {sv.current > 0 && <p><span className="font-semibold">{sv.current}-day streak</span></p>}
            {sv.broken && <p className="text-neutral-700">{sv.line}</p>}
          </div>
          <div role="progressbar" aria-label={`Progress to level ${lvl.level + 1}`} aria-valuenow={lvl.pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1 bg-neutral-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${lvl.pct}%` }} />
          </div>
          {!user && <p className="mt-2 text-sm text-neutral-700">Saved on this device. <Link href="/account?mode=signup">Create an account</Link> to keep it everywhere.</p>}
        </div>
      )}
    </div>
  );
}
