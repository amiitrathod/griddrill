/** Tiny formula reader: enough to compare formulas by structure, not by text. */

export type Call = { name: string; args: string[]; start: number };

export function normalizeText(f: string): string {
  const parts = f.trim().split(/("(?:[^"]|"")*")/);
  return parts.map((p, i) => (i % 2 === 1 ? p : p.replace(/\s+/g, "").toUpperCase())).join("");
}

/** Split the text of an argument list at top-level commas. */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inStr = !inStr;
    if (!inStr) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim() !== "" || out.length > 0) out.push(cur.trim());
  return out;
}

/** Every function call in a formula, outermost first. */
export function extractCalls(formula: string): Call[] {
  const f = formula.startsWith("=") ? formula.slice(1) : formula;
  const calls: Call[] = [];
  const re = /([A-Za-z][A-Za-z0-9.]*)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let inStr = false;
    let end = -1;
    for (let i = open; i < f.length; i++) {
      const ch = f[i];
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue; // unbalanced
    calls.push({ name: m[1].toUpperCase(), args: splitArgs(f.slice(open + 1, end)), start: m.index });
  }
  return calls;
}

export function functionsUsed(formula: string): string[] {
  return extractCalls(formula).map((c) => c.name);
}

export function isBalanced(formula: string): boolean {
  let depth = 0;
  let inStr = false;
  for (const ch of formula) {
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0 && !inStr;
}

export function parseRange(s: string): { c1: number; r1: number; c2: number; r2: number } | null {
  const m = /^\$?([A-Za-z])\$?(\d+)(?::\$?([A-Za-z])\$?(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const c1 = m[1].toUpperCase().charCodeAt(0) - 65;
  const r1 = Number(m[2]);
  const c2 = m[3] ? m[3].toUpperCase().charCodeAt(0) - 65 : c1;
  const r2 = m[4] ? Number(m[4]) : r1;
  return { c1: Math.min(c1, c2), r1: Math.min(r1, r2), c2: Math.max(c1, c2), r2: Math.max(r1, r2) };
}

export function rangeText(r: { c1: number; r1: number; c2: number; r2: number }): string {
  const a = `${String.fromCharCode(65 + r.c1)}${r.r1}`;
  const b = `${String.fromCharCode(65 + r.c2)}${r.r2}`;
  return a === b ? a : `${a}:${b}`;
}

/** Operators at the top level of a formula body, used to spot a wrong operator. */
export function topLevelOperators(formula: string): string[] {
  const f = formula.startsWith("=") ? formula.slice(1) : formula;
  const ops: string[] = [];
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && "+-*/^&".includes(ch) && i > 0) ops.push(ch);
  }
  return ops;
}
