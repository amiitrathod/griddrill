import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyProgress, levelFor, totalXp, type LessonRecord, type ProgressState, type ShortcutStat } from "./logic";

export async function loadRemote(sb: SupabaseClient, uid: string): Promise<ProgressState> {
  const [lp, xp, st, sc, pr, dc] = await Promise.all([
    sb.from("lesson_progress").select("*").eq("user_id", uid),
    sb.from("xp_events").select("*").eq("user_id", uid),
    sb.from("streaks").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("shortcut_stats").select("*").eq("user_id", uid),
    sb.from("profiles").select("placement_module, placement_score").eq("id", uid).maybeSingle(),
    sb.from("daily_challenges").select("*").eq("user_id", uid),
  ]);
  const s = emptyProgress();
  for (const r of lp.data ?? [])
    s.lessons[r.lesson_id] = { status: r.status, attempts: r.attempts, hintsUsed: r.hints_used, xpEarned: r.xp_earned, revealed: r.revealed, completedAt: r.completed_at ?? undefined };
  s.events = (xp.data ?? []).map((r) => ({ key: r.key, type: r.event_type, xp: r.xp, ref: r.lesson_id ?? undefined, at: r.created_at }));
  if (st.data) s.streak = { current: st.data.current, longest: st.data.longest, lastActive: st.data.last_active, freezesLeft: st.data.freezes_left, freezeWeek: st.data.freeze_week ?? "" };
  for (const r of sc.data ?? []) s.shortcuts[r.shortcut_id] = { attempts: r.attempts, avgMs: r.avg_ms, lastSeen: r.last_seen, nextDue: r.next_due, box: r.box, learned: r.learned };
  if (pr.data?.placement_module) s.placement = { startModule: pr.data.placement_module, score: pr.data.placement_score ?? 0 };
  for (const r of dc.data ?? []) s.daily[r.day] = { lessonId: r.lesson_id, done: r.completed };
  return s;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Write only what changed since `prev`. Safe to call repeatedly: every write is an upsert or insert-if-new. */
export async function pushRemote(sb: SupabaseClient, uid: string, prev: ProgressState | null, next: ProgressState): Promise<void> {
  const jobs: PromiseLike<unknown>[] = [];

  const changedLessons = Object.entries(next.lessons).filter(([id, r]) => !same(prev?.lessons[id], r));
  if (changedLessons.length)
    jobs.push(
      sb.from("lesson_progress").upsert(
        changedLessons.map(([id, r]: [string, LessonRecord]) => ({
          user_id: uid, lesson_id: id, status: r.status, attempts: r.attempts, hints_used: r.hintsUsed, xp_earned: r.xpEarned, revealed: r.revealed, completed_at: r.completedAt ?? null, updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,lesson_id" }
      )
    );

  const known = new Set((prev?.events ?? []).map((e) => e.key));
  const newEvents = next.events.filter((e) => !known.has(e.key));
  if (newEvents.length)
    jobs.push(sb.from("xp_events").upsert(newEvents.map((e) => ({ user_id: uid, key: e.key, event_type: e.type, xp: e.xp, lesson_id: e.ref ?? null, created_at: e.at })), { onConflict: "user_id,key", ignoreDuplicates: true }));

  if (!same(prev?.streak, next.streak))
    jobs.push(sb.from("streaks").upsert({ user_id: uid, current: next.streak.current, longest: next.streak.longest, last_active: next.streak.lastActive, freezes_left: next.streak.freezesLeft, freeze_week: next.streak.freezeWeek }, { onConflict: "user_id" }));

  const changedSc = Object.entries(next.shortcuts).filter(([id, r]) => !same(prev?.shortcuts[id], r));
  if (changedSc.length)
    jobs.push(
      sb.from("shortcut_stats").upsert(
        changedSc.map(([id, r]: [string, ShortcutStat]) => ({ user_id: uid, shortcut_id: id, attempts: r.attempts, avg_ms: r.avgMs, last_seen: r.lastSeen, next_due: r.nextDue, box: r.box, learned: r.learned })),
        { onConflict: "user_id,shortcut_id" }
      )
    );

  const changedDaily = Object.entries(next.daily).filter(([d, r]) => !same(prev?.daily[d], r));
  if (changedDaily.length)
    jobs.push(sb.from("daily_challenges").upsert(changedDaily.map(([d, r]) => ({ user_id: uid, day: d, lesson_id: r.lessonId, completed: r.done })), { onConflict: "user_id,day" }));

  const xp = totalXp(next);
  if (!prev || totalXp(prev) !== xp || !same(prev.placement, next.placement))
    jobs.push(sb.from("profiles").update({ total_xp: xp, level: levelFor(xp), placement_module: next.placement?.startModule ?? null, placement_score: next.placement?.score ?? null }).eq("id", uid));

  await Promise.all(jobs);
}
