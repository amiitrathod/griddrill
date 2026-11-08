import { describe, it, expect } from "vitest";
import {
  emptyProgress, totalXp, levelFor, levelInfo, answerXp, completeLesson, recordAttempt, recordHint, recordReveal, registerActivity,
  streakView, weekStart, daysBetween, localDay, mergeProgress, recordShortcut, pickShortcuts, completeDaily, XP,
} from "../lib/progress/logic";

const at = (s: string) => new Date(`${s}T12:00:00`);

describe("XP and levels (PRD section 10)", () => {
  it("awards 10 / 6 / 3 for first try, hint, reveal", () => {
    expect(answerXp(10, { hintsUsed: 0, revealed: false, attempts: 1 })).toBe(10);
    expect(answerXp(10, { hintsUsed: 1, revealed: false, attempts: 2 })).toBe(6);
    expect(answerXp(10, { hintsUsed: 3, revealed: true, attempts: 4 })).toBe(3);
  });
  it("finishing a lesson adds 20", () => {
    const r = completeLesson(emptyProgress(), "a", 10, at("2026-03-02"));
    expect(r.xpGained).toBe(30);
    expect(totalXp(r.state)).toBe(30);
  });
  it("does not pay twice for the same lesson", () => {
    const once = completeLesson(emptyProgress(), "a", 10, at("2026-03-02"));
    const twice = completeLesson(once.state, "a", 10, at("2026-03-03"));
    expect(twice.alreadyDone).toBe(true);
    expect(totalXp(twice.state)).toBe(30);
  });
  it("uses hints and reveals when scoring", () => {
    let s = recordAttempt(emptyProgress(), "a");
    s = recordHint(s, "a");
    expect(completeLesson(s, "a", 10).xpGained).toBe(26);
    let t = recordAttempt(emptyProgress(), "b");
    t = recordReveal(t, "b");
    expect(completeLesson(t, "b", 10).xpGained).toBe(23);
  });
  it("matches the level table", () => {
    expect([0, 99, 100, 249, 250, 450, 700, 1000, 1400, 1899, 1900].map(levelFor)).toEqual([1, 1, 2, 2, 3, 4, 5, 6, 7, 7, 8]);
  });
  it("adds 600 XP per level past level 8", () => {
    expect(levelFor(2499)).toBe(8);
    expect(levelFor(2500)).toBe(9);
    expect(levelFor(3100)).toBe(10);
  });
  it("reports progress inside a level", () => {
    const i = levelInfo(175);
    expect(i.level).toBe(2);
    expect(i.into).toBe(75);
    expect(i.needed).toBe(150);
    expect(i.pct).toBe(50);
  });
  it("daily challenge is worth 15 and only once a day", () => {
    const a = completeDaily(emptyProgress(), "2026-03-02", "x", at("2026-03-02"));
    expect(a.xpGained).toBe(XP.daily);
    expect(completeDaily(a.state, "2026-03-02", "x").xpGained).toBe(0);
  });
});

describe("streaks", () => {
  it("counts consecutive days", () => {
    let s = emptyProgress().streak;
    s = registerActivity(s, "2026-03-02");
    s = registerActivity(s, "2026-03-03");
    s = registerActivity(s, "2026-03-04");
    expect(s.current).toBe(3);
  });
  it("two lessons on one day count once", () => {
    let s = registerActivity(emptyProgress().streak, "2026-03-02");
    s = registerActivity(s, "2026-03-02");
    expect(s.current).toBe(1);
  });
  it("uses the weekly freeze when exactly one day is missed", () => {
    let s = registerActivity(emptyProgress().streak, "2026-03-02"); // Monday
    s = registerActivity(s, "2026-03-03");
    s = registerActivity(s, "2026-03-05"); // missed Wednesday
    expect(s.current).toBe(3);
    expect(s.freezesLeft).toBe(0);
  });
  it("breaks when the freeze is already used", () => {
    let s = registerActivity(emptyProgress().streak, "2026-03-02");
    s = registerActivity(s, "2026-03-04"); // uses freeze
    s = registerActivity(s, "2026-03-06"); // another missed day, same week
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });
  it("refills the freeze on a new week", () => {
    let s = registerActivity(emptyProgress().streak, "2026-03-06"); // Friday
    s = registerActivity(s, "2026-03-08"); // Sunday, freeze used
    s = registerActivity(s, "2026-03-10"); // Tuesday next week: freeze refilled
    expect(s.current).toBe(3);
  });
  it("shows a neutral line, never a guilt message, after a break", () => {
    let s = emptyProgress().streak;
    for (const d of ["2026-03-02", "2026-03-03", "2026-03-04"]) s = registerActivity(s, d);
    const v = streakView(s, "2026-03-20");
    expect(v.broken).toBe(true);
    expect(v.line).toBe("Your longest streak was 3 days.");
    expect(v.line.toLowerCase()).not.toMatch(/lost|miss|sorry|don't give up/);
  });
  it("uses the learner's local day", () => {
    expect(localDay(new Date(2026, 2, 2, 23, 59))).toBe("2026-03-02");
    expect(localDay(new Date(2026, 2, 3, 0, 1))).toBe("2026-03-03");
  });
  it("week starts on Monday", () => {
    expect(weekStart("2026-03-08")).toBe("2026-03-02");
    expect(weekStart("2026-03-02")).toBe("2026-03-02");
    expect(daysBetween("2026-02-28", "2026-03-02")).toBe(2);
  });
});

describe("shortcut trainer", () => {
  it("first correct press earns 5 XP once", () => {
    const a = recordShortcut(emptyProgress(), "copy", true, 1200, at("2026-03-02"));
    expect(a.xpGained).toBe(5);
    expect(recordShortcut(a.state, "copy", true, 900, at("2026-03-03")).xpGained).toBe(0);
  });
  it("a slow correct press stays in its box and returns soon", () => {
    const a = recordShortcut(emptyProgress(), "copy", true, 1200, at("2026-03-02"));
    const slow = recordShortcut(a.state, "copy", true, 9000, at("2026-03-03"));
    expect(slow.state.shortcuts.copy.box).toBe(a.state.shortcuts.copy.box);
  });
  it("a miss resets the box", () => {
    let s = recordShortcut(emptyProgress(), "copy", true, 1000, at("2026-03-02")).state;
    s = recordShortcut(s, "copy", true, 1000, at("2026-03-03")).state;
    s = recordShortcut(s, "copy", false, 0, at("2026-03-04")).state;
    expect(s.shortcuts.copy.box).toBe(0);
  });
  it("brings back slow and due shortcuts before new ones", () => {
    let s = emptyProgress();
    s = recordShortcut(s, "b", true, 9000, at("2026-03-02")).state; // slow, due now
    s = recordShortcut(s, "a", true, 800, at("2026-03-02")).state;
    s = recordShortcut(s, "a", true, 800, at("2026-03-03")).state; // pushed out several days
    const order = pickShortcuts(s.shortcuts, ["a", "b", "c", "d"], 3, at("2026-03-04"));
    expect(order[0]).toBe("b");
    expect(order).not.toContain("a");
    expect(order).toContain("c");
  });
});

describe("guest to account merge", () => {
  it("keeps both sets of lessons and never double counts XP", () => {
    const guest = completeLesson(completeLesson(emptyProgress(), "l1", 10, at("2026-03-02")).state, "l2", 10, at("2026-03-02")).state;
    const account = completeLesson(emptyProgress(), "l2", 10, at("2026-03-01")).state;
    const merged = mergeProgress(account, guest);
    expect(Object.keys(merged.lessons).sort()).toEqual(["l1", "l2"]);
    expect(totalXp(merged)).toBe(60);
  });
  it("keeps the longer longest streak and the more recent current streak", () => {
    const a = emptyProgress();
    a.streak = { current: 2, longest: 9, lastActive: "2026-03-01", freezesLeft: 1, freezeWeek: "2026-02-23" };
    const b = emptyProgress();
    b.streak = { current: 4, longest: 4, lastActive: "2026-03-05", freezesLeft: 1, freezeWeek: "2026-03-02" };
    const m = mergeProgress(a, b);
    expect(m.streak.current).toBe(4);
    expect(m.streak.longest).toBe(9);
  });
  it("is stable when merged twice", () => {
    const g = completeLesson(emptyProgress(), "l1", 10, at("2026-03-02")).state;
    const once = mergeProgress(emptyProgress(), g);
    expect(totalXp(mergeProgress(once, g))).toBe(totalXp(once));
  });
});
