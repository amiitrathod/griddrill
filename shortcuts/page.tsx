import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { ShortcutTrainer } from "@/components/ShortcutTrainer";
import { ShortcutTable } from "@/components/ShortcutTable";

export const metadata: Metadata = {
  title: "Excel shortcuts for Windows and Mac: practise the 40 that matter",
  description: "A table of 40 core Excel shortcuts for Windows and Mac, plus a one-minute drill that brings back the ones you are slow at.",
};

export default function ShortcutsPage() {
  return (
    <Container className="py-8 flex flex-col gap-8">
      <div>
        <h1>Shortcuts</h1>
        <p className="mt-2 text-neutral-700">Press the keys on your own keyboard. The ones you are slow at come back more often.</p>
      </div>
      <ShortcutTrainer />
      <ShortcutTable />
    </Container>
  );
}
