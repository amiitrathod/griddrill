import { Sheet, formatNumber, parseAddr, addr, type CellValue } from "../grid/engine";
import { shiftFormula } from "../grid/refs";
import { explain } from "./explain";
import { functionsUsed, parseRange, rangeText } from "./parse";
import type { CheckResult, LearnerState, Lesson, Val } from "./types";

export const TOLERANCE = 0.0001;

export function buildSheet(learner: LearnerState): Sheet {
  const s = new Sheet(learner.raw);
  for (const [a, f] of Object.entries(learner.formats ?? {})) s.setFormat(a, f);
  for (const a of learner.bolds ?? []) s.setBold(a, true);
  return s;
}

export function valuesEqual(found: CellValue, expected: Val, exactText = false): boolean {
  if (found === null) return expected === "" || expected === null;
  if (typeof found === "object") return false;
  if (typeof expected === "number") return typeof found === "number" && Math.abs(found - expected) <= TOLERANCE;
  if (typeof expected === "boolean") return found === expected;
  if (typeof found !== "string") return false;
  return exactText ? found === expected : found.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function show(v: CellValue | Val | undefined): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "object") return v.error;
  if (typeof v === "number") return formatNumber(v, "general");
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `"${v}"`;
}

export function normalizeCombo(c: string): string {
  const parts = c.toLowerCase().split("+").map((p) => p.trim());
  const mods = ["ctrl", "cmd", "alt", "shift"].filter((m) => parts.includes(m));
  const key = parts.filter((p) => !["ctrl", "cmd", "alt", "shift"].includes(p))[0] ?? "";
  return [...mods, key].join("+");
}

function normRange(s: string): string {
  const r = parseRange(s.replace(/\$/g, ""));
  return r ? rangeText(r) : s.toUpperCase();
}

function wrongUseMessage(need: string[]): string {
  const fns = need.filter((n) => !["=", "ref", "$"].includes(n));
  const parts: string[] = [];
  if (fns.length) parts.push(`uses ${fns.join(" and ")}`);
  if (need.includes("ref")) parts.push("points at the cells instead of typing their numbers");
  if (need.includes("$")) parts.push("locks the cell with $");
  if (need.includes("=")) parts.push("starts with =");
  return `The value is right, but this lesson asks for a formula that ${parts.join(" and ")}, so it keeps working when the data changes.`;
}

function fail(partial: Partial<CheckResult> & { expected: string; found: string }): CheckResult {
  return { ok: false, message: `Expected ${partial.expected}; found ${partial.found}.`, ...partial };
}

export function checkAnswer(lesson: Lesson, learner: LearnerState): CheckResult {
  const c = lesson.check;

  if (c.type === "quick") {
    const ok = learner.choice === c.correct;
    const found = learner.choice === undefined ? "no choice" : c.choices[learner.choice];
    return ok
      ? { ok, expected: c.choices[c.correct], found, message: "Correct." }
      : fail({ expected: c.choices[c.correct], found, explanation: undefined });
  }

  if (c.type === "shortcut") {
    const got = learner.shortcut ? normalizeCombo(learner.shortcut) : "";
    const want = normalizeCombo(c.combo);
    return got === want
      ? { ok: true, expected: c.combo, found: learner.shortcut ?? "", message: "Correct." }
      : fail({ expected: c.combo, found: learner.shortcut || "no keys pressed" });
  }

  if (c.type === "select") {
    const got = learner.selection ? normRange(learner.selection) : "";
    const ok = got === normRange(c.range);
    return ok
      ? { ok, expected: c.range, found: got, message: "Correct." }
      : fail({ expected: c.range, found: got || "nothing selected" });
  }

  const sheet = buildSheet(learner);
  try {
    if (c.type === "range") {
      const bad: { cell: string; expected: string; found: string }[] = [];
      for (const [a, exp] of Object.entries(c.expect)) {
        if (!valuesEqual(sheet.value(a), exp, c.exactText)) bad.push({ cell: a, expected: show(exp), found: show(sheet.value(a)) });
      }
      if (bad.length === 0) return { ok: true, expected: "", found: "", message: "Correct." };
      const b = bad[0];
      return fail({
        expected: `${b.expected} in ${b.cell}`,
        found: b.found,
        explanation: { rule: "range", message: bad.length > 1 ? `${bad.length} cells in the range are not right yet. The first is ${b.cell}.` : `${b.cell} is not right yet.`, cells: bad.map((x) => x.cell) },
        extra: bad.slice(1),
      });
    }

    if (c.type === "format") {
      const t = lesson.target;
      const problems: string[] = [];
      if (c.expectFormat && sheet.format(t) !== c.expectFormat) problems.push(`format ${c.expectFormat}`);
      if (c.expectBold !== undefined && sheet.isBold(t) !== c.expectBold) problems.push(c.expectBold ? "bold" : "no bold");
      if (c.expectValue !== undefined && !valuesEqual(sheet.value(t), c.expectValue)) problems.push(`value ${show(c.expectValue)}`);
      if (problems.length === 0) return { ok: true, expected: "", found: "", message: "Correct." };
      return fail({
        expected: `${t} with ${problems.join(" and ")}`,
        found: `${t} is ${show(sheet.value(t))} with format "${sheet.format(t)}"${sheet.isBold(t) ? ", bold" : ""}`,
        explanation: { rule: "format", message: "Select the cell, then change its format or style from the toolbar above the grid. The value underneath stays the same.", cells: [t] },
      });
    }

    // formula / fix
    const target = lesson.target;
    const raw = sheet.raw(target);
    const found = sheet.value(target);
    const ctx = {
      lesson,
      learner,
      target,
      formula: raw,
      expectedFormula: lesson.accepted[0] ?? "",
      expectedValue: c.expectValue,
      found,
      sheet,
    };

    const valueOk = valuesEqual(found, c.expectValue, c.exactText);
    const need = c.mustUse ?? [];
    const used = functionsUsed(raw);
    const stripped = raw.replace(/"(?:[^"]|"")*"/g, "");
    const usesOk = need.every((n) => {
      if (n === "$") return raw.includes("$");
      if (n === "=") return raw.trim().startsWith("=");
      if (n === "ref") return /(^|[^A-Za-z])\$?[A-Za-z]\$?\d+(?![\d(A-Za-z])/.test(stripped);
      return used.includes(n.toUpperCase());
    });

    // Second cell checks: simulate copying the target formula unless the learner filled it themselves.
    const extra: { cell: string; expected: string; found: string }[] = [];
    if (c.alsoCheck) {
      const tp = parseAddr(target)!;
      const scratch = buildSheet(learner);
      for (const [a, exp] of Object.entries(c.alsoCheck)) {
        const p = parseAddr(a)!;
        if (scratch.raw(a) === "" && raw.startsWith("=")) scratch.set(a, shiftFormula(raw, p.row - tp.row, p.col - tp.col));
        if (!valuesEqual(scratch.value(a), exp, c.exactText)) extra.push({ cell: a, expected: show(exp), found: show(scratch.value(a)) });
      }
      scratch.destroy();
    }

    if (valueOk && usesOk && extra.length === 0) return { ok: true, expected: show(c.expectValue), found: show(found), message: "Correct." };

    const explanation = explain(ctx) ?? undefined;
    if (!valueOk) {
      return fail({ expected: `${show(c.expectValue)} in ${target}`, found: show(found), explanation: explanation ?? { rule: "generic", message: "Re-read the task and check which cells your formula uses.", cells: [target] }, extra });
    }
    if (!usesOk) {
      return fail({ expected: `a formula that ${need.length ? "meets the lesson requirements" : "works"} (${need.map((n) => (n === "=" ? "starts with =" : n === "ref" ? "uses cell references" : n === "$" ? "uses $" : "uses " + n)).join(", ")})`, found: raw ? `"${raw}"` : "(empty)", explanation: explanation ?? { rule: "wrong-function", message: wrongUseMessage(need), cells: [target] },
      extra });
    }
    // value right, but the copied cell differs
    const e = extra[0];
    return fail({
      expected: `${e.expected} in ${e.cell} after copying the formula`,
      found: `${show(found)} in ${target} (right), but ${e.found} in ${e.cell}`,
      explanation: explanation ?? { rule: "copy-differs", message: `Your formula works in ${target} but gives a different result when copied to ${e.cell}. Check which references should stay fixed.`, cells: [e.cell] },
      extra,
    });
  } finally {
    sheet.destroy();
  }
}

/** Apply an overlay (test edits) to a lesson's starting grid and check it. */
export function checkOverlay(lesson: Lesson, overlay: Record<string, string | number>, extra: Partial<LearnerState> = {}): CheckResult {
  const raw: Record<string, string | number> = { ...lesson.grid } as Record<string, string | number>;
  const state: LearnerState = { raw, formats: {}, bolds: [], ...extra };
  for (const [k, v] of Object.entries(overlay)) {
    if (k === "__choice") state.choice = Number(v);
    else if (k === "__selection") state.selection = String(v);
    else if (k === "__shortcut") state.shortcut = String(v);
    else if (k.startsWith("__format:")) state.formats = { ...state.formats, [k.slice(9)]: v as never };
    else if (k.startsWith("__bold:")) state.bolds = [...(state.bolds ?? []), k.slice(7)];
    else raw[k] = v;
  }
  return checkAnswer(lesson, state);
}

export { addr };
