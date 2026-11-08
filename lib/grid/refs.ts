import { colLabel } from "./engine";

/**
 * Shift the relative cell references in a formula, the way copy/paste and fill do in a
 * spreadsheet. `$A$1` stays put, `$A1` only moves by row, `A$1` only moves by column.
 * Text inside double quotes is left alone.
 */
export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  if (!formula.startsWith("=")) return formula;
  const parts = formula.split(/("(?:[^"]|"")*")/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/(\$?)([A-Za-z])(\$?)(\d+)(?![\d(A-Za-z_])/g, (m, cAbs, col, rAbs, row, offset, whole) => {
        // skip things like function names (SUM1( ) or sheet-ish words: check preceding char
        const prev = offset > 0 ? whole[offset - 1] : "";
        if (/[A-Za-z0-9_.]/.test(prev)) return m;
        let c = col.toUpperCase().charCodeAt(0) - 65;
        let r = Number(row) - 1;
        if (!cAbs) c += dCol;
        if (!rAbs) r += dRow;
        if (c < 0 || c > 25 || r < 0) return "#REF!";
        return `${cAbs}${colLabel(c)}${rAbs}${r + 1}`;
      });
    })
    .join("");
}

/** All plain cell references in a formula (ranges are expanded to their end points). */
export function referencedCells(formula: string): string[] {
  const out: string[] = [];
  const parts = formula.split(/("(?:[^"]|"")*")/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) return;
    const re = /(\$?)([A-Za-z])(\$?)(\d+)(?![\d(A-Za-z_])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) {
      const prev = m.index > 0 ? part[m.index - 1] : "";
      if (/[A-Za-z0-9_.]/.test(prev)) continue;
      out.push(`${m[2].toUpperCase()}${m[4]}`);
    }
  });
  return out;
}

/** Expand a range like A1:B3 into every cell address. */
export function expandRange(range: string): string[] {
  const m = /^([A-Za-z])(\d+):([A-Za-z])(\d+)$/.exec(range.replace(/\$/g, ""));
  if (!m) return [];
  const c1 = m[1].toUpperCase().charCodeAt(0) - 65;
  const c2 = m[3].toUpperCase().charCodeAt(0) - 65;
  const r1 = Number(m[2]);
  const r2 = Number(m[4]);
  const out: string[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.push(`${colLabel(c)}${r}`);
  return out;
}
