"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { useAuth, useProgress } from "./Providers";
import { levelInfo } from "@/lib/progress/logic";

const NAV = [
  { href: "/lessons", label: "Lessons" },
  { href: "/shortcuts", label: "Shortcuts" },
  { href: "/practice", label: "Practice" },
  { href: "/pricing", label: "Pricing" },
];

export function Header() {
  const path = usePathname();
  const { user, loading } = useAuth();
  const { xp } = useProgress();
  const lvl = levelInfo(xp).level;
  const link = (active: boolean) => `px-2 py-1 rounded-control font-semibold ${active ? "text-ink bg-neutral-100" : "text-neutral-700"}`;
  return (
    <header className="bg-surface border-b border-neutral-200">
      <Container className="flex items-center justify-between" >
        <Link href="/" aria-label="Home" className="flex items-center" style={{ minHeight: 56, textDecoration: "none" }}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden md:flex items-center gap-2">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={link(path.startsWith(n.href))} style={{ textDecoration: "none" }} aria-current={path.startsWith(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          {user ? (
            <Link href="/account" className={link(path.startsWith("/account"))} style={{ textDecoration: "none" }}>
              {user.name} <span className="text-neutral-600 font-normal text-sm">Level {lvl}</span>
            </Link>
          ) : (
            <Link href="/account" className={link(path.startsWith("/account"))} style={{ textDecoration: "none" }}>
              {loading ? "Account" : "Log in"}
            </Link>
          )}
        </nav>
        <Link href="/account" className="md:hidden font-semibold" style={{ textDecoration: "none" }}>
          {user ? `Level ${lvl}` : "Log in"}
        </Link>
      </Container>
    </header>
  );
}
