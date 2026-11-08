import { Container } from "@/components/Container";
import { PRODUCT } from "@/lib/config";

export const metadata = { title: "About", description: "About" };

export default function Page() {
  void PRODUCT;
  return (
    <Container className="py-8">
      <article className="max-w-prose grid gap-4">
        <h1>About</h1>
        <p>{PRODUCT.name} teaches spreadsheet skills by having you type real formulas into a practice sheet. A checker compares your answer with the correct one and, when it is wrong, tells you which cell and the likely cause.</p>
        <p>Lessons are short: one idea, one task, about three minutes. There are no videos to sit through.</p>
        <p>{PRODUCT.disclaimer}</p>
      </article>
    </Container>
  );
}
