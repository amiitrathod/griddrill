import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { TestRunner } from "@/components/TestRunner";
import { getTemplate } from "@/lib/jobtest";

export const metadata = { title: "Job test" };

export default function TestPage({ params }: { params: { id: string } }) {
  const t = getTemplate(params.id);
  if (!t) notFound();
  return (
    <Container className="py-6">
      <TestRunner testId={t.id} title={t.title} minutes={t.minutes} proOnly={t.proOnly} blurb={t.blurb} />
    </Container>
  );
}
