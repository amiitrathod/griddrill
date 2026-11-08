import { shiftFormula } from "./refs";

const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LISTS = [WEEK_SHORT, WEEK_LONG, MON_SHORT, MON_LONG];

function listFor(s: string): { list: string[]; i: number } | null {
  for (const list of LISTS) {
    const i = list.findIndex((x) => x.toLowerCase() === s.trim().toLowerCase());
    if (i >= 0) return { list, i };
  }
  return null;
}

function matchCase(sample: string, out: string): string {
  if (sample === sample.toUpperCase()) return out.toUpperCase();
  if (sample === sample.toLowerCase()) return out.toLowerCase();
  return out;
}

/**
 * Value for the nth cell after a source run in a fill. `source` are raw cell contents in fill order.
 * Formulas shift like copy; weekdays and months continue; two or more numbers continue their step.
 */
export function fillValue(source: string[], n: number, dRow: number, dCol: number): string {
  const idx = n % source.length;
  const first = source[idx];
  if (first.startsWith("=")) return shiftFormula(first, dRow, dCol);

  if (source.length >= 2 && source.every((s) => s.trim() !== "" && !Number.isNaN(Number(s)))) {
    const nums = source.map(Number);
    const step = nums[1] - nums[0];
    const linear = nums.every((v, i) => i === 0 || Math.abs(v - nums[i - 1] - step) < 1e-9);
    if (linear) return String(Math.round((nums[nums.length - 1] + step * (n + 1)) * 1e10) / 1e10);
  }
  if (source.length === 1) {
    const hit = listFor(first);
    if (hit) return matchCase(first, hit.list[(hit.i + n + 1) % hit.list.length]);
  }
  return first;
}
