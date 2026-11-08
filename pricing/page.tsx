import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { PricingView } from "@/components/PricingView";

export const metadata: Metadata = { title: "Pricing", description: "Free lessons for the basics, Pro for logic, lookups, timed job tests and certificates." };

export default function PricingPage() {
  return (
    <Container className="py-8">
      <h1>Pricing</h1>
      <p className="mt-2 mb-6 text-neutral-700">The basics stay free. Pro is for people practising for a job test.</p>
      <PricingView />
    </Container>
  );
}
