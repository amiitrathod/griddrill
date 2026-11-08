import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeVariant } from "../lib/checker/variant";
import { checkOverlay } from "../lib/checker/check";
import type { Lesson } from "../lib/checker/types";

const dir = path.join(__dirname, "../content/lessons");
const lessons: Lesson[] = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

describe("similar task after a revealed answer", () => {
  for (const l of lessons.filter((x) => ["formula", "fix"].includes(x.check.type))) {
    it(`${l.id}: the accepted answer passes the variant`, () => {
      const v = makeVariant(l, "seed-1");
      const r = checkOverlay(v, { [v.target]: v.accepted[0] });
      expect(r.ok, JSON.stringify(r)).toBe(true);
    });
  }
  it("changes the numbers", () => {
    const l = lessons.find((x) => x.id === "sum-basic-01")!;
    const v = makeVariant(l, "seed-1");
    expect(JSON.stringify(v.grid)).not.toBe(JSON.stringify(l.grid));
  });
  it("shuffles quick-check choices but keeps the right answer", () => {
    const l = lessons.find((x) => x.id === "refs-named-01")!;
    const v = makeVariant(l, "s");
    if (v.check.type !== "quick" || l.check.type !== "quick") throw new Error("type");
    expect(v.check.choices[v.check.correct]).toBe(l.check.choices[l.check.correct]);
  });
});
