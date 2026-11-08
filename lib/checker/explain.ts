import { Sheet, type CellValue } from "../grid/engine";
import { expandRange, referencedCells } from "../grid/refs";
import type { Explanation, LearnerState, Lesson, Val } from "./types";
import { extractCalls, functionsUsed, isBalanced, normalizeText, parseRange, rangeText, topLevelOperators } from "./parse";

export type Ctx = {
  lesson: Lesson;
  learner: LearnerState;
  target: string;
  formula: string; // what the learner typed in the target ("" if empty)
  expectedFormula: string; // first accepted answer
  expectedValue: Val | undefined;
  found: CellValue;
  sheet: Sheet;
};

type Rule = { id: string; run: (c: Ctx) => Explanation | null };

const isError = (v: CellValue): v is { error: string } => typeof v === "object" && v !== null && "error" in v;
const isFormula = (s: string) => s.trim().startsWith("=");

function refsOf(formula: string): string[] {
  return referencedCells(formula);
}

function stringCellsIn(c: Ctx): { addr: string; text: string }[] {
  const out: { addr: string; text: string }[] = [];
  const seen = new Set<string>();
  const f = c.formula;
  // include ranges
  const rangeRe = /\$?[A-Za-z]\$?\d+:\$?[A-Za-z]\$?\d+/g;
  const cells: string[] = [...refsOf(f)];
  for (const m of f.match(rangeRe) ?? []) cells.push(...expandRange(m));
  for (const a of cells) {
    if (seen.has(a)) continue;
    seen.add(a);
    const v = c.sheet.value(a);
    if (typeof v === "string") out.push({ addr: a, text: v });
  }
  return out;
}

export const RULES: Rule[] = [
  {
    id: "unbalanced-parens",
    run: (c) =>
      isFormula(c.formula) && !isBalanced(c.formula)
        ? {
            rule: "unbalanced-parens",
            message: "The brackets do not match. Every ( needs a ) and every opening quote needs a closing quote.",
            cells: [c.target],
          }
        : null,
  },
  {
    id: "empty-cell",
    run: (c) =>
      c.formula.trim() === ""
        ? { rule: "empty-cell", message: `${c.target} is empty. Click it and type your answer.`, cells: [c.target] }
        : null,
  },
  {
    id: "typed-value-not-formula",
    run: (c) => {
      const needsFormula = !!c.expectedFormula && isFormula(c.expectedFormula);
      if (!needsFormula || isFormula(c.formula) || c.formula.trim() === "") return null;
      return {
        rule: "typed-value-not-formula",
        message: `You typed a value into ${c.target}. Start with = so the cell calculates the answer from the data.`,
        cells: [c.target],
      };
    },
  },
  {
    id: "number-as-text",
    run: (c) => {
      const textNums = stringCellsIn(c).filter((x) => /^\s*-?[\d,]+(\.\d+)?\s*$/.test(x.text));
      if (textNums.length === 0) return null;
      const first = textNums[0];
      return {
        rule: "number-as-text",
        message: `${first.addr} holds the text "${first.text.trim()}", not a number, so the formula cannot add it up. Retype it without the apostrophe, or wrap it in VALUE().`,
        cells: textNums.map((x) => x.addr),
      };
    },
  },
  {
    id: "extra-spaces",
    run: (c) => {
      const spaced = stringCellsIn(c).filter((x) => x.text !== x.text.trim() || /\s{2,}/.test(x.text));
      if (spaced.length === 0) return null;
      const first = spaced[0];
      return {
        rule: "extra-spaces",
        message: `${first.addr} contains extra spaces ("${first.text}"), so it does not match what you are looking for. TRIM() removes them.`,
        cells: spaced.map((x) => x.addr),
      };
    },
  },
  {
    id: "missing-absolute-ref",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const exp = c.expectedFormula;
      const anchored = [...exp.matchAll(/\$[A-Za-z]\$?\d+|[A-Za-z]\$\d+/g)].map((m) => m[0]);
      if (anchored.length === 0) return null;
      const learnerNorm = normalizeText(c.formula);
      const missing = anchored.filter((a) => {
        const plain = a.replace(/\$/g, "").toUpperCase();
        const has$ = learnerNorm.includes(a.toUpperCase());
        const hasPlain = new RegExp(`(^|[^A-Z$])${plain}(?![0-9])`).test(learnerNorm);
        return !has$ && hasPlain;
      });
      if (missing.length === 0) return null;
      const cell = missing[0].replace(/\$/g, "").toUpperCase();
      return {
        rule: "missing-absolute-ref",
        message: `${cell} moves when the formula is copied down. Lock it by putting $ before the column letter and row number (${missing[0].toUpperCase()}).`,
        cells: [cell],
      };
    },
  },
  {
    id: "wrong-range",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const exp = extractCalls(c.expectedFormula);
      for (const lc of extractCalls(c.formula)) {
        const ec = exp.find((e) => e.name === lc.name);
        if (!ec) continue;
        for (let i = 0; i < Math.min(lc.args.length, ec.args.length); i++) {
          const lr = parseRange(lc.args[i]);
          const er = parseRange(ec.args[i]);
          if (!lr || !er || !/[:]/.test(ec.args[i])) continue;
          if (rangeText(lr) === rangeText(er)) continue;
          let detail: string;
          const extraCells: string[] = [];
          if (er.r2 > lr.r2 && er.c1 === lr.c1) {
            const lastCell = `${String.fromCharCode(65 + er.c2)}${er.r2}`;
            detail = `but the data runs to ${lastCell}`;
            extraCells.push(...expandRange(`${String.fromCharCode(65 + er.c1)}${lr.r2 + 1}:${lastCell}`));
          } else if (lr.r2 > er.r2 || lr.r1 < er.r1) {
            detail = `which includes cells that are not data (such as a heading or a blank)`;
            extraCells.push(...expandRange(rangeText(lr)).filter((a) => !expandRange(rangeText(er)).includes(a)));
          } else {
            detail = `but this task needs ${rangeText(er)}`;
          }
          return {
            rule: "wrong-range",
            message: `You used ${lc.name} on ${rangeText(lr)} ${detail}.`,
            cells: extraCells.length ? extraCells : expandRange(rangeText(er)),
          };
        }
      }
      return null;
    },
  },
  {
    id: "wrong-lookup-column",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const lc = extractCalls(c.formula).find((x) => x.name === "VLOOKUP");
      const ec = extractCalls(c.expectedFormula).find((x) => x.name === "VLOOKUP");
      if (!lc || !ec || lc.args.length < 3 || ec.args.length < 3) return null;
      const a = Number(lc.args[2]);
      const b = Number(ec.args[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
      return {
        rule: "wrong-lookup-column",
        message: `Your lookup returns column ${a} of the table, but the value you need is in column ${b}. Count columns from the first column of the table, starting at 1.`,
        cells: [],
      };
    },
  },
  {
    id: "approximate-match",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const exactFlag = (name: string, idx: number, args: string[]) =>
        args.length > idx && ["FALSE", "0"].includes(args[idx].toUpperCase().replace(/\(\)/g, ""));
      const specs: [string, number][] = [["VLOOKUP", 3], ["HLOOKUP", 3], ["MATCH", 2]];
      for (const [name, idx] of specs) {
        const lc = extractCalls(c.formula).find((x) => x.name === name);
        const ec = extractCalls(c.expectedFormula).find((x) => x.name === name);
        if (!lc || !ec) continue;
        if (exactFlag(name, idx, ec.args) && !exactFlag(name, idx, lc.args)) {
          const flag = name === "MATCH" ? "0" : "FALSE";
          return {
            rule: "approximate-match",
            message: `${name} without ${flag} as its last argument looks for the closest match, not an exact one, and can return a wrong row. Add ${flag} at the end.`,
            cells: [],
          };
        }
      }
      return null;
    },
  },
  {
    id: "wrong-function",
    run: (c) => {
      const check = c.lesson.check;
      if (check.type !== "formula" && check.type !== "fix") return null;
      const need = (check.mustUse ?? []).filter((m) => !["$", "=", "ref"].includes(m));
      if (need.length === 0 || !isFormula(c.formula)) return null;
      const used = functionsUsed(c.formula);
      const missing = need.filter((n) => !used.includes(n.toUpperCase()));
      if (missing.length === 0) return null;
      return {
        rule: "wrong-function",
        message: `This lesson practises ${missing[0].toUpperCase()}, and your formula does not use it${used.length ? ` (it uses ${used.join(", ")})` : ""}.`,
        cells: [c.target],
      };
    },
  },
  {
    id: "wrong-operator",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const a = topLevelOperators(c.formula);
      const b = topLevelOperators(c.expectedFormula);
      if (a.length === 0 || a.length !== b.length) return null;
      const sameRefs = refsOf(c.formula).sort().join() === refsOf(c.expectedFormula).sort().join();
      if (!sameRefs) return null;
      const i = a.findIndex((op, k) => op !== b[k]);
      if (i < 0) return null;
      const names: Record<string, string> = { "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "^": "raise to a power", "&": "join text" };
      return {
        rule: "wrong-operator",
        message: `You used ${a[i]} where this task needs ${b[i]} (${names[b[i]] ?? "a different operation"}).`,
        cells: [c.target],
      };
    },
  },
  {
    id: "hardcoded-number",
    run: (c) => {
      if (!c.expectedFormula || !isFormula(c.formula)) return null;
      const strip = (f: string) => f.replace(/"(?:[^"]|"")*"/g, "").replace(/\$?[A-Za-z]\$?\d+/g, "");
      const lits = (f: string) => (strip(f).match(/(?<![A-Za-z])\d+(\.\d+)?/g) ?? []).map(Number);
      const l = lits(c.formula);
      const e = lits(c.expectedFormula);
      const extra = l.filter((n) => !e.includes(n));
      if (extra.length === 0) return null;
      if (refsOf(c.formula).length >= refsOf(c.expectedFormula).length) return null;
      return {
        rule: "hardcoded-number",
        message: `Your formula has the number ${extra[0]} typed inside it. If that cell changes, your answer will not. Point to the cell instead.`,
        cells: refsOf(c.expectedFormula),
      };
    },
  },
  {
    id: "error-value",
    run: (c) => {
      if (!isError(c.found)) return null;
      const e = c.found.error;
      const msg: Record<string, string> = {
        "#N/A": "#N/A means a lookup found nothing. Check that the value you search for exists in the first column of the table, and that there are no stray spaces.",
        "#VALUE!": "#VALUE! means a cell holds text where a number is needed, or an argument has the wrong kind of value.",
        "#REF!": "#REF! means the formula points at a cell or column that does not exist, for example a column number larger than the table is wide.",
        "#DIV/0!": "#DIV/0! means the formula divides by zero or by an empty cell.",
        "#NAME?": "#NAME? means the formula contains a word it does not recognise. Check the function name spelling, and put text in quotes.",
        "#ERROR!": "The formula cannot be read. Check the commas, brackets and quotes.",
      };
      return { rule: "error-value", message: msg[e] ?? `${e} is an error value. Read the formula left to right and check each reference.`, cells: [c.target] };
    },
  },
];

/** Rules always on, plus the ones the lesson names. Registry order decides priority. */
const ALWAYS = new Set(["unbalanced-parens", "empty-cell", "typed-value-not-formula", "wrong-function", "error-value"]);

export function explain(ctx: Ctx): Explanation | null {
  const wanted = new Set([...ALWAYS, ...ctx.lesson.explainRules]);
  for (const rule of RULES) {
    if (!wanted.has(rule.id)) continue;
    const hit = rule.run(ctx);
    if (hit) return hit;
  }
  return null;
}
