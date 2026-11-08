/**
 * Content review checklist as code (PRD sections 6 and 8). Run: npm run validate:lessons
 * Fails the build when a lesson breaks the content standard or disagrees with the checker.
 */
import fs from "node:fs";
import path from "node:path";
import { checkOverlay } from "../lib/checker/check";
import type { Lesson } from "../lib/checker/types";

const root = path.join(process.cwd(), "content");
const modules: { id: string }[] = JSON.parse(fs.readFileSync(path.join(root, "modules.json"), "utf8"));
const dir = path.join(root, "lessons");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

const FILLER = [/unlock your potential/i, /take your .* to the next level/i, /game.?changer/i, /supercharge/i, /master excel in/i];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PLACEHOLDER_DATA = /^(foo|bar|baz|test|lorem|abc|xyz)$/i;

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0).length;

let problems = 0;
const ids = new Set<string>();
const fail = (id: string, msg: string) => {
  problems++;
  console.error(`  x ${id}: ${msg}`);
};

for (const f of files) {
  const id = f.replace(/\.json$/, "");
  let l: Lesson;
  try {
    l = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    fail(id, `invalid JSON (${(e as Error).message})`);
    continue;
  }
  if (l.id !== id) fail(id, `id "${l.id}" does not match the file name`);
  if (ids.has(l.id)) fail(id, "duplicate id");
  ids.add(l.id);
  if (!modules.some((m) => m.id === l.module)) fail(id, `unknown module "${l.module}"`);
  for (const k of ["title", "teach", "task", "target", "check", "hints", "explainRules", "accepted", "xp", "grid", "tests", "minutes"] as const)
    if ((l as never)[k] === undefined) fail(id, `missing field "${k}"`);
  if (l.minutes > 3) fail(id, `takes ${l.minutes} minutes; the limit is 3`);
  const intro = [l.teach, l.example].filter(Boolean).join(" ");
  if (sentences(intro) > 3) fail(id, `${sentences(intro)} sentences before the task; the limit is 3 (doing beats reading)`);
  if (l.task.length > 320) fail(id, "task text is too long");
  if (!/^[A-Z]\d+$/.test(l.target)) fail(id, `target "${l.target}" is not a cell address`);
  if (l.hints.length !== 3) fail(id, `needs exactly 3 hint levels, has ${l.hints.length}`);
  if (!["formula", "fix"].includes(l.check.type) || l.check.type === "quick") {
    /* accepted answers are display text for non-formula checks */
  }
  if (l.accepted.length < 1) fail(id, "needs at least one accepted answer");
  if (l.tests.correct.length < 3) fail(id, "needs at least 3 correct-answer tests");
  if (l.tests.wrong.length < 3) fail(id, "needs at least 3 wrong-answer tests");
  if (["formula", "fix"].includes(l.check.type) && !l.task.includes(l.target)) fail(id, `the task text never names the target cell ${l.target}`);
  const text = [l.teach, l.example ?? "", l.task, ...l.hints].join(" ");
  for (const re of FILLER) if (re.test(text)) fail(id, `generic filler copy (${re})`);
  if (EMOJI.test(text) || EMOJI.test(l.title)) fail(id, "emoji in lesson text");
  for (const v of Object.values(l.grid)) if (typeof v === "string" && PLACEHOLDER_DATA.test(v.trim())) fail(id, `placeholder data "${v}": use realistic names and amounts`);
  if (l.check.type === "formula" || l.check.type === "fix") {
    if (!/^[A-Z]\d+$/.test(l.target)) continue;
    for (const a of l.accepted) {
      const r = checkOverlay(l, { [l.target]: a });
      if (!r.ok) fail(id, `accepted answer ${a} is rejected by the checker: ${r.message}`);
    }
  }
  l.tests.correct.forEach((o, i) => {
    const r = checkOverlay(l, o);
    if (!r.ok) fail(id, `correct test #${i + 1} ${JSON.stringify(o)} is rejected: ${r.message}`);
  });
  l.tests.wrong.forEach((o, i) => {
    const r = checkOverlay(l, o);
    if (r.ok) fail(id, `wrong test #${i + 1} ${JSON.stringify(o)} is accepted by the checker`);
  });
}

const count = files.length;
if (problems) {
  console.error(`\nLesson validation failed: ${problems} problem(s) across ${count} lessons.`);
  process.exit(1);
}
console.log(`Lesson validation passed: ${count} lessons.`);
