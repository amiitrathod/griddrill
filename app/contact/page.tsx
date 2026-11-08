import { Container } from "@/components/Container";
import { PRODUCT } from "@/lib/config";

export const metadata = { title: "Contact", description: "Contact" };

export default function Page() {
  void PRODUCT;
  return (
    <Container className="py-8">
      <article className="max-w-prose grid gap-4">
        <h1>Contact</h1>
        <p>Email <a className="underline" href={`mailto:${PRODUCT.contactEmail}`}>{PRODUCT.contactEmail}</a> for questions, billing help or to report a mistake in a lesson.</p>
        <p>Every lesson also has a &quot;Report a problem&quot; button, which tells us exactly which lesson you were on.</p>
      </article>
    </Container>
  );
}
