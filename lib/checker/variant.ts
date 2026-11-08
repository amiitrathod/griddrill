import { Sheet, parseAddr, type RawGrid } from "../grid/engine";
import { shiftFormula } from "../grid/refs";
import type { Lesson } from "./types";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A similar task for after a revealed answer (PRD rule 5): same skill, different numbers.
 * Numbers are nudged, then the expected values are recomputed by running the lesson's own accepted answer,
 * so the new task is always consistent with the old one.
 */
export function makeVariant(lesson: Lesson, seed: string): Lesson {
  if (lesson.check.type === "quick") {
    const c = lesson.check;
    const shift = (hash(seed) % (c.choices.length - 1)) + 1;
    const order = c.choices.map((_, i) => (i + shift) % c.choices.length);
    return { ...lesson, check: { ...c, choices: order.map((i) => c.choices[i]), correct: order.indexOf(c.correct) } };
  }
  if (lesson.check.type !== "formula" && lesson.check.type !== "fix") return lesson;

  const grid: RawGrid = {};
  for (const [a, v] of Object.entries(lesson.grid)) {
    if (typeof v === "number" && !Number.isInteger(v)) grid[a] = v; // rates stay as they are
    else if (typeof v === "number") {
      const h = hash(a + seed) % 7; // 0..6
      grid[a] = v >= 20 ? Math.max(1, Math.round(v * (1 + (h - 3) / 20))) : Math.max(1, v + (h % 3) - 1);
    } else grid[a] = v;
  }
  const answer = lesson.accepted[0];
  if (!answer || !answer.startsWith("=")) return lesson;

  const scratch = new Sheet(grid);
  try {
    scratch.set(lesson.target, answer);
    const t = parseAddr(lesson.target)!;
    const expectValue = scratch.value(lesson.target);
    if (expectValue === null || typeof expectValue === "object") return lesson;
    const check = { ...lesson.check, expectValue } as typeof lesson.check & { alsoCheck?: Record<string, string | number | boolean> };
    if (check.alsoCheck) {
      const also: Record<string, string | number | boolean> = {};
      for (const a of Object.keys(check.alsoCheck)) {
        const p = parseAddr(a)!;
        scratch.set(a, shiftFormula(answer, p.row - t.row, p.col - t.col));
        const v = scratch.value(a);
        if (v === null || typeof v === "object") return lesson;
        also[a] = v;
      }
      check.alsoCheck = also;
    }
    return { ...lesson, grid, check };
  } finally {
    scratch.destroy();
  }
}
