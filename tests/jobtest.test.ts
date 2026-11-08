import { describe, it, expect } from "vitest";
import { TEMPLATES, generateTest, scoreTest, toPublic } from "../lib/jobtest";

describe("Job Test Mode", () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: builds ${t.topics.length} tasks and the model answer passes every one, across seeds`, () => {
      for (const seed of ["a", "b", "c", "seed-42", "9f3a"]) {
        const tasks = generateTest(t.id, seed);
        expect(tasks.length).toBe(t.topics.length);
        const answers = Object.fromEntries(tasks.map((x) => [x.id, x.lesson.accepted[0]]));
        const r = scoreTest(tasks, answers);
        expect(r.correct, `${t.id}/${seed}: ${JSON.stringify(r.perTask.filter((p) => !p.ok))}`).toBe(tasks.length);
      }
    });
  }
  it("the 20 to 30 timed tasks rule holds for full tests", () => {
    for (const t of TEMPLATES.filter((x) => x.proOnly)) expect(t.topics.length).toBeGreaterThanOrEqual(20);
    for (const t of TEMPLATES.filter((x) => x.proOnly)) expect(t.topics.length).toBeLessThanOrEqual(30);
  });
  it("the same seed gives the same test and a different seed gives different data", () => {
    const a = JSON.stringify(toPublic(generateTest("accounting-clerk", "s1")));
    expect(JSON.stringify(toPublic(generateTest("accounting-clerk", "s1")))).toBe(a);
    expect(JSON.stringify(toPublic(generateTest("accounting-clerk", "s2")))).not.toBe(a);
  });
  it("never sends answers to the browser", () => {
    const pub = JSON.stringify(toPublic(generateTest("mis-executive", "x")));
    expect(pub).not.toContain("expectValue");
    expect(pub).not.toContain("accepted");
    expect(pub).not.toContain('"lesson"');
  });
  it("a blank or wrong answer scores zero", () => {
    const tasks = generateTest("sample", "z");
    expect(scoreTest(tasks, {}).correct).toBe(0);
    expect(scoreTest(tasks, Object.fromEntries(tasks.map((t) => [t.id, "=1+1"]))).correct).toBe(0);
  });
  it("typing the answer as a number does not pass a task that needs a formula", () => {
    const tasks = generateTest("sample", "q");
    const r = scoreTest(tasks, { t1: "12345" });
    expect(r.perTask[0].ok).toBe(false);
  });
  it("ignores edits to data cells: only the target cell is read", () => {
    const tasks = generateTest("sample", "k");
    const t = tasks[0];
    const bad = scoreTest(tasks, { [t.id]: "=SUM(B2:B3)" });
    expect(bad.perTask[0].ok).toBe(false);
  });
  it("names the weakest topics for the score report", () => {
    const tasks = generateTest("accounting-clerk", "w");
    const answers = Object.fromEntries(tasks.filter((t) => t.topic !== "vlookup").map((t) => [t.id, t.lesson.accepted[0]]));
    const r = scoreTest(tasks, answers);
    expect(r.weakest[0].topic).toBe("vlookup");
    expect(r.weakest[0].lessonId).toBe("vlookup-basic-01");
  });
});
