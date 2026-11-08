import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { LessonPlayer } from "@/components/LessonPlayer";
import { getLesson } from "@/lib/content";
import { FUNCTION_PAGES } from "@/lib/functions-seo";

export const generateStaticParams = () => FUNCTION_PAGES.map((f) => ({ slug: f.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const f = FUNCTION_PAGES.find((x) => x.slug === params.slug);
  return f ? { title: `How to use ${f.name}`, description: `${f.name} ${f.what} Try it in a practice sheet and get checked straight away.` } : {};
}

export default function FunctionPage({ params }: { params: { slug: string } }) {
  const f = FUNCTION_PAGES.find((x) => x.slug === params.slug);
  const lesson = f && getLesson(f.lessonId);
  if (!f || !lesson) notFound();
  return (
    <Container className="py-8">
      <h1>How to use {f.name}</h1>
      <p className="mt-3 max-w-prose">{f.name} {f.what}</p>
      <p className="mt-3"><code className="font-mono bg-neutral-100 px-2 py-1 rounded">{f.syntax}</code></p>
      <p className="mt-2 text-neutral-700">Example: {f.example}</p>
      <h2 className="mt-8" style={{ fontSize: "1.25rem" }}>Try it</h2>
      <div className="mt-3">
        <LessonPlayer lesson={lesson} moduleTitle="Practice" moduleTier="free" moduleLessonIds={[lesson.id]} next={null} embedded />
      </div>
      <p className="mt-6"><Link href={`/lessons/${lesson.id}`} className="btn-secondary">Open the full lesson</Link></p>
    </Container>
  );
}
