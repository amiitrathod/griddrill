import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/Container";
import { LessonList } from "@/components/LessonList";
import { getAllLessons, getModules } from "@/lib/content";

export const metadata: Metadata = { title: "All lessons", description: "The full path from entering data to INDEX and MATCH, one short task at a time." };

export default function LessonsPage() {
  const lessons = getAllLessons().map((l) => ({ id: l.id, module: l.module, title: l.title, minutes: l.minutes }));
  return (
    <Container className="py-8">
      <h1>Lessons</h1>
      <p className="mt-2 text-neutral-700">Each lesson is one idea and a few minutes. Not sure where to start? <Link href="/placement">Take the 8-question check</Link> and we will suggest a module.</p>
      <div className="mt-8">
        <LessonList modules={getModules()} lessons={lessons} />
      </div>
    </Container>
  );
}
