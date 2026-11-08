import { describe, it, expect } from "vitest";
import { PLACEMENT, shuffled, startModuleFor } from "../lib/placement";

describe("placement check", () => {
  it("has 8 questions", () => expect(PLACEMENT.length).toBe(8));
  it("all wrong starts at module 1", () => expect(startModuleFor(Array(8).fill(false))).toBe(1));
  it("first tier right starts at module 2", () => expect(startModuleFor([true, true, false, false, false, false, false, false])).toBe(2));
  it("one miss in a tier stops the climb", () => expect(startModuleFor([true, true, true, false, true, true, true, true])).toBe(2));
  it("all right starts at module 5, the last beta module", () => expect(startModuleFor(Array(8).fill(true))).toBe(5));
  it("a lucky right answer later does not skip earlier tiers", () => expect(startModuleFor([false, false, true, true, true, true, true, true])).toBe(1));
  it("shuffling keeps the correct answer", () => {
    for (const q of PLACEMENT) for (const seed of [1, 7, 99]) {
      const s = shuffled(q, seed);
      expect(s.choices[s.correct]).toBe(q.choices[q.correct]);
      expect([...s.choices].sort()).toEqual([...q.choices].sort());
    }
  });
});
