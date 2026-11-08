import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { AccountView } from "@/components/AccountView";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <Container className="py-8">
      <h1 className="mb-6">Account</h1>
      <Suspense fallback={<p>Loading.</p>}><AccountView /></Suspense>
    </Container>
  );
}
