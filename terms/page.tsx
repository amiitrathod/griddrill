import { Container } from "@/components/Container";
import { PRODUCT } from "@/lib/config";

export const metadata = { title: "Terms of use", description: "Terms of use" };

export default function Page() {
  void PRODUCT;
  return (
    <Container className="py-8">
      <article className="max-w-prose grid gap-4">
        <h1>Terms of use</h1>
        <p className="card p-4 text-sm">Draft for review. Have a lawyer in your country check this page before launch. See SETUP.md, section "Legal".</p>
        <h2>Using the service</h2>
        <p>{PRODUCT.name} is provided as is for learning. We try to keep lessons correct, but we do not guarantee results at work or in any hiring test.</p>
        <h2>Subscriptions</h2>
        <p>Pro is a subscription billed monthly or yearly. You can cancel at any time and keep access until the end of the period you paid for. Refund rules: to be set before launch.</p>
        <h2>Certificates</h2>
        <p>A certificate shows that you completed a timed test on this site. It is not an accredited qualification.</p>
        <h2>Trademarks</h2>
        <p>{PRODUCT.disclaimer}</p>
      </article>
    </Container>
  );
}
