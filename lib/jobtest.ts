import { Sheet, parseAddr, type RawGrid } from "./grid/engine";
import { shiftFormula } from "./grid/refs";
import { checkAnswer } from "./checker/check";
import type { Check, Lesson } from "./checker/types";

/** Job Test Mode task generation. Pure and seeded: the server rebuilds the exact same test from the seed when scoring. */

export type Topic = "sum" | "average" | "minmax" | "count" | "arith" | "percent" | "if" | "ifand" | "iferror" | "vlookup" | "indexmatch" | "trim";

export const TOPICS: Record<Topic, { name: string; lessonId: string }> = {
  sum: { name: "SUM and totals", lessonId: "sum-basic-01" },
  average: { name: "AVERAGE", lessonId: "avg-01" },
  minmax: { name: "MIN and MAX", lessonId: "min-01" },
  count: { name: "COUNT", lessonId: "count-01" },
  arith: { name: "Formulas with cell references", lessonId: "math-multiply-01" },
  percent: { name: "Percentages and locked cells ($)", lessonId: "refs-absolute-01" },
  if: { name: "IF", lessonId: "if-basic-01" },
  ifand: { name: "AND and OR inside IF", lessonId: "and-01" },
  iferror: { name: "IFERROR", lessonId: "iferror-01" },
  vlookup: { name: "VLOOKUP", lessonId: "vlookup-basic-01" },
  indexmatch: { name: "INDEX and MATCH", lessonId: "index-match-01" },
  trim: { name: "Cleaning data with TRIM", lessonId: "vlookup-na-01" },
};

export type JobTask = { id: string; topic: Topic; prompt: string; grid: RawGrid; target: string; lesson: Lesson };
export type PublicTask = { id: string; prompt: string; grid: RawGrid; target: string };

export type Template = { id: string; title: string; blurb: string; minutes: number; proOnly: boolean; topics: Topic[] };

const ACC: Topic[] = ["arith", "sum", "percent", "sum", "average", "if", "percent", "vlookup", "iferror", "count", "minmax", "ifand", "vlookup", "sum", "arith", "if", "percent", "indexmatch", "average", "iferror", "count", "vlookup", "minmax", "if"];
const MIS: Topic[] = ["sum", "count", "average", "vlookup", "indexmatch", "if", "ifand", "iferror", "minmax", "vlookup", "percent", "sum", "average", "if", "vlookup", "indexmatch", "count", "ifand", "arith", "iferror", "percent", "minmax", "vlookup", "sum"];
const DATA: Topic[] = ["arith", "sum", "count", "trim", "if", "average", "minmax", "count", "arith", "sum", "vlookup", "if", "iferror", "sum", "count", "minmax", "average", "arith", "vlookup", "if"];
const SAMPLE: Topic[] = ["sum", "arith", "percent", "if", "vlookup", "average", "iferror", "minmax", "count", "indexmatch"];

export const TEMPLATES: Template[] = [
  { id: "sample", title: "Sample job test", blurb: "Ten mixed tasks, 12 minutes. Free for every signed-in learner.", minutes: 12, proOnly: false, topics: SAMPLE },
  { id: "accounting-clerk", title: "Accounting clerk test", blurb: "Totals, tax, pass-fail checks and price lookups, the way accounts teams test them.", minutes: 30, proOnly: true, topics: ACC },
  { id: "mis-executive", title: "MIS executive test", blurb: "Lookups, counts, conditions and error handling on report-style data.", minutes: 30, proOnly: true, topics: MIS },
  { id: "data-entry", title: "Data entry and clean-up test", blurb: "Fast, accurate formulas on tidy and untidy lists.", minutes: 20, proOnly: true, topics: DATA },
];
export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

// ---------- seeded randomness ----------
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFor(seed: string) {
  let a = hashStr(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];
function sample<T>(r: Rng, xs: T[], n: number): T[] {
  const a = [...xs];
  const out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]);
  return out;
}
const L = (n: number) => String.fromCharCode(65 + n);

const NAMES = ["Asha", "Dev", "Ira", "Kabir", "Meera", "Rohan", "Sana", "Vikram", "Tara", "Zoya", "Nikhil", "Pooja"];
const PRODUCTS = ["Notebook", "Stapler", "Folder", "Marker", "Ruler", "Eraser", "Scissors", "Tape", "Highlighter", "Clipboard", "Envelope", "Pen set"];
const EXPENSES = ["Rent", "Power", "Internet", "Travel", "Supplies", "Repairs", "Salaries", "Insurance"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/** Build a task, computing expected values by running its own accepted formula on the generated data. */
function build(id: string, topic: Topic, prompt: string, grid: RawGrid, target: string, accepted: string, opts: { mustUse?: string[]; also?: string[]; exactText?: boolean } = {}): JobTask {
  const s = new Sheet(grid);
  try {
    s.set(target, accepted);
    const v = s.value(target);
    if (v === null || typeof v === "object") throw new Error(`task ${id}: accepted formula gives ${JSON.stringify(v)}`);
    const t = parseAddr(target)!;
    const check: Check = { type: "formula", expectValue: v, mustUse: opts.mustUse, exactText: opts.exactText } as Check;
    if (opts.also?.length) {
      const also: Record<string, string | number | boolean> = {};
      for (const a of opts.also) {
        const p = parseAddr(a)!;
        s.set(a, shiftFormula(accepted, p.row - t.row, p.col - t.col));
        const av = s.value(a);
        if (av === null || typeof av === "object") throw new Error(`task ${id}: copy to ${a} gives ${JSON.stringify(av)}`);
        also[a] = av;
      }
      (check as { alsoCheck?: Record<string, string | number | boolean> }).alsoCheck = also;
    }
    const lesson: Lesson = {
      id, module: "job-test", title: topic, minutes: 1, teach: "", grid, task: prompt, target, check, hints: [], explainRules: [],
      accepted: [accepted], xp: 0, tests: { correct: [], wrong: [] },
    };
    return { id, topic, prompt, grid, target, lesson };
  } finally {
    s.destroy();
  }
}

function lookupTable(r: Rng): { grid: RawGrid; rows: { code: string; name: string; price: number }[]; chosen: number } {
  const codes = sample(r, Array.from({ length: 40 }, (_, i) => 101 + i), 5).sort((a, b) => a - b);
  const names = sample(r, PRODUCTS, 5);
  const rows = codes.map((c, i) => ({ code: `P${c}`, name: names[i], price: int(r, 12, 180) }));
  const grid: RawGrid = { A1: "Code", B1: "Product", C1: "Price" };
  rows.forEach((x, i) => { grid[`A${i + 2}`] = x.code; grid[`B${i + 2}`] = x.name; grid[`C${i + 2}`] = x.price; });
  return { grid, rows, chosen: int(r, 0, 4) };
}

const GEN: Record<Topic, (id: string, r: Rng) => JobTask> = {
  sum(id, r) {
    const n = int(r, 5, 7);
    const labels = sample(r, EXPENSES.concat(MONTHS), n);
    const grid: RawGrid = { A1: "Item", B1: "Amount" };
    labels.forEach((l, i) => { grid[`A${i + 2}`] = l; grid[`B${i + 2}`] = int(r, 150, 9800); });
    const last = n + 1;
    return build(id, "sum", `In B${last + 1}, total the amounts in B2:B${last}.`, grid, `B${last + 1}`, `=SUM(B2:B${last})`, { mustUse: ["SUM"] });
  },
  average(id, r) {
    const n = int(r, 5, 6);
    const grid: RawGrid = { A1: "Student", B1: "Marks" };
    sample(r, NAMES, n).forEach((nm, i) => { grid[`A${i + 2}`] = nm; grid[`B${i + 2}`] = int(r, 41, 98); });
    return build(id, "average", `In B${n + 2}, find the average mark.`, grid, `B${n + 2}`, `=AVERAGE(B2:B${n + 1})`, { mustUse: ["AVERAGE"] });
  },
  minmax(id, r) {
    const n = int(r, 5, 6);
    const hi = r() < 0.5;
    const grid: RawGrid = { A1: "Store", B1: "Price" };
    sample(r, ["North", "South", "East", "West", "Central", "Harbour"], n).forEach((nm, i) => { grid[`A${i + 2}`] = nm; grid[`B${i + 2}`] = int(r, 120, 480); });
    return build(id, "minmax", `In B${n + 2}, find the ${hi ? "highest" : "lowest"} price.`, grid, `B${n + 2}`, `=${hi ? "MAX" : "MIN"}(B2:B${n + 1})`, { mustUse: [hi ? "MAX" : "MIN"] });
  },
  count(id, r) {
    const n = int(r, 6, 8);
    const grid: RawGrid = { A1: "Invoice", B1: "Amount" };
    let numeric = 0;
    for (let i = 0; i < n; i++) {
      grid[`A${i + 2}`] = `INV-${200 + i}`;
      if (r() < 0.65 || (i === n - 1 && numeric === 0)) { grid[`B${i + 2}`] = int(r, 300, 5000); numeric++; } else grid[`B${i + 2}`] = "Pending";
    }
    return build(id, "count", `In B${n + 2}, count how many invoices already have an amount (numbers only).`, grid, `B${n + 2}`, `=COUNT(B2:B${n + 1})`, { mustUse: ["COUNT"] });
  },
  arith(id, r) {
    const grid: RawGrid = { A1: "Item", B1: "Price", C1: "Qty", D1: "Total" };
    sample(r, PRODUCTS, 3).forEach((p, i) => { grid[`A${i + 2}`] = p; grid[`B${i + 2}`] = int(r, 12, 140); grid[`C${i + 2}`] = int(r, 2, 15); });
    return build(id, "arith", "In D2, work out the line total (price times quantity). The same formula must work when copied down to D3 and D4.", grid, "D2", "=B2*C2", { mustUse: ["=", "ref"], also: ["D3", "D4"] });
  },
  percent(id, r) {
    const rate = pick(r, [0.05, 0.12, 0.18, 0.28]);
    const grid: RawGrid = { A1: pick(r, ["GST rate", "Tax rate", "Commission rate"]), B1: rate, A3: "Amount", B3: "Amount due" };
    [4, 5, 6].forEach((row) => (grid[`A${row}`] = int(r, 5, 90) * 100));
    return build(id, "percent", `In B4, calculate the ${String(grid.A1).toLowerCase()} on the amount in A4, using the rate in B1. It must keep working when copied down to B5 and B6.`, grid, "B4", "=A4*$B$1", { mustUse: ["$"], also: ["B5", "B6"] });
  },
  if(id, r) {
    const cut = pick(r, [35, 40, 45, 50]);
    const grid: RawGrid = { A1: "Student", B1: "Marks", C1: "Result" };
    const names = sample(r, NAMES, 4);
    const marks = [cut + int(r, 1, 30), cut, cut - int(r, 1, 12), cut + int(r, 0, 20)];
    names.forEach((n, i) => { grid[`A${i + 2}`] = n; grid[`B${i + 2}`] = marks[i]; });
    return build(id, "if", `In C2, show "Pass" when the marks are ${cut} or more, otherwise "Fail". It must work when copied down to C5.`, grid, "C2", `=IF(B2>=${cut},"Pass","Fail")`, { mustUse: ["IF"], also: ["C3", "C4", "C5"] });
  },
  ifand(id, r) {
    const m = pick(r, [50, 60, 70]);
    const a = pick(r, [70, 75, 80]);
    const grid: RawGrid = { A1: "Candidate", B1: "Marks", C1: "Attendance %", D1: "Eligible" };
    const rows = [[m + 12, a + 10], [m + 20, a - 15], [m, a], [m - 8, a + 12]];
    sample(r, NAMES, 4).forEach((n, i) => { grid[`A${i + 2}`] = n; grid[`B${i + 2}`] = rows[i][0]; grid[`C${i + 2}`] = rows[i][1]; });
    return build(id, "ifand", `In D2, show "Yes" only when marks are at least ${m} AND attendance is at least ${a}, otherwise "No". It must work when copied down to D5.`, grid, "D2", `=IF(AND(B2>=${m},C2>=${a}),"Yes","No")`, { mustUse: ["IF", "AND"], also: ["D3", "D4", "D5"] });
  },
  iferror(id, r) {
    const grid: RawGrid = { A1: "Item", B1: "Sold", C1: "Target", D1: "Share" };
    const names = sample(r, PRODUCTS, 3);
    const zero = int(r, 1, 2);
    names.forEach((n, i) => { grid[`A${i + 2}`] = n; grid[`B${i + 2}`] = int(r, 20, 90); grid[`C${i + 2}`] = i === zero ? 0 : int(r, 50, 120); });
    return build(id, "iferror", 'In D2, divide sold by target. If the division fails, show "n/a" instead. It must work when copied down to D4.', grid, "D2", '=IFERROR(B2/C2,"n/a")', { mustUse: ["IFERROR"], also: ["D3", "D4"] });
  },
  vlookup(id, r) {
    const { grid, rows, chosen } = lookupTable(r);
    grid.E1 = "Find code";
    grid.E2 = rows[chosen].code;
    grid.F1 = pick(r, ["Price"]);
    return build(id, "vlookup", "In F2, use VLOOKUP to find the price for the code in E2 (exact match).", grid, "F2", "=VLOOKUP(E2,A2:C6,3,FALSE)", { mustUse: ["VLOOKUP"] });
  },
  indexmatch(id, r) {
    const { grid, rows, chosen } = lookupTable(r);
    grid.E1 = "Find code";
    grid.E2 = rows[chosen].code;
    return build(id, "indexmatch", "In F2, return the price for the code in E2 by combining INDEX and MATCH.", grid, "F2", "=INDEX(C2:C6,MATCH(E2,A2:A6,0))", { mustUse: ["INDEX", "MATCH"] });
  },
  trim(id, r) {
    const { grid, rows, chosen } = lookupTable(r);
    grid.E1 = "Find code";
    grid.E2 = `${rows[chosen].code} `;
    grid.F2 = "=VLOOKUP(E2,A2:C6,3,FALSE)";
    return build(id, "trim", "F2 shows #N/A because the code in E2 has a stray space. Fix F2 so it returns the price, without editing E2.", grid, "F2", "=VLOOKUP(TRIM(E2),A2:C6,3,FALSE)", { mustUse: ["VLOOKUP", "TRIM"] });
  },
};

export function generateTest(templateId: string, seed: string): JobTask[] {
  const t = getTemplate(templateId);
  if (!t) throw new Error("unknown test");
  return t.topics.map((topic, i) => GEN[topic](`t${i + 1}`, rngFor(`${seed}:${i}:${topic}`)));
}

export const toPublic = (tasks: JobTask[]): PublicTask[] => tasks.map(({ id, prompt, grid, target }) => ({ id, prompt, grid, target }));

export type TestResult = {
  correct: number;
  total: number;
  percent: number;
  byTopic: { topic: Topic; name: string; lessonId: string; correct: number; total: number }[];
  weakest: { topic: Topic; name: string; lessonId: string; correct: number; total: number }[];
  perTask: { id: string; ok: boolean }[];
};

/** Score from the learner's answer in each target cell only, never from cells they may have edited elsewhere. */
export function scoreTest(tasks: JobTask[], answers: Record<string, string>): TestResult {
  const perTask = tasks.map((t) => {
    const raw = (answers[t.id] ?? "").toString().slice(0, 500);
    const ok = raw.trim() !== "" && checkAnswer(t.lesson, { raw: { ...t.grid, [t.target]: raw } }).ok;
    return { id: t.id, ok };
  });
  const map = new Map<Topic, { correct: number; total: number }>();
  tasks.forEach((t, i) => {
    const e = map.get(t.topic) ?? { correct: 0, total: 0 };
    e.total++;
    if (perTask[i].ok) e.correct++;
    map.set(t.topic, e);
  });
  const byTopic = [...map.entries()].map(([topic, v]) => ({ topic, ...TOPICS[topic], ...v }));
  const weakest = [...byTopic].filter((b) => b.correct < b.total).sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total).slice(0, 3);
  const correct = perTask.filter((p) => p.ok).length;
  return { correct, total: tasks.length, percent: Math.round((correct / tasks.length) * 100), byTopic, weakest, perTask };
}
