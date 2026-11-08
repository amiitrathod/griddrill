import Link from "next/link";
import { Container } from "@/components/Container";
import { TEMPLATES } from "@/lib/jobtest";

export const metadata = { title: "Practice tests", description: "Timed spreadsheet tests that look like the ones used in hiring, with a score report and a certificate." };

export default function Practice() {
  return (
    <Container className="py-8">
      <h1>Practice tests</h1>
      <p className="mt-2 max-w-prose">Timed tasks like the ones used when hiring clerks, executives and data-entry staff. Each attempt has new data. You get a score and the three topics to repeat.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <li key={t.id} className="card p-5">
            <h2 style={{ fontSize: "1.125rem" }}>{t.title}</h2>
            <p className="mt-1">{t.blurb}</p>
            <p className="mt-2 text-sm text-neutral-700">{t.minutes} minutes · {t.proOnly ? "Pro, with certificate" : "Free"}</p>
            <Link href={`/practice/test/${t.id}`} className="btn-primary mt-3 inline-flex">{t.proOnly ? "Open" : "Try the sample"}</Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
