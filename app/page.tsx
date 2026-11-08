import { Container } from "@/components/Container";
import { Hero } from "@/components/home/Hero";
import { LessonPlayer } from "@/components/LessonPlayer";
import { getAllLessons, getLesson } from "@/lib/content";

const BENEFITS = [
  { title: "Marked by the result, not the typing", body: "=sum(a1:a3) and =SUM(A1:A3) both pass. Any formula that gives the right answer counts, unless the lesson is about one particular function." },
  { title: "Mistakes explained in plain words", body: "\"You used SUM on B2:B4 but the data runs to B5.\" Every wrong answer says what was expected, what you got, and the likely cause." },
  { title: "Five minutes is a full session", body: "Lessons take under three minutes. Your progress is saved on this device before you ever create an account." },
];

export default function Home() {
  const all = getAllLessons();
  const mini = getLesson("sum-basic-01")!;
  return (
    <>
      <Container className="py-8 md:py-12">
        <Hero first={{ id: all[0].id, title: all[0].title }} all={all.map((l) => ({ id: l.id, title: l.title }))} />
      </Container>
      <section aria-labelledby="try" className="border-y border-neutral-200 bg-surface">
        <Container className="py-6">
          <h2 id="try" style={{ fontSize: "1.25rem" }}>Try one now. No sign-up.</h2>
        </Container>
        <LessonPlayer lesson={mini} moduleTitle="First formulas" moduleTier="free" moduleLessonIds={[mini.id]} next={null} embedded />
      </section>
      <Container className="py-12">
        <ul className="grid md:grid-cols-3 gap-6">
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <h3>{b.title}</h3>
              <p className="mt-2 text-neutral-700">{b.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
