"use client";
import { useCallback, useRef, useState } from "react";
import { Sheet, addr, parseAddr, ROWS, COLS, type NumberFormat, type RawGrid } from "@/lib/grid/engine";
import { shiftFormula } from "@/lib/grid/refs";
import { fillValue } from "@/lib/grid/series";

export type Pos = { r: number; c: number };
export type Rect = { r1: number; c1: number; r2: number; c2: number };
type Snap = { raw: RawGrid; formats: Record<string, NumberFormat>; bolds: string[] };
type Clip = { rows: number; cols: number; cells: { dr: number; dc: number; raw: string; fmt: NumberFormat; bold: boolean }[]; from: Pos };

export const rectText = (r: Rect) => {
  const a = addr(r.r1, r.c1);
  const b = addr(r.r2, r.c2);
  return a === b ? a : `${a}:${b}`;
};

export function useSheetController(initial: RawGrid, startAt?: string) {
  const sheetRef = useRef<Sheet | null>(null);
  if (!sheetRef.current) sheetRef.current = new Sheet(initial);
  const sheet = sheetRef.current;
  const start = startAt ? parseAddr(startAt) : null;

  const [version, setVersion] = useState(0);
  const [active, setActiveState] = useState<Pos>(start ? { r: start.row, c: start.col } : { r: 0, c: 0 });
  const [anchor, setAnchor] = useState<Pos>(start ? { r: start.row, c: start.col } : { r: 0, c: 0 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const undo = useRef<Snap[]>([]);
  const clip = useRef<Clip | null>(null);
  const [hasClip, setHasClip] = useState(false);

  const bump = () => setVersion((v) => v + 1);
  const rect: Rect = {
    r1: Math.min(anchor.r, active.r),
    c1: Math.min(anchor.c, active.c),
    r2: Math.max(anchor.r, active.r),
    c2: Math.max(anchor.c, active.c),
  };

  const snap = useCallback((): Snap => ({ raw: sheet.snapshot(), formats: sheet.formatsSnapshot(), bolds: sheet.boldsSnapshot() }), [sheet]);

  const pushUndo = useCallback(() => {
    undo.current.push(snap());
    if (undo.current.length > 50) undo.current.shift();
    setCanUndo(true);
  }, [snap]);

  const restore = (s: Snap) => {
    for (const a of Object.keys(sheet.snapshot())) sheet.set(a, null);
    for (const a of Object.keys(sheet.formatsSnapshot())) sheet.setFormat(a, "general");
    for (const a of sheet.boldsSnapshot()) sheet.setBold(a, false);
    for (const [a, v] of Object.entries(s.raw)) sheet.set(a, v);
    for (const [a, f] of Object.entries(s.formats)) sheet.setFormat(a, f);
    for (const a of s.bolds) sheet.setBold(a, true);
  };

  const select = useCallback((p: Pos, extend = false) => {
    const clamped = { r: Math.max(0, Math.min(ROWS - 1, p.r)), c: Math.max(0, Math.min(COLS - 1, p.c)) };
    setActiveState(clamped);
    if (!extend) setAnchor(clamped);
    setEditing(false);
    setDraft(sheet.raw(addr(clamped.r, clamped.c)));
  }, [sheet]);

  const selectRange = (r: Rect) => {
    setAnchor({ r: r.r1, c: r.c1 });
    setActiveState({ r: r.r2, c: r.c2 });
    setEditing(false);
  };

  const commit = (a: string, raw: string) => {
    pushUndo();
    sheet.set(a, raw);
    bump();
  };

  const startEdit = (text?: string) => {
    const a = addr(active.r, active.c);
    setDraft(text !== undefined ? text : sheet.raw(a));
    setEditing(true);
  };

  /** Commit the draft into the active cell and optionally move. */
  const finishEdit = (move: "down" | "right" | "left" | "up" | "none") => {
    const a = addr(active.r, active.c);
    if (editing) {
      if (draft !== sheet.raw(a)) commit(a, draft);
      setEditing(false);
    }
    const d = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1], none: [0, 0] }[move];
    const next = { r: Math.max(0, Math.min(ROWS - 1, active.r + d[0])), c: Math.max(0, Math.min(COLS - 1, active.c + d[1])) };
    setActiveState(next);
    setAnchor(next);
    setDraft(sheet.raw(addr(next.r, next.c)));
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(sheet.raw(addr(active.r, active.c)));
  };

  const clearSelection = () => {
    pushUndo();
    for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) sheet.set(addr(r, c), null);
    bump();
    setDraft("");
  };

  const copy = () => {
    const cells: Clip["cells"] = [];
    for (let r = rect.r1; r <= rect.r2; r++)
      for (let c = rect.c1; c <= rect.c2; c++) {
        const a = addr(r, c);
        cells.push({ dr: r - rect.r1, dc: c - rect.c1, raw: sheet.raw(a), fmt: sheet.format(a), bold: sheet.isBold(a) });
      }
    clip.current = { rows: rect.r2 - rect.r1 + 1, cols: rect.c2 - rect.c1 + 1, cells, from: { r: rect.r1, c: rect.c1 } };
    setHasClip(true);
  };

  const cut = () => {
    copy();
    clearSelection();
  };

  const paste = () => {
    const cl = clip.current;
    if (!cl) return;
    pushUndo();
    const dRow = rect.r1 - cl.from.r;
    const dCol = rect.c1 - cl.from.c;
    for (const cell of cl.cells) {
      const r = rect.r1 + cell.dr;
      const c = rect.c1 + cell.dc;
      if (r >= ROWS || c >= COLS) continue;
      const a = addr(r, c);
      sheet.set(a, cell.raw.startsWith("=") ? shiftFormula(cell.raw, dRow, dCol) : cell.raw);
      sheet.setFormat(a, cell.fmt);
      sheet.setBold(a, cell.bold);
    }
    selectRange({ r1: rect.r1, c1: rect.c1, r2: Math.min(ROWS - 1, rect.r1 + cl.rows - 1), c2: Math.min(COLS - 1, rect.c1 + cl.cols - 1) });
    bump();
  };

  /** Extend the current selection to `to`, filling along one axis (the fill handle and Ctrl+D / Ctrl+R). */
  const fillTo = (to: Pos) => {
    const down = to.r > rect.r2;
    const right = to.c > rect.c2;
    if (!down && !right) return;
    pushUndo();
    if (down && (!right || to.r - rect.r2 >= to.c - rect.c2)) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const src: string[] = [];
        for (let r = rect.r1; r <= rect.r2; r++) src.push(sheet.raw(addr(r, c)));
        for (let r = rect.r2 + 1; r <= Math.min(ROWS - 1, to.r); r++) {
          const n = r - rect.r2 - 1;
          const srcIdx = n % src.length;
          const dRow = r - (rect.r1 + srcIdx);
          sheet.set(addr(r, c), fillValue(src, n, dRow, 0));
          sheet.setFormat(addr(r, c), sheet.format(addr(rect.r1 + srcIdx, c)));
        }
      }
      selectRange({ ...rect, r2: Math.min(ROWS - 1, to.r) });
    } else {
      for (let r = rect.r1; r <= rect.r2; r++) {
        const src: string[] = [];
        for (let c = rect.c1; c <= rect.c2; c++) src.push(sheet.raw(addr(r, c)));
        for (let c = rect.c2 + 1; c <= Math.min(COLS - 1, to.c); c++) {
          const n = c - rect.c2 - 1;
          const srcIdx = n % src.length;
          const dCol = c - (rect.c1 + srcIdx);
          sheet.set(addr(r, c), fillValue(src, n, 0, dCol));
          sheet.setFormat(addr(r, c), sheet.format(addr(r, rect.c1 + srcIdx)));
        }
      }
      selectRange({ ...rect, c2: Math.min(COLS - 1, to.c) });
    }
    bump();
  };

  /** Ctrl+D: copy the top row of the selection down through it. */
  const fillDown = () => {
    if (rect.r2 === rect.r1) {
      // Excel copies the cell above when only one cell is selected
      if (rect.r1 === 0) return;
      pushUndo();
      const above = addr(rect.r1 - 1, rect.c1);
      sheet.set(addr(rect.r1, rect.c1), sheet.raw(above).startsWith("=") ? shiftFormula(sheet.raw(above), 1, 0) : sheet.raw(above));
      bump();
      return;
    }
    pushUndo();
    for (let c = rect.c1; c <= rect.c2; c++) {
      const top = sheet.raw(addr(rect.r1, c));
      for (let r = rect.r1 + 1; r <= rect.r2; r++) sheet.set(addr(r, c), top.startsWith("=") ? shiftFormula(top, r - rect.r1, 0) : top);
    }
    bump();
  };

  const fillRight = () => {
    if (rect.c2 === rect.c1) return;
    pushUndo();
    for (let r = rect.r1; r <= rect.r2; r++) {
      const left = sheet.raw(addr(r, rect.c1));
      for (let c = rect.c1 + 1; c <= rect.c2; c++) sheet.set(addr(r, c), left.startsWith("=") ? shiftFormula(left, 0, c - rect.c1) : left);
    }
    bump();
  };

  const setFormat = (fmt: NumberFormat) => {
    pushUndo();
    for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) sheet.setFormat(addr(r, c), fmt);
    bump();
  };

  const toggleBold = () => {
    pushUndo();
    const on = !sheet.isBold(addr(active.r, active.c));
    for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) sheet.setBold(addr(r, c), on);
    bump();
  };

  const undoLast = () => {
    const s = undo.current.pop();
    if (!s) return;
    restore(s);
    setCanUndo(undo.current.length > 0);
    setEditing(false);
    bump();
    setDraft(sheet.raw(addr(active.r, active.c)));
  };

  return {
    sheet, version, active, anchor, rect, editing, draft, setDraft, canUndo, hasClip,
    select, selectRange, startEdit, finishEdit, cancelEdit, clearSelection, copy, cut, paste,
    fillTo, fillDown, fillRight, setFormat, toggleBold, undo: undoLast,
    commit,
    state: () => ({ raw: sheet.snapshot(), formats: sheet.formatsSnapshot(), bolds: sheet.boldsSnapshot(), selection: rectText(rect) }),
  };
}

export type SheetController = ReturnType<typeof useSheetController>;
