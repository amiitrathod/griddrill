/** Pure progress rules from PRD section 10. No storage, no network: everything here is unit tested. */

export type XpEvent = { key: string; type: "answer" | "finish" | "daily" | "shortcut"; xp: number; ref?: string; at: string };
export type LessonRecord = {
  status: "in_progress" | "completed";
  attempts: number;
  hintsUsed: number;
  xpEarned: number;
  revealed: boolean;
  completedAt?: string;
};
export type StreakState = { current: number; longest: number; lastActive: string | null; freezesLeft: number; freezeWeek: string };
export type ShortcutStat = { attempts: number; avgMs: number; lastSeen: string; nextDue: string; box: number; learned: boolean };
export type ProgressState = {
  v: 1;
  lessons: Record<string, LessonRecord>;
  events: XpEvent[];
  streak: StreakState;
  shortcuts: Record<string, ShortcutStat>;
  placement?: { startModule: number; score: number };
  daily: Record<string, { lessonId: string; done: boolean }>;
};

export const XP = { finishLesson: 20, daily: 15, shortcutLearned: 5 } as const;
export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900] as const;
/** Beyond level 8 each level needs 600 more total XP than the one before (PRD: adjust after real data). */
export const XP_PER_LEVEL_AFTER_8 = 600;

export function emptyProgress(): ProgressState {
  return { v: 1, lessons: {}, events: [], streak: { current: 0, longest: 0, lastActive: null, freezesLeft: 1, freezeWeek: "" }, shortcuts: {}, daily: {} };
}

export function totalXp(s: ProgressState): number {
  return s.events.reduce((a, e) => a + e.xp, 0);
}

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  if (xp >= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) {
    level = LEVEL_THRESHOLDS.length + Math.floor((xp - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) / XP_PER_LEVEL_AFTER_8);
  }
  return level;
}

export function levelStart(level: number): number {
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * XP_PER_LEVEL_AFTER_8;
}

export function levelInfo(xp: number) {
  const level = levelFor(xp);
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, xp, start, next, into: xp - start, needed: next - start, pct: Math.min(100, Math.round(((xp - start) / (next - start)) * 100)) };
}

/** XP for the answer, scaled from the lesson's base XP: first try 100%, with a hint 60%, after reveal 30%. */
export function answerXp(base: number, o: { hintsUsed: number; revealed: boolean; attempts: number }): number {
  if (o.revealed) return Math.round(base * 0.3);
  if (o.hintsUsed > 0) return Math.round(base * 0.6);
  return base;
}

// ---------- days and streaks (the learner's local day, never UTC) ----------
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}
/** Monday of the week containing the given day. */
export function weekStart(s: string): string {
  const n = dayNumber(s);
  const dow = (((n + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday; Monday = 0
  const d = new Date((n - dow) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** One free freeze per week, applied automatically when exactly one day was missed. */
export function registerActivity(st: StreakState, today: string): StreakState {
  const s = { ...st };
  const wk = weekStart(today);
  if (s.freezeWeek !== wk) {
    s.freezeWeek = wk;
    s.freezesLeft = 1;
  }
  if (s.lastActive === today) return s;
  if (s.lastActive === null) {
    s.current = 1;
  } else {
    const gap = daysBetween(s.lastActive, today);
    if (gap === 1) s.current += 1;
    else if (gap === 2 && s.freezesLeft > 0) {
      s.freezesLeft -= 1;
      s.current += 1;
    } else if (gap < 1) {
      return s; // clock went backwards; leave it alone
    } else s.current = 1;
  }
  s.lastActive = today;
  s.longest = Math.max(s.longest, s.current);
  return s;
}

export function streakView(st: StreakState, today: string): { current: number; longest: number; broken: boolean; line: string } {
  if (st.lastActive === null) return { current: 0, longest: st.longest, broken: false, line: "" };
  const gap = daysBetween(st.lastActive, today);
  const alive = gap <= 1 || (gap === 2 && (st.freezesLeft > 0 || weekStart(today) !== st.freezeWeek));
  if (alive) return { current: st.current, longest: st.longest, broken: false, line: "" };
  return { current: 0, longest: st.longest, broken: true, line: `Your longest streak was ${st.longest} ${st.longest === 1 ? "day" : "days"}.` };
}

// ---------- recording progress ----------
function addEvent(s: ProgressState, e: XpEvent): ProgressState {
  if (s.events.some((x) => x.key === e.key)) return s;
  return { ...s, events: [...s.events, e] };
}

export function recordAttempt(s: ProgressState, lessonId: string): ProgressState {
  const cur = s.lessons[lessonId] ?? { status: "in_progress", attempts: 0, hintsUsed: 0, xpEarned: 0, revealed: false };
  return { ...s, lessons: { ...s.lessons, [lessonId]: { ...cur, attempts: cur.attempts + 1 } } };
}
export function recordHint(s: ProgressState, lessonId: string): ProgressState {
  const cur = s.lessons[lessonId] ?? { status: "in_progress", attempts: 0, hintsUsed: 0, xpEarned: 0, revealed: false };
  return { ...s, lessons: { ...s.lessons, [lessonId]: { ...cur, hintsUsed: cur.hintsUsed + 1 } } };
}
export function recordReveal(s: ProgressState, lessonId: string): ProgressState {
  const cur = s.lessons[lessonId] ?? { status: "in_progress", attempts: 0, hintsUsed: 0, xpEarned: 0, revealed: false };
  return { ...s, lessons: { ...s.lessons, [lessonId]: { ...cur, revealed: true } } };
}

export function completeLesson(s: ProgressState, lessonId: string, baseXp: number, now: Date = new Date()): { state: ProgressState; xpGained: number; alreadyDone: boolean } {
  const cur = s.lessons[lessonId] ?? { status: "in_progress", attempts: 1, hintsUsed: 0, xpEarned: 0, revealed: false };
  if (cur.status === "completed") return { state: s, xpGained: 0, alreadyDone: true };
  const at = now.toISOString();
  const a = answerXp(baseXp, cur);
  let next = addEvent(s, { key: `answer:${lessonId}`, type: "answer", xp: a, ref: lessonId, at });
  next = addEvent(next, { key: `finish:${lessonId}`, type: "finish", xp: XP.finishLesson, ref: lessonId, at });
  next = {
    ...next,
    lessons: { ...next.lessons, [lessonId]: { ...cur, status: "completed", xpEarned: a + XP.finishLesson, completedAt: at } },
    streak: registerActivity(next.streak, localDay(now)),
  };
  return { state: next, xpGained: a + XP.finishLesson, alreadyDone: false };
}

export function completeDaily(s: ProgressState, day: string, lessonId: string, now: Date = new Date()): { state: ProgressState; xpGained: number } {
  if (s.daily[day]?.done) return { state: s, xpGained: 0 };
  let next = addEvent(s, { key: `daily:${day}`, type: "daily", xp: XP.daily, ref: lessonId, at: now.toISOString() });
  next = { ...next, daily: { ...next.daily, [day]: { lessonId, done: true } }, streak: registerActivity(next.streak, localDay(now)) };
  return { state: next, xpGained: XP.daily };
}

// ---------- shortcut trainer: spaced repetition ----------
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const SLOW_MS = 4000;

export function recordShortcut(s: ProgressState, id: string, correct: boolean, ms: number, now: Date = new Date()): { state: ProgressState; xpGained: number } {
  const prev = s.shortcuts[id];
  const attempts = (prev?.attempts ?? 0) + 1;
  const avgMs = correct ? (prev && prev.avgMs > 0 ? Math.round(prev.avgMs * 0.6 + ms * 0.4) : Math.round(ms)) : prev?.avgMs ?? 0;
  let box = prev?.box ?? 0;
  const fast = correct && ms <= SLOW_MS;
  if (fast) box = Math.min(INTERVAL_DAYS.length - 1, box + 1);
  else if (!correct) box = 0;
  // correct but slow: stay in the same box so it comes back soon
  const due = new Date(now.getTime() + INTERVAL_DAYS[box] * 86400000);
  const learned = (prev?.learned ?? false) || correct;
  const stat: ShortcutStat = { attempts, avgMs, lastSeen: now.toISOString(), nextDue: due.toISOString(), box, learned };
  let next: ProgressState = { ...s, shortcuts: { ...s.shortcuts, [id]: stat } };
  let xpGained = 0;
  if (correct && !prev?.learned) {
    next = addEvent(next, { key: `shortcut:${id}`, type: "shortcut", xp: XP.shortcutLearned, ref: id, at: now.toISOString() });
    xpGained = XP.shortcutLearned;
  }
  return { state: next, xpGained };
}

/** Pick the next shortcuts to practise: overdue and slow ones first, then new ones. */
export function pickShortcuts(stats: Record<string, ShortcutStat>, ids: string[], n: number, now: Date = new Date()): string[] {
  const t = now.getTime();
  const scored = ids.map((id) => {
    const st = stats[id];
    if (!st) return { id, score: 1000 - ids.indexOf(id) * 0.01 }; // new: after due items, in curriculum order
    const overdue = t - new Date(st.nextDue).getTime();
    if (overdue < 0) return { id, score: -1 };
    return { id, score: 2000 + st.avgMs / 10 + overdue / 3600000 + (st.box === 0 ? 500 : 0) };
  });
  return scored.filter((x) => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.id);
}

// ---------- merging guest progress into an account ----------
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const lessons: Record<string, LessonRecord> = { ...a.lessons };
  for (const [id, r] of Object.entries(b.lessons)) {
    const x = lessons[id];
    if (!x) lessons[id] = r;
    else if (x.status === "completed" && r.status !== "completed") lessons[id] = { ...x, attempts: Math.max(x.attempts, r.attempts) };
    else if (r.status === "completed" && x.status !== "completed") lessons[id] = { ...r, attempts: Math.max(x.attempts, r.attempts) };
    else lessons[id] = { ...x, attempts: Math.max(x.attempts, r.attempts), hintsUsed: Math.max(x.hintsUsed, r.hintsUsed), xpEarned: Math.max(x.xpEarned, r.xpEarned), revealed: x.revealed && r.revealed, completedAt: x.completedAt ?? r.completedAt };
  }
  const seen = new Set<string>();
  const events = [...a.events, ...b.events].filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
  const newer = (a.streak.lastActive ?? "") >= (b.streak.lastActive ?? "") ? a.streak : b.streak;
  const streak: StreakState = { ...newer, longest: Math.max(a.streak.longest, b.streak.longest) };
  const shortcuts: Record<string, ShortcutStat> = { ...a.shortcuts };
  for (const [id, st] of Object.entries(b.shortcuts)) {
    const x = shortcuts[id];
    shortcuts[id] = !x ? st : { ...(x.lastSeen >= st.lastSeen ? x : st), attempts: x.attempts + st.attempts, learned: x.learned || st.learned };
  }
  const daily = { ...b.daily, ...a.daily };
  for (const [d, v] of Object.entries(b.daily)) if (v.done) daily[d] = v;
  return { v: 1, lessons, events, streak, shortcuts, placement: a.placement ?? b.placement, daily };
}

export function completedCount(s: ProgressState, ids: string[]): number {
  return ids.filter((id) => s.lessons[id]?.status === "completed").length;
}
