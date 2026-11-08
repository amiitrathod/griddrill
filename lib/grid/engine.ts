import {
  HyperFormula,
  FunctionPlugin,
  FunctionArgumentType,
  SimpleRangeValue,
  CellError,
  ErrorType,
} from "hyperformula";

/**
 * Custom functions HyperFormula does not ship (found in the Stage 1 spike):
 * XLOOKUP, CONCAT, TEXTJOIN, VALUE. See docs/spike-report.md.
 */
function flat(v: unknown): unknown[] {
  if (v instanceof SimpleRangeValue) return v.data.flat();
  return [v];
}
function eq(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return a === b;
}
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof CellError) return "";
  return String(v);
}

/** Excel orders numbers before text before booleans; text compares without regard to case. */
function rank(v: unknown): number {
  return typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 3;
}
function cmp(a: unknown, b: unknown): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "string" && typeof b === "string") {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return Number(a) - Number(b);
}
/** The same binary search Excel runs for approximate matches: it assumes the data is sorted. */
function approxIndex(vals: unknown[], x: unknown): number {
  let lo = 0;
  let hi = vals.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(vals[mid], x) <= 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi; // -1 means nothing is small enough
}
function exactIndex(vals: unknown[], x: unknown): number {
  return vals.findIndex((v) => rank(v) === rank(x) && cmp(v, x) === 0);
}

class GridwisePlugin extends FunctionPlugin {
  static implementedFunctions = {
    VLOOKUP: {
      method: "vlookup",
      parameters: [
        { argumentType: FunctionArgumentType.SCALAR },
        { argumentType: FunctionArgumentType.RANGE },
        { argumentType: FunctionArgumentType.NUMBER },
        { argumentType: FunctionArgumentType.BOOLEAN, optionalArg: true, defaultValue: true },
      ],
    },
    MATCH: {
      method: "match",
      parameters: [
        { argumentType: FunctionArgumentType.SCALAR },
        { argumentType: FunctionArgumentType.RANGE },
        { argumentType: FunctionArgumentType.NUMBER, optionalArg: true, defaultValue: 1 },
      ],
    },
    XLOOKUP: {
      method: "xlookup",
      parameters: [
        { argumentType: FunctionArgumentType.SCALAR },
        { argumentType: FunctionArgumentType.RANGE },
        { argumentType: FunctionArgumentType.RANGE },
        { argumentType: FunctionArgumentType.SCALAR, optionalArg: true },
      ],
    },
    CONCAT: {
      method: "concat",
      repeatLastArgs: 1,
      parameters: [{ argumentType: FunctionArgumentType.ANY }],
    },
    TEXTJOIN: {
      method: "textjoin",
      repeatLastArgs: 1,
      parameters: [
        { argumentType: FunctionArgumentType.STRING },
        { argumentType: FunctionArgumentType.BOOLEAN },
        { argumentType: FunctionArgumentType.ANY },
      ],
    },
    VALUE: {
      method: "value",
      parameters: [{ argumentType: FunctionArgumentType.SCALAR }],
    },
  };

  vlookup(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("VLOOKUP"), (key: any, range: any, col: number, sorted: boolean) => {
      const data: unknown[][] = range.data;
      const idx = Math.trunc(col);
      if (idx < 1) return new CellError(ErrorType.VALUE);
      if (data.length === 0 || idx > data[0].length) return new CellError(ErrorType.REF);
      const firstCol = data.map((r) => r[0]);
      const at = sorted ? approxIndex(firstCol, key) : exactIndex(firstCol, key);
      if (at < 0) return new CellError(ErrorType.NA);
      return data[at][idx - 1] as any;
    });
  }

  match(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("MATCH"), (key: any, range: any, type: number) => {
      const vals = flat(range);
      let at: number;
      if (type === 0) at = exactIndex(vals, key);
      else if (type > 0) at = approxIndex(vals, key);
      else {
        // descending data: smallest value that is >= key
        at = -1;
        for (let i = 0; i < vals.length; i++) if (rank(vals[i]) === rank(key) && cmp(vals[i], key) >= 0) at = i;
      }
      return at < 0 ? new CellError(ErrorType.NA) : at + 1;
    });
  }

  xlookup(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("XLOOKUP"), (lookup: any, lookArr: any, retArr: any, ifNotFound: any) => {
      const l = flat(lookArr);
      const r = flat(retArr);
      const idx = l.findIndex((x) => eq(x, lookup));
      if (idx >= 0 && idx < r.length) return r[idx] as any;
      if (ifNotFound !== undefined) return ifNotFound;
      return new CellError(ErrorType.NA);
    });
  }

  concat(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("CONCAT"), (...args: any[]) =>
      args.flatMap(flat).map(str).join("")
    );
  }

  textjoin(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("TEXTJOIN"), (delim: string, skipEmpty: boolean, ...rest: any[]) => {
      let parts = rest.flatMap(flat).map(str);
      if (skipEmpty) parts = parts.filter((p) => p !== "");
      return parts.join(delim);
    });
  }

  value(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata("VALUE"), (v: any) => {
      if (typeof v === "number") return v;
      const s = str(v).trim().replace(/,/g, "");
      if (s === "") return 0;
      const n = Number(s);
      return Number.isNaN(n) ? new CellError(ErrorType.VALUE) : n;
    });
  }
}

let registered = false;
function ensureRegistered() {
  if (registered) return;
  // Replace HyperFormula's approximate VLOOKUP/MATCH with Excel's binary-search behaviour (see docs/spike-report.md).
  HyperFormula.unregisterFunction("VLOOKUP");
  HyperFormula.unregisterFunction("MATCH");
  HyperFormula.registerFunctionPlugin(GridwisePlugin, {
    enGB: { XLOOKUP: "XLOOKUP", CONCAT: "CONCAT", TEXTJOIN: "TEXTJOIN", VALUE: "VALUE", VLOOKUP: "VLOOKUP", MATCH: "MATCH" },
  });
  registered = true;
}

export type NumberFormat = "general" | "percent" | "percent2" | "number2" | "thousands" | "currency" | "date";
export const FORMAT_LABELS: Record<NumberFormat, string> = {
  general: "General",
  percent: "Percent (0%)",
  percent2: "Percent (0.00%)",
  number2: "Number (2 decimals)",
  thousands: "Number with commas",
  currency: "Currency",
  date: "Date",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatNumber(n: number, fmt: NumberFormat): string {
  switch (fmt) {
    case "percent":
      return `${Math.round(n * 100)}%`;
    case "percent2":
      return `${(n * 100).toFixed(2)}%`;
    case "number2":
      return n.toFixed(2);
    case "thousands":
      return Math.round(n).toLocaleString("en-US");
    case "currency":
      return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "date": {
      // Excel serial date: days since 1899-12-30
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    }
    default:
      return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e10) / 1e10);
  }
}

export type CellValue = string | number | boolean | null | { error: string };
export type RawGrid = Record<string, string | number | boolean | null>;

export const COLS = 26;
export const ROWS = 200;

export function colLabel(c: number): string {
  return String.fromCharCode(65 + c);
}
export function addr(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}
export function parseAddr(a: string): { row: number; col: number } | null {
  const m = /^([A-Za-z])(\d+)$/.exec(a.trim());
  if (!m) return null;
  return { col: m[1].toUpperCase().charCodeAt(0) - 65, row: Number(m[2]) - 1 };
}

/**
 * HyperFormula only understands TRUE() / FALSE(); Excel also accepts bare TRUE / FALSE.
 * Rewrite bare booleans outside of string literals so learners can type them the Excel way.
 */
export function normalizeFormula(f: string): string {
  const parts = f.split(/("(?:[^"]|"")*")/); // odd indexes are string literals
  return parts
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, (m) => m.toUpperCase() + "()")))
    .join("");
}

/** A small wrapper so the rest of the app never touches HyperFormula directly. */
export class Sheet {
  private hf: HyperFormula;
  private sheetId = 0;
  private originals = new Map<string, string>();
  private formats = new Map<string, NumberFormat>();
  private bolds = new Set<string>();

  constructor(initial: RawGrid = {}) {
    ensureRegistered();
    this.hf = HyperFormula.buildEmpty({ licenseKey: "gpl-v3", useColumnIndex: false, smartRounding: true });
    const name = this.hf.addSheet("Sheet1");
    this.sheetId = this.hf.getSheetId(name)!;
    this.hf.setSheetContent(this.sheetId, Array.from({ length: 1 }, () => [null]));
    for (const [a, v] of Object.entries(initial)) this.set(a, v);
  }

  set(a: string, raw: string | number | boolean | null) {
    const p = parseAddr(a);
    if (!p) return;
    let value: any = raw;
    if (raw === "" || raw === null) this.originals.delete(a.toUpperCase());
    else this.originals.set(a.toUpperCase(), String(raw));
    if (typeof raw === "string" && raw.trim().startsWith("=")) value = normalizeFormula(raw.trim());
    if (typeof raw === "string" && raw.trim() !== "" && !raw.startsWith("=")) {
      // numbers typed as text stay numbers, like Excel; leading apostrophe forces text
      if (raw.startsWith("'")) value = raw; // HyperFormula treats a leading apostrophe as "store as text"
      else if (/^-?\d+(\.\d+)?$/.test(raw.trim())) value = Number(raw);
    }
    if (raw === "") value = null;
    this.hf.setCellContents({ sheet: this.sheetId, row: p.row, col: p.col }, [[value]]);
  }

  /** What the learner typed (formulas keep their original text). */
  raw(a: string): string {
    return this.originals.get(a.toUpperCase()) ?? "";
  }

  value(a: string): CellValue {
    const p = parseAddr(a);
    if (!p) return null;
    const v = this.hf.getCellValue({ sheet: this.sheetId, row: p.row, col: p.col }) as any;
    if (v && typeof v === "object" && "value" in v && typeof v.value === "string" && v.value.startsWith("#")) {
      return { error: v.value };
    }
    return v ?? null;
  }

  setFormat(a: string, fmt: NumberFormat) {
    if (fmt === "general") this.formats.delete(a.toUpperCase());
    else this.formats.set(a.toUpperCase(), fmt);
  }
  format(a: string): NumberFormat {
    return this.formats.get(a.toUpperCase()) ?? "general";
  }
  setBold(a: string, on: boolean) {
    if (on) this.bolds.add(a.toUpperCase());
    else this.bolds.delete(a.toUpperCase());
  }
  isBold(a: string): boolean {
    return this.bolds.has(a.toUpperCase());
  }

  display(a: string): string {
    const v = this.value(a);
    if (v === null) return "";
    if (typeof v === "object") return v.error;
    if (typeof v === "number") return formatNumber(v, this.format(a));
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return String(v);
  }

  /** Raw contents of every non-empty cell, for saving, copying and checking. */
  snapshot(): RawGrid {
    const out: RawGrid = {};
    for (const [a, v] of this.originals) out[a] = v;
    return out;
  }

  formatsSnapshot(): Record<string, NumberFormat> {
    return Object.fromEntries(this.formats);
  }

  boldsSnapshot(): string[] {
    return [...this.bolds];
  }

  destroy() {
    this.hf.destroy();
  }
}
