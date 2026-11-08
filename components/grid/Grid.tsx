"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { BoxSelect, Bold, ClipboardPaste, Copy, ArrowDownToLine, Undo2 } from "lucide-react";
import { addr, colLabel, COLS, ROWS, FORMAT_LABELS, type NumberFormat } from "@/lib/grid/engine";
import { tokens } from "@/docs/design-tokens";
import { rectText, type Pos, type SheetController } from "./useSheetController";

const COL_W = 96;
const HEADER_H = 32;
const ROWHDR_W = 48;

export type GridMarkers = { target?: string; flagged?: string[] };
export type ToolId = "copy" | "paste" | "fill" | "undo" | "bold" | "format" | "range";

type Props = {
  controller: SheetController;
  markers?: GridMarkers;
  tools?: ToolId[];
  /** Height of the scrolling area in CSS. */
  height?: string;
  label?: string;
};

function useCoarse() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(pointer: coarse)");
    const f = () => setCoarse(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return coarse;
}

const OPERATOR_END = /[=(,+\-*/^&<>:]$/;

export function Grid({ controller: g, markers = {}, tools = ["copy", "paste", "undo"], height = "min(60vh, 420px)", label = "Practice spreadsheet" }: Props) {
  const coarse = useCoarse();
  const ROW_H = coarse ? 40 : 32;
  const scroller = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLInputElement>(null);
  const cellInput = useRef<HTMLInputElement>(null);
  const dragging = useRef<"select" | "point" | null>(null);
  const pointRef = useRef<{ start: number; anchor: Pos } | null>(null);
  const fillDrag = useRef(false);
  const focusBarOnClick = useRef(false);
  const [fillPreview, setFillPreview] = useState<Pos | null>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [viewH, setViewH] = useState(400);
  const [rangeMode, setRangeMode] = useState(false);
  const [barFocused, setBarFocused] = useState(false);
  const [kbInset, setKbInset] = useState(0);
  const editSource = useRef<"cell" | "bar">("cell");
  const { sheet, active, rect, editing, draft } = g;
  void g.version;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // keep the keyboard from covering the pinned formula bar on phones
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    f();
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, []);

  // scroll the active cell into view
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const top = HEADER_H + active.r * ROW_H;
    const left = ROWHDR_W + active.c * COL_W;
    if (top - HEADER_H < el.scrollTop) el.scrollTop = top - HEADER_H;
    else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight;
    if (left - ROWHDR_W < el.scrollLeft) el.scrollLeft = left - ROWHDR_W;
    else if (left + COL_W > el.scrollLeft + el.clientWidth) el.scrollLeft = left + COL_W - el.clientWidth;
  }, [active.r, active.c, ROW_H]);

  useEffect(() => {
    if (editing && editSource.current === "cell") cellInput.current?.focus();
  }, [editing]);

  const firstRow = Math.max(0, Math.floor(scroll.top / ROW_H) - 3);
  const lastRow = Math.min(ROWS - 1, firstRow + Math.ceil(viewH / ROW_H) + 6);

  function cellAt(e: { clientX: number; clientY: number }): Pos | null {
    const el = scroller.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const x = e.clientX - b.left + el.scrollLeft - ROWHDR_W;
    const y = e.clientY - b.top + el.scrollTop - HEADER_H;
    if (x < 0 || y < 0) return null;
    return { c: Math.min(COLS - 1, Math.floor(x / COL_W)), r: Math.min(ROWS - 1, Math.floor(y / ROW_H)) };
  }

  const canPoint = () => editing && draft.startsWith("=") && (OPERATOR_END.test(draft) || !!pointRef.current);

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-fill-handle]")) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const p = cellAt(e);
    if (!p) return;
    if (canPoint()) {
      e.preventDefault();
      const start = pointRef.current ? pointRef.current.start : draft.length;
      pointRef.current = { start, anchor: p };
      g.setDraft(draft.slice(0, start) + addr(p.r, p.c));
      dragging.current = "point";
      return;
    }
    const touch = e.pointerType === "touch";
    if (touch && editing && p.r === active.r && p.c === active.c) return; // tapping the cell being edited keeps editing
    pointRef.current = null;
    if (editing) g.finishEdit("none");
    if (touch && !rangeMode && p.r === active.r && p.c === active.c) {
      editSource.current = "bar";
      g.startEdit();
      focusBarOnClick.current = true; // the browser moves focus on the synthesised click, so focus the bar after it
      return;
    }
    scroller.current?.focus({ preventScroll: true });
    if (e.shiftKey || (touch && rangeMode)) g.select(p, true);
    else g.select(p);
    if (!touch) dragging.current = "select";
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (fillDrag.current) {
      const p = cellAt(e);
      if (p) setFillPreview(p);
      return;
    }
    if (!dragging.current) return;
    const p = cellAt(e);
    if (!p) return;
    if (dragging.current === "point" && pointRef.current) {
      const a = pointRef.current.anchor;
      const text = a.r === p.r && a.c === p.c ? addr(p.r, p.c) : `${addr(Math.min(a.r, p.r), Math.min(a.c, p.c))}:${addr(Math.max(a.r, p.r), Math.max(a.c, p.c))}`;
      g.setDraft(draft.slice(0, pointRef.current.start) + text);
    } else if (dragging.current === "select") {
      g.select(p, true);
    }
  }

  function onPointerUp() {
    if (fillDrag.current && fillPreview) g.fillTo(fillPreview);
    fillDrag.current = false;
    setFillPreview(null);
    dragging.current = null;
    if (editing) (editSource.current === "cell" ? cellInput.current : barRef.current)?.focus();
  }

  function onKeyDown(e: RKeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      if (e.shiftKey) {
        const cur = { r: Math.max(0, Math.min(ROWS - 1, active.r + dr)), c: Math.max(0, Math.min(COLS - 1, active.c + dc)) };
        g.select(cur, true);
      } else g.select({ r: active.r + dr, c: active.c + dc });
    };
    if (mod) {
      const lower = k.toLowerCase();
      if (lower === "c") { e.preventDefault(); g.copy(); return; }
      if (lower === "x") { e.preventDefault(); g.cut(); return; }
      if (lower === "v") { e.preventDefault(); g.paste(); return; }
      if (lower === "z") { e.preventDefault(); g.undo(); return; }
      if (lower === "b") { e.preventDefault(); g.toggleBold(); return; }
      if (lower === "d") { e.preventDefault(); g.fillDown(); return; }
      if (lower === "r") { e.preventDefault(); g.fillRight(); return; }
      if (lower === "a") { e.preventDefault(); g.selectRange({ r1: 0, c1: 0, r2: ROWS - 1, c2: COLS - 1 }); return; }
      if (k === "Home") { e.preventDefault(); g.select({ r: 0, c: 0 }); return; }
      return;
    }
    switch (k) {
      case "ArrowDown": return move(1, 0);
      case "ArrowUp": return move(-1, 0);
      case "ArrowRight": return move(0, 1);
      case "ArrowLeft": return move(0, -1);
      // Tab is deliberately not captured here: it leaves the grid, so keyboard users are never trapped.
      case "Enter": return move(e.shiftKey ? -1 : 1, 0);
      case "PageDown": return move(10, 0);
      case "PageUp": return move(-10, 0);
      case "Home": e.preventDefault(); g.select({ r: active.r, c: 0 }); return;
      case "Delete":
      case "Backspace": e.preventDefault(); g.clearSelection(); return;
      case "F2": e.preventDefault(); editSource.current = "cell"; g.startEdit(); return;
      case "Escape": return;
    }
    if (k.length === 1 && !e.altKey) {
      e.preventDefault();
      editSource.current = "cell";
      g.startEdit(k);
    }
  }

  function editKeys(e: RKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); pointRef.current = null; g.finishEdit(e.shiftKey ? "up" : "down"); scroller.current?.focus({ preventScroll: true }); }
    else if (e.key === "Tab") { e.preventDefault(); pointRef.current = null; g.finishEdit(e.shiftKey ? "left" : "right"); scroller.current?.focus({ preventScroll: true }); }
    else if (e.key === "Escape") { e.preventDefault(); pointRef.current = null; g.cancelEdit(); scroller.current?.focus({ preventScroll: true }); }
  }

  function insertSymbol(sym: string) {
    const el = barRef.current;
    if (!el) return;
    if (!editing) { editSource.current = "bar"; g.startEdit(draft); }
    const s = el.selectionStart ?? draft.length;
    const t = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, s) + sym + draft.slice(t);
    g.setDraft(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + sym.length, s + sym.length); });
  }

  const activeAddr = addr(active.r, active.c);
  const total = { w: ROWHDR_W + COLS * COL_W, h: HEADER_H + ROWS * ROW_H };
  const px = (r: number, c: number) => ({ left: ROWHDR_W + c * COL_W, top: HEADER_H + r * ROW_H });
  const tgt = markers.target ? { r: Number(markers.target.slice(1)) - 1, c: markers.target.charCodeAt(0) - 65 } : null;
  const flagged = new Set((markers.flagged ?? []).map((a) => a.toUpperCase()));
  const pinned = coarse && barFocused;

  const toolBtn = "inline-flex items-center justify-center rounded-control border border-neutral-300 bg-surface text-ink h-8 min-w-[40px] px-2 gap-1 text-sm disabled:text-neutral-400 disabled:border-neutral-200";
  const bold = sheet.isBold(activeAddr);

  const rows: JSX.Element[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    const cells: JSX.Element[] = [];
    for (let c = 0; c < COLS; c++) {
      const a = addr(r, c);
      const rawv = sheet.raw(a);
      const v = sheet.value(a);
      const isActive = r === active.r && c === active.c;
      const showDraft = isActive && editing && editSource.current === "bar";
      const text = showDraft ? draft : sheet.display(a);
      const isNum = typeof v === "number";
      const isErr = typeof v === "object" && v !== null;
      const isFlag = flagged.has(a);
      cells.push(
        <div
          key={c}
          id={`cell-${a}`}
          role="gridcell"
          aria-colindex={c + 1}
          aria-selected={r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2}
          aria-label={`${a}, ${text === "" ? "empty" : text}${rawv.startsWith("=") ? `, formula ${rawv}` : ""}${isFlag ? ", flagged" : ""}`}
          className={`absolute top-0 border-r border-b border-neutral-200 font-mono text-base leading-none flex items-center px-2 overflow-hidden whitespace-nowrap ${isFlag ? "bg-surface" : "bg-surface"} ${isErr ? "text-error justify-center" : isNum ? "justify-end" : "justify-start"} ${sheet.isBold(a) ? "font-semibold" : ""}`}
          style={{ left: ROWHDR_W + c * COL_W - ROWHDR_W, width: COL_W, height: ROW_H, ...(isFlag ? { outline: `2px dashed ${tokens.color.error}`, outlineOffset: -2, background: `${tokens.color.error}1A` } : {}) }}
        >
          {isActive && editing && editSource.current === "cell" ? (
            <input
              ref={cellInput}
              value={draft}
              onChange={(e) => { pointRef.current = null; g.setDraft(e.target.value); }}
              onKeyDown={editKeys}
              aria-label={`Editing ${a}`}
              className="absolute inset-0 w-full h-full px-2 font-mono text-base bg-surface text-ink outline-none z-[5]"
              style={{ boxShadow: `inset 0 0 0 2px ${tokens.color.primary}` }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          ) : (
            text
          )}
          {isFlag && <span aria-hidden className="absolute top-0 right-1 text-error font-semibold text-sm">!</span>}
        </div>
      );
    }
    rows.push(
      <div key={r} role="row" aria-rowindex={r + 1} className="absolute flex" style={{ top: HEADER_H + r * ROW_H, left: 0, width: total.w, height: ROW_H }}>
        <div role="rowheader" className="sticky left-0 z-[2] shrink-0 border-r border-b border-neutral-300 bg-neutral-100 text-neutral-600 text-sm flex items-center justify-center" style={{ width: ROWHDR_W, height: ROW_H }}>
          {r + 1}
        </div>
        <div className="relative" style={{ width: COLS * COL_W, height: ROW_H }}>{cells}</div>
      </div>
    );
  }

  const selStyle: CSSProperties = { ...px(rect.r1, rect.c1), width: (rect.c2 - rect.c1 + 1) * COL_W, height: (rect.r2 - rect.r1 + 1) * ROW_H };
  const multi = rect.r1 !== rect.r2 || rect.c1 !== rect.c2;
  const preview = fillPreview && (fillPreview.r > rect.r2 || fillPreview.c > rect.c2)
    ? (fillPreview.r - rect.r2 >= fillPreview.c - rect.c2
        ? { ...px(rect.r1, rect.c1), width: (rect.c2 - rect.c1 + 1) * COL_W, height: (fillPreview.r - rect.r1 + 1) * ROW_H }
        : { ...px(rect.r1, rect.c1), width: (fillPreview.c - rect.c1 + 1) * COL_W, height: (rect.r2 - rect.r1 + 1) * ROW_H })
    : null;

  return (
    <div className="flex flex-col gap-2">
      {tools.length > 0 && (
        <div role="toolbar" aria-label="Spreadsheet tools" className="flex flex-wrap items-center gap-2">
          {tools.includes("copy") && <button type="button" className={toolBtn} onClick={g.copy} aria-label="Copy selection"><Copy size={20} aria-hidden /><span className="hidden sm:inline">Copy</span></button>}
          {tools.includes("paste") && <button type="button" className={toolBtn} onClick={g.paste} disabled={!g.hasClip} aria-label="Paste"><ClipboardPaste size={20} aria-hidden /><span className="hidden sm:inline">Paste</span></button>}
          {tools.includes("fill") && <button type="button" className={toolBtn} onClick={g.fillDown} aria-label="Fill down"><ArrowDownToLine size={20} aria-hidden /><span className="hidden sm:inline">Fill down</span></button>}
          {tools.includes("undo") && <button type="button" className={toolBtn} onClick={g.undo} disabled={!g.canUndo} aria-label="Undo"><Undo2 size={20} aria-hidden /><span className="hidden sm:inline">Undo</span></button>}
          {tools.includes("range") && <button type="button" className={`${toolBtn} ${rangeMode ? "border-primary text-primary" : ""}`} aria-pressed={rangeMode} onClick={() => setRangeMode((m) => !m)} aria-label="Select a range by tapping two corners"><BoxSelect size={20} aria-hidden /><span className="hidden sm:inline">Select range</span></button>}
          {tools.includes("bold") && <button type="button" className={`${toolBtn} ${bold ? "border-primary text-primary" : ""}`} aria-pressed={bold} onClick={g.toggleBold} aria-label="Bold"><Bold size={20} aria-hidden /></button>}
          {tools.includes("format") && (
            <label className="inline-flex items-center gap-1 text-sm text-neutral-600">
              <span className="sr-only">Number format</span>
              <select className="h-8 rounded-control border border-neutral-300 bg-surface text-ink text-sm px-2" value={sheet.format(activeAddr)} onChange={(e) => g.setFormat(e.target.value as NumberFormat)}>
                {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <div
        className={pinned ? "fixed left-0 right-0 z-30 bg-surface border-t border-neutral-300 p-2 flex flex-col gap-2" : "flex flex-col gap-2"}
        style={pinned ? { bottom: kbInset } : undefined}
      >
        <div className="flex items-stretch rounded-control border border-neutral-300 bg-surface overflow-hidden">
          <div className="w-[72px] shrink-0 flex items-center justify-center border-r border-neutral-300 bg-neutral-100 text-sm text-neutral-700 font-mono" aria-label="Selected cell">{multi ? rectText(rect) : activeAddr}</div>
          <div className="px-2 flex items-center text-neutral-500 font-mono" aria-hidden>fx</div>
          <input
            ref={barRef}
            aria-label={`Formula bar for ${activeAddr}`}
            className="flex-1 min-w-0 h-10 px-2 font-mono text-base bg-surface text-ink outline-none"
            value={draft}
            onFocus={() => { setBarFocused(true); if (!editing) { editSource.current = "bar"; g.startEdit(draft); } }}
            onBlur={() => setBarFocused(false)}
            onChange={(e) => { pointRef.current = null; if (!editing) editSource.current = "bar"; g.setDraft(e.target.value); if (!editing) g.startEdit(e.target.value); }}
            onKeyDown={editKeys}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
        </div>
        {coarse && barFocused && (
          <div className="flex gap-2" role="group" aria-label="Formula symbols">
            {["=", "$", ":", "(", ")", ",", "\""].map((s) => (
              <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertSymbol(s)} className="flex-1 h-10 rounded-control border border-neutral-300 bg-surface font-mono text-base" aria-label={`Insert ${s}`}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={scroller}
        role="grid"
        tabIndex={0}
        aria-label={label}
        aria-rowcount={ROWS}
        aria-colcount={COLS}
        aria-activedescendant={`cell-${activeAddr}`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => { if (focusBarOnClick.current) { focusBarOnClick.current = false; barRef.current?.focus(); } }}
        onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
        className="relative overflow-auto rounded-card border border-neutral-300 bg-surface select-none"
        style={{ height, touchAction: "pan-x pan-y" }}
      >
        <div className="relative" style={{ width: total.w, height: total.h }}>
          <div role="row" className="sticky top-0 z-[3] flex" style={{ height: HEADER_H, width: total.w }}>
            <div className="sticky left-0 z-[4] shrink-0 border-r border-b border-neutral-300 bg-neutral-100" style={{ width: ROWHDR_W, height: HEADER_H }} />
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} role="columnheader" aria-colindex={c + 1} className={`shrink-0 border-r border-b border-neutral-300 text-sm flex items-center justify-center ${c >= rect.c1 && c <= rect.c2 ? "bg-neutral-200 text-ink font-semibold" : "bg-neutral-100 text-neutral-600"}`} style={{ width: COL_W, height: HEADER_H }}>
                {colLabel(c)}
              </div>
            ))}
          </div>
          {rows}
          {tgt && tgt.r >= firstRow && tgt.r <= lastRow && (
            <div aria-hidden className="absolute pointer-events-none z-[1]" style={{ ...px(tgt.r, tgt.c), width: COL_W, height: ROW_H, outline: `2px dashed ${tokens.color.primary}`, outlineOffset: -3 }} />
          )}
          <div aria-hidden className="absolute pointer-events-none z-[1]" style={{ ...selStyle, border: `2px solid ${tokens.color.primary}`, background: multi ? `${tokens.color.primary}14` : "transparent" }} />
          {preview && <div aria-hidden className="absolute pointer-events-none z-[1]" style={{ ...preview, border: `2px dashed ${tokens.color.primary}` }} />}
          {!editing && (
            <div
              data-fill-handle
              aria-hidden
              className="absolute z-[2]"
              style={{ left: selStyle.left as number + (selStyle.width as number) - (coarse ? 14 : 8), top: selStyle.top as number + (selStyle.height as number) - (coarse ? 14 : 8), width: coarse ? 28 : 16, height: coarse ? 28 : 16, cursor: "crosshair", touchAction: "none" }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fillDrag.current = true; setFillPreview(null); }}
              onPointerMove={(e) => { if (fillDrag.current) { const p = cellAt(e); if (p) setFillPreview(p); } }}
              onPointerUp={(e) => { onPointerUp(); try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} }}
            >
              <div className="absolute bg-primary border border-surface" style={{ right: 2, bottom: 2, width: 8, height: 8 }} />
            </div>
          )}
        </div>
      </div>
      {pinned && <div style={{ height: 112 }} aria-hidden />}
      <div className="sr-only" aria-live="polite">{`Selected ${multi ? rectText(rect) : activeAddr}`}</div>
    </div>
  );
}
