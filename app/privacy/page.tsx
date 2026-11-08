import { Container } from "@/components/Container";
import { PRODUCT } from "@/lib/config";

export const metadata = { title: "Privacy policy", description: "Privacy policy" };

export default function Page() {
  void PRODUCT;
  return (
    <Container className="py-8">
      <article className="max-w-prose grid gap-4">
        <h1>Privacy policy</h1>
        <p className="card p-4 text-sm">Draft for review. Have a lawyer in your country check this page before launch. See SETUP.md, section "Legal".</p>
        <h2>What we store</h2>
        <p>Without an account, your progress stays in your browser on your device. With an account we store your email, display name, progress, XP, streak, shortcut practice, test attempts and certificates so they follow you between devices.</p>
        <h2>Analytics</h2>
        <p>Usage analytics run only if you accept them in the consent banner. Events carry lesson ids and results. They never include your email or anything you typed into a sheet.</p>
        <h2>Payments</h2>
        <p>Payments are handled by our payment provider. We never see or store card numbers. We keep the plan, status and invoice references.</p>
        <h2>Your rights</h2>
        <p>You can delete your account and all its data from the Account page. To ask for a copy of your data, email {PRODUCT.contactEmail}.</p>
        <h2>Age</h2>
        <p>You must be at least {PRODUCT.minimumAge} years old to create an account.</p>
      </article>
    </Container>
  );
}
