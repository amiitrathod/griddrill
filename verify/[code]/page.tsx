import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { Container } from "@/components/Container";
import { getCertificate } from "@/lib/server/tests-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify a certificate", robots: { index: false } };

export default async function Verify({ params }: { params: { code: string } }) {
  const c = await getCertificate(params.code.toUpperCase());
  return (
    <Container className="py-8">
      <h1>Verify a certificate</h1>
      {c ? (
        <div className="card p-6 mt-6 max-w-prose" role="status">
          <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 size={20} aria-hidden /> This certificate is genuine.</p>
          <dl className="mt-4 grid gap-2">
            <div><dt className="text-sm text-neutral-700">Name</dt><dd className="font-semibold">{c.holder_name}</dd></div>
            <div><dt className="text-sm text-neutral-700">Test</dt><dd>{c.test_title}</dd></div>
            <div><dt className="text-sm text-neutral-700">Score</dt><dd>{Math.round(c.score)}%</dd></div>
            <div><dt className="text-sm text-neutral-700">Issued</dt><dd>{new Date(c.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-neutral-700">This certificate shows completion of a timed test on this site, scored by the site&apos;s servers. It is not an accredited qualification.</p>
        </div>
      ) : (
        <div className="card p-6 mt-6 max-w-prose" role="status">
          <p className="flex items-center gap-2 font-semibold text-error"><XCircle size={20} aria-hidden /> No certificate matches this code.</p>
          <p className="mt-2">Check the code for typing mistakes. Codes look like GW-ABCDE-FGHJK.</p>
        </div>
      )}
    </Container>
  );
}
