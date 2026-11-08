import { describe, it, expect } from "vitest";
import { shiftFormula, referencedCells, expandRange } from "../lib/grid/refs";

describe("shiftFormula", () => {
  it("moves relative references down", () => {
    expect(shiftFormula("=A4*B1", 1, 0)).toBe("=A5*B2");
  });
  it("keeps fully absolute references", () => {
    expect(shiftFormula("=A4*$B$1", 1, 0)).toBe("=A5*$B$1");
  });
  it("keeps the column when only the column is locked", () => {
    expect(shiftFormula("=$A4+B$1", 1, 1)).toBe("=$A5+C$1");
  });
  it("shifts ranges", () => {
    expect(shiftFormula("=SUM(A1:A3)", 0, 1)).toBe("=SUM(B1:B3)");
  });
  it("leaves text in quotes alone", () => {
    expect(shiftFormula('=IF(A1>0,"A1 ok","no")', 1, 0)).toBe('=IF(A2>0,"A1 ok","no")');
  });
  it("returns #REF! when moving off the sheet", () => {
    expect(shiftFormula("=A1", -1, 0)).toBe("=#REF!");
  });
  it("does not change plain values", () => {
    expect(shiftFormula("hello", 1, 1)).toBe("hello");
  });
});

describe("referencedCells / expandRange", () => {
  it("lists cells", () => {
    expect(referencedCells("=SUM(A1:A3)+$B$2")).toEqual(["A1", "A3", "B2"]);
  });
  it("expands a range", () => {
    expect(expandRange("A1:B2")).toEqual(["A1", "B1", "A2", "B2"]);
  });
});
