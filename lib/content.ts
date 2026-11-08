import fs from "node:fs";
import path from "node:path";
import type { Lesson } from "./checker/types";

export type ModuleMeta = { id: string; number: number; title: string; summary: string; tier: "free" | "pro" };

const ROOT = path.join(process.cwd(), "content");

let cache: { lessons: Lesson[]; modules: ModuleMeta[] } | null = null;

function load() {
  if (cache) return cache;
  const modules: ModuleMeta[] = JSON.parse(fs.readFileSync(path.join(ROOT, "modules.json"), "utf8"));
  const dir = path.join(ROOT, "lessons");
  const lessons: Lesson[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Lesson);
  // Order: module number, then the numeric order given in lessonOrder.json if present.
  const orderFile = path.join(ROOT, "lesson-order.json");
  const order: string[] = fs.existsSync(orderFile) ? JSON.parse(fs.readFileSync(orderFile, "utf8")) : [];
  const modIndex = (id: string) => modules.findIndex((m) => m.id === id);
  lessons.sort((a, b) => {
    const dm = modIndex(a.module) - modIndex(b.module);
    if (dm !== 0) return dm;
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) || a.id.localeCompare(b.id);
  });
  cache = { lessons, modules };
  return cache;
}

export function getAllLessons(): Lesson[] {
  return load().lessons;
}
export function getModules(): ModuleMeta[] {
  return load().modules;
}
export function getLesson(id: string): Lesson | undefined {
  return load().lessons.find((l) => l.id === id);
}
export function getNextLesson(id: string): Lesson | undefined {
  const all = load().lessons;
  const i = all.findIndex((l) => l.id === id);
  return i >= 0 ? all[i + 1] : undefined;
}
