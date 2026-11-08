import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Placement } from "@/components/Placement";
import { getAllLessons, getModules } from "@/lib/content";

export const metadata: Metadata = { title: "Where should I start? 8-question Excel check", description: "Eight quick questions that pick your starting module, so beginners are not bored and experienced users are not stuck." };

export default function Page() {
  const mods = getModules();
  const first: Record<string, string> = {};
  for (const l of getAllLessons()) if (!first[l.module]) first[l.module] = l.id;
  return (
    <Container className="py-8">
      <h1>Where should you start?</h1>
      <p className="mt-2 mb-6 text-neutral-700">Eight questions, about two minutes. Guess if you are unsure; nothing is graded.</p>
      <Placement modules={mods.map((m) => ({ id: m.id, number: m.number, title: m.title }))} firstLessons={first} />
    </Container>
  );
}
