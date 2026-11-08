import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { checkOverlay, normalizeCombo, valuesEqual } from "../lib/checker/check";
import type { Lesson } from "../lib/checker/types";
import { extractCalls, isBalanced, normalizeText, splitArgs } from "../lib/checker/parse";

const load = (id: string): Lesson => JSON.parse(fs.readFileSync(path.join(__dirname, "../content/lessons", `${id}.json`), "utf8"));
const why = (id: string, o: Record<string, string | number>) => checkOverlay(load(id), o).explanation;

describe("Error Explainer rules", () => {
  it("empty-cell", () => expect(why("sum-basic-01", {})?.rule).toBe("empty-cell"));
  it("typed-value-not-formula", () => expect(why("math-add-01", { B3: 1380 })?.rule).toBe("typed-value-not-formula"));
  it("unbalanced-parens", () => expect(why("sum-basic-01", { B6: "=SUM(B2:B5" })?.rule).toBe("unbalanced-parens"));
  it("wrong-range names the function and the last data cell", () => {
    const e = why("sum-basic-01", { B6: "=SUM(B2:B4)" });
    expect(e?.rule).toBe("wrong-range");
    expect(e?.message).toBe("You used SUM on B2:B4 but the data runs to B5.");
    expect(e?.cells).toContain("B5");
  });
  it("wrong-range when the range includes a heading", () => {
    const e = why("index-01", { F2: "=INDEX(C1:C5,3)" });
    expect(e?.rule).toBe("wrong-range");
  });
  it("missing-absolute-ref", () => {
    const e = why("refs-absolute-01", { B4: "=A4*B1" });
    expect(e?.rule).toBe("missing-absolute-ref");
    expect(e?.cells).toEqual(["B1"]);
  });
  it("hardcoded-number", () => expect(why("refs-absolute-01", { B4: "=A4*0.18" })?.rule).toBe("hardcoded-number"));
  it("wrong-operator", () => expect(why("math-add-01", { B3: "=B1-B2" })?.rule).toBe("wrong-operator"));
  it("wrong-function", () => expect(why("avg-01", { B6: "=SUM(B2:B5)" })?.rule).toBe("wrong-function"));
  it("wrong-lookup-column", () => {
    const e = why("vlookup-basic-01", { F2: "=VLOOKUP(E2,A2:C5,2,FALSE)" });
    expect(e?.rule).toBe("wrong-lookup-column");
    expect(e?.message).toContain("column 2");
    expect(e?.message).toContain("column 3");
  });
  it("approximate-match", () => expect(why("vlookup-exact-01", {})?.rule).toBe("approximate-match"));
  it("extra-spaces", () => {
    const e = why("vlookup-na-01", {});
    expect(e?.rule).toBe("extra-spaces");
    expect(e?.cells).toContain("E2");
  });
  it("error-value #NAME?", () => expect(why("if-basic-01", { C2: "=IF(B2>=40,Pass,Fail)" })?.message).toContain("#NAME?"));
  it("error-value #REF!", () => expect(why("vlookup-basic-01", { F2: "=VLOOKUP(E2,A2:C5,9,FALSE)" })?.rule).toBe("wrong-lookup-column"));
  it("number-as-text", () => {
    const l = load("sum-basic-01");
    l.explainRules = ["number-as-text"];
    const r = checkOverlay(l, { B3: "'3900", B6: "=SUM(B2:B5)" });
    expect(r.ok).toBe(false);
    expect(r.explanation?.rule).toBe("number-as-text");
    expect(r.explanation?.cells).toContain("B3");
  });
  it("message always says what was expected and what was found", () => {
    const r = checkOverlay(load("max-01"), { B6: "=MIN(B2:B5)" });
    expect(r.expected).toContain("17");
    expect(r.found).toBe("9");
  });
  it("shows both results when the copied cell differs (rule 3)", () => {
    const r = checkOverlay(load("refs-absolute-01"), { B4: "=A4*B1" });
    expect(r.ok).toBe(false);
    expect(r.extra?.[0].cell).toBe("B5");
  });
});

describe("answer-checking rules", () => {
  it("never marks a correct answer wrong because of typing case", () => {
    expect(checkOverlay(load("sum-basic-01"), { B6: "=sum(b2:b5)" }).ok).toBe(true);
  });
  it("numbers use a 0.0001 tolerance", () => {
    expect(valuesEqual(0.30000000000000004, 0.3)).toBe(true);
    expect(valuesEqual(0.3002, 0.3)).toBe(false);
  });
  it("text ignores case and surrounding spaces unless exact", () => {
    expect(valuesEqual("  Mon ", "mon")).toBe(true);
    expect(valuesEqual("  Mon ", "mon", true)).toBe(false);
  });
  it("two different formulas with the right value are both correct", () => {
    const l = load("math-multiply-01");
    expect(checkOverlay(l, { D2: "=B2*C2" }).ok).toBe(true);
    expect(checkOverlay(l, { D2: "=PRODUCT(B2:C2)" }).ok).toBe(true);
  });
  it("shortcut combos are normalised", () => {
    expect(normalizeCombo("Shift+Ctrl+L")).toBe("ctrl+shift+l");
  });
});

describe("formula reader", () => {
  it("splits top-level arguments only", () => expect(splitArgs('A1,IF(B1>1,"a,b","c"),3')).toEqual(["A1", 'IF(B1>1,"a,b","c")', "3"]));
  it("finds nested calls", () => expect(extractCalls("=IF(AND(A1>1,B1>2),1,0)").map((c) => c.name)).toEqual(["IF", "AND"]));
  it("balance check ignores brackets inside text", () => expect(isBalanced('=IF(A1=")","a","b")')).toBe(true));
  it("normalises spacing and case outside quotes", () => expect(normalizeText('= sum( a1 : a3 ) & "x y"')).toBe('=SUM(A1:A3)&"x y"'));
});
