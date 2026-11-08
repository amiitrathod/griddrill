import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { checkOverlay } from "../lib/checker/check";
import type { Lesson } from "../lib/checker/types";

const dir = path.join(__dirname, "../content/lessons");
const lessons: Lesson[] = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

describe("lesson files", () => {
  it("has 30 lessons for the beta modules", () => {
    expect(lessons.filter((l) => /^(getting-around|first-formulas|references|logic|lookups)$/.test(l.module)).length).toBe(30);
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it("has at least 3 correct and 3 wrong tests", () => {
        expect(lesson.tests.correct.length).toBeGreaterThanOrEqual(3);
        expect(lesson.tests.wrong.length).toBeGreaterThanOrEqual(3);
      });
      lesson.tests.correct.forEach((o, i) =>
        it(`accepts correct answer #${i + 1}`, () => {
          const r = checkOverlay(lesson, o);
          expect(r.ok, JSON.stringify({ o, r })).toBe(true);
        })
      );
      lesson.tests.wrong.forEach((o, i) =>
        it(`rejects wrong answer #${i + 1}`, () => {
          const r = checkOverlay(lesson, o);
          expect(r.ok, JSON.stringify({ o, r })).toBe(false);
          expect(r.message.length).toBeGreaterThan(5);
        })
      );
      if (["formula", "fix"].includes(lesson.check.type)) {
        it("every accepted answer passes", () => {
          for (const a of lesson.accepted) {
            const r = checkOverlay(lesson, { [lesson.target]: a });
            expect(r.ok, JSON.stringify({ a, r })).toBe(true);
          }
        });
      }
    });
  }
});
