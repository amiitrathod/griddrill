import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/LessonPlayer";
import { getAllLessons, getLesson, getModules, getNextLesson } from "@/lib/content";

export function generateStaticParams() {
  return getAllLessons().map((l) => ({ id: l.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const l = getLesson(params.id);
  return l ? { title: l.title, description: l.teach } : {};
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const lesson = getLesson(params.id);
  if (!lesson) notFound();
  const mod = getModules().find((m) => m.id === lesson.module)!;
  const next = getNextLesson(lesson.id);
  const ids = getAllLessons().filter((l) => l.module === lesson.module).map((l) => l.id);
  return <LessonPlayer lesson={lesson} moduleTitle={mod.title} moduleTier={mod.tier} moduleLessonIds={ids} next={next ? { id: next.id, title: next.title } : null} />;
}
