import Link from "next/link";
import { Container } from "./Container";
import { PRODUCT } from "@/lib/config";

const LINKS = [
  ["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Accessibility", "/accessibility"],
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-surface mt-12">
      <Container className="py-6 flex flex-col gap-4">
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          {LINKS.map(([l, h]) => (
            <Link key={h} href={h} style={{ minHeight: 24 }}>{l}</Link>
          ))}
        </nav>
        <p className="text-sm text-neutral-700">{PRODUCT.disclaimer}</p>
      </Container>
    </footer>
  );
}
