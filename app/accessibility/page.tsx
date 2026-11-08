import { Container } from "@/components/Container";
import { PRODUCT } from "@/lib/config";

export const metadata = { title: "Accessibility statement", description: "Accessibility statement" };

export default function Page() {
  void PRODUCT;
  return (
    <Container className="py-8">
      <article className="max-w-prose grid gap-4">
        <h1>Accessibility statement</h1>
        <p className="card p-4 text-sm">Draft for review. Have a lawyer in your country check this page before launch. See SETUP.md, section "Legal".</p>
        <p>We aim to meet WCAG 2.2 level AA. Every action in the practice sheet works with the keyboard, and colour is never the only signal.</p>
        <h2>Known limits</h2>
        <p>The practice sheet is a custom component. Screen readers announce the active cell and its value, but complex range selection is easier with a keyboard than with a screen reader. We are testing this with assistive technology users.</p>
        <h2>Tell us</h2>
        <p>If something does not work for you, email {PRODUCT.contactEmail}. We reply within five working days.</p>
      </article>
    </Container>
  );
}
